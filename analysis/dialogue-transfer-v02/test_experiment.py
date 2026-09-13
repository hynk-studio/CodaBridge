"""TEST ONLY synthetic diagnostics; none is a real-data result or an extra study."""
import copy
import json
import math
from pathlib import Path
import unittest
import numpy as np
from experiment import aggregate, bootstrap_plan, evaluate_study, fit_fold, summaries, uncertainty
from numerics import diagnose, loss
from sklearn._loss.loss import HalfPoissonLoss
from sklearn.linear_model._linear_loss import LinearModelLoss

CONFIG = json.loads((Path(__file__).parent / 'protocol.json').read_text())

def synthetic(coupled=True):
    rng = np.random.default_rng(317)
    rows = []
    for i in range(240):
        own, partner, older, noise = rng.normal(size=4)
        z = .15*own + (.9*partner if coupled else 0) + .1*noise
        rows.append({'id':f'TEST-ONLY-{i}','currentRow':i,'parentGroup':f'g{i//40}','targets':{'duration':z,'count':int(rng.poisson(math.exp(.2*own+.2*partner)))+2,'gap':z+.5},'features':{'M1':[own,None], 'M2':[own,None,partner], 'M2-lagged':[own,None,older]},'prefix':{'previousPresent':i%2==0,'recentOverlap':i%3==0,'latestPartnerEndAge':float(i%7)}})
    return rows

