"""Frozen synthetic-event experiment. Reuses production v0.2 fitting and intervals."""
import os
for name in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS']:
    os.environ[name] = '1'
import hashlib, importlib.metadata, json, math, subprocess, sys
from pathlib import Path
import numpy as np
sys.path.insert(0, str(Path('analysis/dialogue-transfer-v02').resolve()))
from experiment import fit_fold, summaries, bootstrap_plan, uncertainty
from numerics import loss
ROOT = Path('analysis/event-simulation-v1')
protocol = json.loads((ROOT/'protocol.json').read_text())
config = json.loads(Path('analysis/dialogue-transfer-v02/protocol.json').read_text())
config['metrics']['contrasts'] = [['M2','M1']]
config['bootstrap']['resamples'] = protocol['intervalResamples']
study = {'id':'synthetic-duration','target':'duration','estimator':'ridge','models':['M0','M1','M2']}

def wilson(success, n):
    if not n: return None
    p = success/n; z=1.959963984540054; den=1+z*z/n
    mid=(p+z*z/(2*n))/den; half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den
    return [mid-half,mid+half]

def aggregate(runs):
    out=[]
    for family in protocol['families']:
        for variant in protocol['variants']:
            allrows=[r for r in runs if r['family']==family and r['variant']==variant]
            rows=[r for r in allrows if r['status']=='completed']; n=len(rows)
            gains=[r['gain'] for r in rows]; flags=sum(r['flag'] for r in rows)
            out.append({'family':family,'variant':variant,'attempted':len(allrows),'completed':n,'failed':len(allrows)-n,
                'gainMean':float(np.mean(gains)) if n else None,'gainMonteCarloSE':float(np.std(gains,ddof=1)/np.sqrt(n)) if n>1 else None,
                'flags':flags,'flagRate':flags/n if n else None,'flagRateWilson95':wilson(flags,n),
                'interpretation':'false-trigger calibration under independent processes' if family=='independent' else 'common-driver predictive sensitivity; direct-influence attribution would be unsupported' if family=='common-driver' else 'directed-generator detection sensitivity',
                'eligibleRange':[min(r['audit']['eligible'] for r in rows),max(r['audit']['eligible'] for r in rows)] if n else None})
    return out

def run():
    freeze=json.loads((ROOT/'freeze.json').read_text())
    for path, sha in freeze['files'].items():
        assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==sha, 'Frozen code changed: '+path
    runs=[]; learned=0
    process=subprocess.Popen(['node','--experimental-strip-types',str(ROOT/'stream.ts')],stdout=subprocess.PIPE,text=True)
    try:
        for line in process.stdout:
            item=json.loads(line); records=[]; errors=[]; warnings=[]; diagnostics=[]
            for fold in range(item['split']['folds']):
                train=[r for r in item['rows'] if item['split']['assignments'][r['parentGroup']]!=fold]
                test=[r for r in item['rows'] if item['split']['assignments'][r['parentGroup']]==fold]
                learned+=2
                assert learned<=protocol['maxLearnedFits']
                means, fitted, failures, notices=fit_fold(train,test,study,config,fold)
                errors.extend(failures); warnings.extend(notices)
                diagnostics.extend(v['numerical']['maximumNormalizedResidual']/v['numerical']['bound'] for v in fitted.values())
                if failures: continue
                for i,e in enumerate(test):
                    predictions={m:{'loss':loss(e['targets']['duration'],means[m][i],'ridge'),'absoluteError':abs(e['targets']['duration']-means[m][i])} for m in study['models']}
                    records.append({'parentGroup':e['parentGroup'],'predictions':predictions})
            summary=None; bounds=None
            if not errors and len(records)==len(item['rows']) and records:
                metrics=summaries(records,study['models'],[('M2','M1')])
                config['bootstrap']['seed']=item['seed']
                bounds=uncertainty(metrics,bootstrap_plan(item['split'],config['bootstrap']),config['bootstrap'])['intervals']['M2_vs_M1']['pooled']
                summary=metrics['pooled']['gain']['M2_vs_M1']
            result={k:item[k] for k in ['family','variant','seed','annotationSha256','observation','audit']}
            result.update({'status':'completed' if summary is not None else 'failed','gain':summary,'conditionalInterval':bounds,'flag':bool(bounds and bounds[0]>0),'failures':errors,'warnings':warnings,'maxNumericalResidualRatio':max(diagnostics,default=None)})
            runs.append(result)
            assert len(runs)<=protocol['maxRealizations']
            if len(runs)%25==0: print(f'{len(runs)}/{protocol["maxRealizations"]} realizations',flush=True)
        assert process.wait()==0, 'Generator failed'
    finally:
        if process.poll() is None: process.terminate();process.wait()
    assert len(runs)==protocol['maxRealizations']
    report={'version':protocol['version'],'protocol':protocol,'freeze':freeze,'runtime':{'node':subprocess.check_output(['node','--version'],text=True).strip(),'python':sys.version.split()[0],'packages':{p:importlib.metadata.version(p) for p in ['numpy','scipy','scikit-learn','threadpoolctl']}},'learnedFits':learned,'scenarios':aggregate(runs),'runs':runs,'limits':['Synthetic annotations only; no empirical whale data fitted.','Conditional intervals are not assumed calibrated significance tests. Coverage is not estimated.','Flags alone cannot identify direct coupling; the common-driver mechanism has none.','Realizations within a scenario have independent seeds; observation variants are paired and must not be pooled.']}
    text=json.dumps(report,indent=2,allow_nan=False)+'\n'
    if '--check' in sys.argv:
        previous=json.loads((ROOT/'results.json').read_text())
        assert report==previous, 'Reproduction differs'
    else: (ROOT/'results.json').write_text(text)
    print(json.dumps(report['scenarios'],indent=2))
if __name__=='__main__': run()
