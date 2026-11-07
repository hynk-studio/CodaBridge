"""Independent aggregation, Wilson intervals and seed/budget accounting."""
import hashlib,json,math
from pathlib import Path
root=Path('analysis/event-simulation-v1');r=json.loads((root/'results.json').read_text());p=r['protocol']
assert len(r['runs'])==p['maxRealizations']==600
assert r['learnedFits']==6000
for path,digest in r['freeze']['files'].items():assert hashlib.sha256(Path(path).read_bytes()).hexdigest()==digest
keys={(x['family'],x['variant'],x['seed']) for x in r['runs']}; assert len(keys)==600
for s in r['scenarios']:
    runs=[x for x in r['runs'] if x['family']==s['family'] and x['variant']==s['variant']]
    expected=p['primaryRealizations'] if s['variant']=='clean' else p['observationRealizations']
    assert sorted(x['seed'] for x in runs)==list(range(p['seedStart'],p['seedStart']+expected))
    complete=[x for x in runs if x['status']=='completed']; n=len(complete)
    assert s['failed']==len(runs)-n and s['completed']==n
    if not n:continue
    flags=sum(x['conditionalInterval'][0]>0 for x in complete)
    assert flags==s['flags'] and all(x['flag']==(x['conditionalInterval'][0]>0) for x in complete)
    mean=math.fsum(x['gain'] for x in complete)/n
    assert abs(mean-s['gainMean'])<1e-12
    se=math.sqrt(math.fsum((x['gain']-mean)**2 for x in complete)/(n-1)/n)
    assert abs(se-s['gainMonteCarloSE'])<1e-12
    z=1.959963984540054;q=flags/n;den=1+z*z/n
    mid=(q+z*z/(2*n))/den;half=z*math.sqrt(q*(1-q)/n+z*z/(4*n*n))/den
    assert max(abs(a-b) for a,b in zip([mid-half,mid+half],s['flagRateWilson95']))<1e-12
    assert all(x['maxNumericalResidualRatio']<=1 for x in complete)
print('Independent verification passed: 600 runs, 6000 fits, 15 scenario means/errors/Wilson intervals, frozen inputs.')
