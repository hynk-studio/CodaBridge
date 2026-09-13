"""Independent stdlib numerical check; parser-derived membership is authoritative.

Reads the preserved validated intermediate and original raw source, never applies
a second annotation acceptance policy. No fitting, source repair or file writes.
"""
import csv
import hashlib
import json
import math
import pathlib
import statistics
import sys
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parents[2]
def read(path):
    return json.loads((ROOT / path).read_text())
def sha(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()
def close(a, b):
    assert math.isfinite(a) and math.isfinite(b)
    assert math.isclose(a, b, rel_tol=1e-10, abs_tol=1e-10), (a, b)
def q(values, p):
    if not values:
        return None
    values = sorted(values)
    h = (len(values)-1)*p
    low, high = math.floor(h), math.ceil(h)
    return values[low]*(high-h) + values[high]*(h-low) if high != low else values[low]
def check_quantiles(actual, values):
    if not values:
        assert actual is None
    else:
        for key, p in [('p10', .1), ('p50', .5), ('p90', .9)]:
            close(actual[key], q(values, p))
def feature(intervals):
    duration = sum(intervals)
    mean = statistics.mean(intervals)
    return dict(durationSeconds=duration, meanIntervalSeconds=mean,
                intervalCV=statistics.pstdev(intervals)/mean,
                endpointRatio=intervals[-1]/intervals[0],
                endpointShareDifference=(intervals[-1]-intervals[0])/duration,
                gapShares=[x/duration for x in intervals])

source_hash = '1856c8bf915cc5ae6f928aaa2036cbbc6ad8840bb6e4f6a96aaeb96953215da2'
assert sha('data/context/sperm-whale-dialogues.csv') == source_hash
manifest = read('src/atlas/manifest.json')
for name in ['report', 'summary']:
    identity = manifest[name]
    path = 'public' + identity['path']
    assert sha(path) == identity['sha256']
    assert (ROOT/path).stat().st_size == identity['bytes']
atlas = read('public/style-atlas-v1/atlas.json')
assert atlas['sourceSha256'] == source_hash
assert atlas['sourceRecord'] == read('data/context/source-record.json')
assert atlas['provenance']['sourceRecordSha256'] == sha('data/context/source-record.json')
producers = atlas['provenance']['producerFiles']
for file in producers:
    assert sha(file['path']) == file['sha256']
    assert (ROOT/file['path']).stat().st_size == file['bytes']
method_hash = hashlib.sha256((json.dumps(producers, separators=(',', ':'))+'\n').encode()).hexdigest()
assert method_hash == atlas['methodSha256'] == manifest['methodSha256']
preserved = read('analysis/dialogue-transfer/inputs/validated.json')
with (ROOT/'data/context/sperm-whale-dialogues.csv').open(newline='') as f:
    raw = list(csv.DictReader(f))
assert len(raw) == 3840 and len(atlas['records']) == len(preserved['calls']) == 3790
assert atlas['exclusions'] == preserved['excluded'] and len(atlas['exclusions']) == 50
used = [r['sourceLine'] for r in atlas['records']] + [r['sourceLine'] for r in atlas['exclusions']]
assert sorted(used) == list(range(2, 3842))
features = {}
for row, original in zip(atlas['records'], preserved['calls']):
    assert {k: row[k] for k in original} == original
    assert row['raw'] == raw[row['sourceLine']-2]
    assert row['prefix'] == row['rec'][:9] and row['root'] == row['rec'][:6]
    n = int(row['raw']['nClicks'])
    intervals = [float(row['raw'][f'ICI{j}']) for j in range(1, n)]
    actual = row['features']
    assert actual['clickCount'] == n and actual['intervalsSeconds'] == intervals
    expected = feature(intervals)
    for key in ['durationSeconds', 'meanIntervalSeconds', 'intervalCV', 'endpointRatio', 'endpointShareDifference']:
        close(actual[key], expected[key])
    for a, b in zip(actual['gapShares'], expected['gapShares']):
        close(a, b)
    close(sum(actual['gapShares']), 1)
    clicks = [sum(intervals[:j]) for j in range(n)]
    assert clicks == row['clicks']
    for a, b in zip(actual['clickPositions'], [t/sum(intervals) for t in clicks]):
        close(a, b)
    assert actual['shapeInformative'] == (n > 2)
    features[row['id']] = expected

assert atlas['accounting'] == dict(sourceRows=3840, validRows=3790, excludedRows=50,
    longRows=sum(len(r['clicks'])>12 for r in atlas['records']),
    subComposerGapRows=sum(min(r['features']['intervalsSeconds'])<.04 for r in atlas['records']))
assert atlas['accounting']['longRows'] == 124 and atlas['accounting']['subComposerGapRows'] == 173
assert atlas['support'] == dict(recs=len({r['rec'] for r in atlas['records']}),
    prefixes=len({r['prefix'] for r in atlas['records']}), roots=len({r['root'] for r in atlas['records']}))
for g in atlas['groups']:
    rows = [r for r in atlas['records'] if len(r['clicks']) == g['clickCount']]
    roots = Counter(r['root'] for r in rows)
    assert g['records'] == len(rows) and g['roots'] == len(roots)
    assert g['recs'] == len({r['rec'] for r in rows}) and g['prefixes'] == len({r['prefix'] for r in rows})
    assert g['sparse'] == (len(rows) < 20 or len(roots) < 3)
    assert g['rootContributions'] == [dict(root=root, records=count, share=count/len(rows)) for root, count in sorted(roots.items())]
    assert g['largestRootShare'] == (max(roots.values())/len(rows) if rows else None)
    for key in ['durationSeconds', 'intervalCV', 'endpointRatio']:
        check_quantiles(g[key], [features[r['id']][key] for r in rows])
    for j in range(g['clickCount']-1):
        check_quantiles(g['gapShares'][j], [features[r['id']]['gapShares'][j] for r in rows])

probes = json.load(sys.stdin)
def normalized(clicks):
    return [(b-a)/(clicks[-1]-clicks[0]) for a, b in zip(clicks, clicks[1:])]
for probe in probes:
    p = normalized(probe['times'])
    scores = []
    for row in atlas['records']:
        if len(row['clicks']) != len(probe['times']):
            continue
        r = normalized(row['clicks'])
        distance = sum(abs(a-b) for a, b in zip(p, r))/len(p)
        scores.append((distance, row['sourceLine']))
    expected = sorted(scores)[:3]
    assert [line for _, line in expected] == [n['sourceLine'] for n in probe['nearest']]
    for (distance, _), result in zip(expected, probe['nearest']):
        close(distance, result['distance'])

# TEST ONLY: independent arithmetic and non-template counterexample.
close(q([1, 2, 4, 8], .1), 1.3)
assert q([], .5) is None and q([7], .9) == 7 and q([2, 2, 2], .1) == 2
close(feature([1, 3])['intervalCV'], .5)
close(feature([1, 3])['endpointRatio'], 3)
close(feature([1, 3])['endpointShareDifference'], .5)
simplex_rows = [[.8, .1, .1], [.1, .8, .1], [.1, .1, .8]]
medians = [q(list(column), .5) for column in zip(*simplex_rows)]
close(sum(medians), .3)
assert medians not in simplex_rows
print(json.dumps(dict(status='Independent stdlib verification passed', records=3790, exclusions=50,
    wholeLongRows=124, subComposerGapRows=173, countGroups=28, nearestProbes=len(probes),
    testOnlyCoordinateMedianSum=sum(medians), sourceSha256=source_hash, methodSha256=method_hash), indent=2))
