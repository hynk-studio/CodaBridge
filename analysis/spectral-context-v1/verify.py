"""Independent full-file equality accounting using Python's CSV reader."""
import csv, hashlib, json
from pathlib import Path
root = Path('analysis/spectral-context-v1')
r = json.loads((root/'verification.json').read_text())
tables = []
for source in r['sources']:
    b = (Path('data/raw/spectral-context-v1') / source['path']).read_bytes()
    assert len(b) == source['bytes'] and hashlib.sha256(b).hexdigest() == source['sha256']
    assert hashlib.sha1(f'blob {len(b)}\0'.encode()+b).hexdigest() == source['gitBlob']
    rows = list(csv.DictReader(b.decode().splitlines()))
    assert len(rows) == len({x['codanum'] for x in rows}) == 1375
    tables.append({x['codanum']: x for x in rows})
a, b = tables
assert a.keys() == b.keys()
assert len(next(iter(a.values()))) == 13
assert all(v == b[k][f] for k,row in a.items() for f,v in row.items())
assert r['counts']['agreeingPairs'] == 1375 and r['counts']['sharedFieldDifferences'] == 0
for field, label in [('URN','rawURN'), ('AIS_Data','rawAIS'), ('codatype','codaTypes'), ('handv','manualVowels')]:
    freq = {}
    for row in b.values():
        value = row[field] or '(missing)'
        freq[value] = freq.get(value, 0) + 1
    assert freq == r['summary'][label]
assert r['waveformMapping'] == 'unavailable'
print('Independent verification passed: 1375 unique pairs, 13 shared fields, 0 differences; all code counts agree.')