class FixedResearchTests(unittest.TestCase):
    def test_pinned_poisson_objective_and_regularization_reference(self):
        # TEST ONLY pinned estimator reference, independent scalar diagnostic below.
        x=np.array([[-1.,2.],[0.,-1.],[1.,0.]])
        y=np.array([2.,3.,4.]); coefficients=np.array([.2,-.1,1.])
        reference=LinearModelLoss(base_loss=HalfPoissonLoss(),fit_intercept=True)
        objective, gradient=reference.loss_gradient(coefficients,x,y,l2_reg_strength=CONFIG['poisson']['alpha'])
        mu=np.exp(x@coefficients[:-1]+coefficients[-1])
        reconstructed=np.r_[x.T@(mu-y)/len(y)+coefficients[:-1],np.mean(mu-y)]
        np.testing.assert_allclose(gradient,reconstructed,rtol=1e-13,atol=1e-14)
        # sklearn omits target-only y*log(y)-y; full half-deviance includes it.
        full=np.mean([loss(a,b,'poisson')/2 for a,b in zip(y,mu)])+np.sum(coefficients[:-1]**2)/2
        self.assertAlmostEqual(objective+np.mean(y*np.log(y)-y),full,places=13)

    def test_hand_computable_losses_units_and_signs(self):
        self.assertEqual(loss(2,1,'ridge'),1)
        self.assertEqual(loss(math.log(4),math.log(2),'ridge'),math.log(2)**2)
        self.assertAlmostEqual(loss(2,1,'poisson'),2*(2*math.log(2)-1))
        self.assertEqual(loss(2,2,'poisson'),0)
        self.assertGreater(loss(2,1,'poisson')-loss(2,2,'poisson'),0)
        for mu in [0,-1,float('nan'),float('inf')]:
            with self.assertRaises(ValueError): loss(2,mu,'poisson')

    def test_enforced_ridge_and_poisson_numerics(self):
        x=[[-1.],[1.]]
        d=diagnose(x,[-1.,1.],[2/3],0,'ridge',CONFIG,'TEST ONLY Ridge')
        self.assertLessEqual(d['maximumNormalizedResidual'],d['bound'])
        d=diagnose(x,[1.,1.],[0.],0,'poisson',CONFIG,'TEST ONLY Poisson')
        self.assertEqual(d['maximumGradient'],0)
        for kind,y,w,b in [('ridge',[-1,1],[.8],0),('poisson',[1,1],[0],.1),('ridge',[-1,1],[float('nan')],0),('poisson',[1,1],[float('inf')],0)]:
            with self.assertRaisesRegex(ValueError,'TEST ONLY'):
                diagnose(x,y,w,b,kind,CONFIG,'TEST ONLY fold 2 / M2')

    def test_train_only_fit_and_separate_older_model(self):
        rows=synthetic(); train,test=rows[:200],rows[200:]
        for definition in CONFIG['studies'][:3]:
            first, fits, failures, _=fit_fold(train,test,definition,CONFIG,0)
            self.assertEqual(failures,[])
            changed=copy.deepcopy(test)
            for row in changed:
                row['targets']={k:1000 for k in row['targets']}
                row['features']['M2'][0]+=2
            _, changed_fits, failures, _=fit_fold(train,changed,definition,CONFIG,0)
            self.assertEqual(failures,[])
            self.assertEqual(fits,changed_fits)
            self.assertNotEqual(fits['M2']['coefficients'],fits['M2-lagged']['coefficients'])
            self.assertEqual(set(first),set(definition['models']))
        with self.assertRaisesRegex(ValueError,'GROUP_LEAKAGE'):
            fit_fold(train,train[:2],CONFIG['studies'][0],CONFIG,0)

    def test_failure_and_insufficient_states_no_partial_average(self):
        rows=synthetic(); split={'folds':5,'assignments':{f'g{i}':i%5 for i in range(6)}}
        config=copy.deepcopy(CONFIG); config['poisson']['max_iter']=1
        study,_=evaluate_study(rows,split,config['studies'][1],config,bootstrap_plan(split,config['bootstrap']))
        self.assertEqual(study['status'],'failed');self.assertIsNone(study['metrics']);self.assertEqual(study['records'],[])
        self.assertTrue(study['failures'])
        split['assignments']={'g0':0,'g1':1}
        study,_=evaluate_study([],split,config['studies'][0],config,bootstrap_plan(split,config['bootstrap']))
        self.assertEqual(study['status'],'insufficient-data');self.assertIsNone(study['uncertainty'])

    def test_bootstrap_pairing_multiplicity_and_macro(self):
        records=[{'parentGroup':g,'predictions':{'M1':{'loss':a,'absoluteError':a},'M2':{'loss':b,'absoluteError':b}}} for g,a,b in [('a',3,1),('a',3,1),('b',1,5)]]
        metrics=summaries(records,['M1','M2'],[('M2','M1')])
        self.assertEqual(metrics['pooled']['gain']['M2_vs_M1'],0)
        self.assertEqual(metrics['macro']['gain']['M2_vs_M1'],-1)
        plan={'groups':['a','b'],'draws':[[0,0],[1,1],[0,1]]}
        config=copy.deepcopy(CONFIG['bootstrap']);config['percentiles']=[0,100]
        result=uncertainty(metrics,plan,config)
        self.assertEqual(result['intervals']['M2_vs_M1']['pooled'],[-4,2])
        self.assertIsNone(aggregate([],['M1','M2'],[('M2','M1')]))
        self.assertEqual(summaries([],['M1','M2'],[])['status'],'empty')

    def test_known_coupling_and_finite_independent_sample(self):
        for coupled in [True,False]:
            rows=synthetic(coupled); split={'folds':5,'assignments':{f'g{i}':i%5 for i in range(6)}}
            study,_=evaluate_study(rows,split,CONFIG['studies'][0],CONFIG,bootstrap_plan(split,CONFIG['bootstrap']))
            self.assertEqual(study['status'],'completed')
            gain=study['metrics']['pooled']['gain']['M2_vs_M1']
            self.assertTrue(math.isfinite(gain))
            if coupled: self.assertGreater(gain,.1)
            # An arbitrary finite independent sample need not have exactly zero/negative gain.
            self.assertEqual(sum(cell['pooled']['n'] if cell['pooled'] else 0 for cell in study['strata']['age'].values()),len(rows))
            self.assertEqual(len(study['deletions']),6)
            self.assertEqual(bootstrap_plan(split,CONFIG['bootstrap']),bootstrap_plan(split,CONFIG['bootstrap']))

if __name__=='__main__': unittest.main()
