"""Independent NumPy FFT and original-source byte verification (all native windows)."""
import hashlib, json, wave
from pathlib import Path
import numpy as np
r = json.loads(Path('public/native-spectrum-v1/report.json').read_text())
checked = 0
for clip in r['clips']:
    path = Path('public'+clip['original']['path']); b = path.read_bytes()
    assert hashlib.sha256(b).hexdigest() == clip['original']['sha256']
    with wave.open(str(path)) as wav:
        assert wav.getframerate() == 44100 and wav.getnchannels() == 1
        pcm = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(np.float64)/32768
    for variant in clip['variants']:
        rate = variant['rate']
        if rate == 44100: derived = pcm
        else:
            derived = np.zeros(round(len(pcm)*rate/44100), dtype=np.float32)
            cutoff = .45*rate/44100
            for start in range(0,len(derived),1024):
                t = np.arange(start,min(start+1024,len(derived)))*44100/rate
                js = np.floor(t).astype(int)[:,None] + np.arange(-48,49)[None,:]
                d = t[:,None]-js
                weights = 2*cutoff*np.sinc(2*cutoff*d)*(.5+.5*np.cos(np.pi*d/48))
                weights[abs(d)>48] = 0
                valid = (js>=0)&(js<len(pcm))
                samples = pcm[np.clip(js,0,len(pcm)-1)]*valid
                derived[start:start+len(t)] = (samples*weights).sum(axis=1)/weights.sum(axis=1)
        for e in variant['events']:
            if e['status'] != 'measured': continue
            x = derived[e['startSample']:e['startSample']+e['samples']].astype(np.float64)
            w = np.hanning(len(x)); n = 2**int(np.ceil(np.log2(len(x))))
            p = abs(np.fft.rfft((x-x.mean())*w, n))**2/(n*np.sum(w*w)); p[1:-1] *= 2
            hz = np.fft.rfftfreq(n, 1/rate); total = p.sum()
            assert abs(float((p*hz).sum()/total)-e['summary']['centroidHz']) < 1e-5
            for i,(lo,hi) in enumerate(zip([0,4000,8000,16000],[4000,8000,16000,24001])):
                assert abs(float(p[(hz>=lo)&(hz<hi)].sum()/total)-e['summary']['bandFractions'][i]) < 1e-8
            checked += 1
for entry in r['rankings']:
    for kind in ['timing','spectrum']:
        scores = entry[kind]; assert scores == sorted(scores,key=lambda x:(x['distance'],x['id']))
        if kind=='spectrum':
            a=next(c for c in r['clips'] if c['id']==entry['id']); av=next(v for v in a['variants'] if v['rate']==entry['rate'])
            for score in scores:
                c=next(c for c in r['clips'] if c['id']==score['id']); bv=next(v for v in c['variants'] if v['rate']==entry['rate'])
                d=sum(abs(x-y) for x,y in zip(av['meanEvent']['bandFractions'],bv['meanEvent']['bandFractions']))
                assert abs(d-score['distance']) < 1e-12
print(f'Independent verification passed: {checked} native/resampled marker spectra, 4 source byte bindings, every spectral rank.')
