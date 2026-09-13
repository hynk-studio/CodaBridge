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
def check_float_vector(actual, expected):
    # Check structure and all values before zip/tolerance can hide a bad tail.
    assert len(actual) == len(expected), (len(actual), len(expected))
    assert all(math.isfinite(value) for value in actual)
    assert all(math.isfinite(value) for value in expected)
    for a, b in zip(actual, expected):
        close(a, b)
def check_clicks(actual, intervals):
    # Independent stdlib sums may differ from JS ordered addition (Python 3.12+).
    expected = [sum(intervals[:j]) for j in range(len(intervals)+1)]
    check_float_vector(actual, expected)
    return expected
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

def check_record(row, original, raw):
    # Copies of source/parser evidence remain exact, including stored clicks.
    assert {k: row[k] for k in original} == original, 'preserved row mismatch'
    assert row['raw'] == raw, 'raw source binding mismatch'
    assert row['prefix'] == row['rec'][:9] and row['root'] == row['rec'][:6]
    n = int(raw['nClicks'])
    intervals = [float(raw[f'ICI{j}']) for j in range(1, n)]
    actual = row['features']
    # Direct decimal parsing is exact; these values have not been accumulated.
    assert actual['clickCount'] == n and actual['intervalsSeconds'] == intervals
    expected = feature(intervals)
    for key in ['durationSeconds', 'meanIntervalSeconds', 'intervalCV', 'endpointRatio', 'endpointShareDifference']:
        close(actual[key], expected[key])
    check_float_vector(actual['gapShares'], expected['gapShares'])
    close(sum(actual['gapShares']), 1)
    clicks = check_clicks(row['clicks'], intervals)
    check_float_vector(actual['clickPositions'], [t/expected['durationSeconds'] for t in clicks])
    assert actual['shapeInformative'] == (n > 2)
    return expected

def check_root_contributions(group, roots):
    expected = sorted(roots.items())
    assert len(group['rootContributions']) == len(expected)
    for actual, (root, count) in zip(group['rootContributions'], expected):
        assert set(actual) == {'root', 'records', 'share'}
        assert actual['root'] == root and actual['records'] == count
        close(actual['share'], count/group['records'])
    if expected:
        close(group['largestRootShare'], max(roots.values())/group['records'])
    else:
        assert group['largestRootShare'] is None

def ordered_sum(values):
    # Ranking needs the public JS left fold, not Python 3.12+'s compensated sum.
    total = 0.0
    for value in values:
        total += value
    return total

def normalized(clicks):
    return [(b-a)/(clicks[-1]-clicks[0]) for a, b in zip(clicks, clicks[1:])]

def nearest_scores(times, records):
    p = normalized(times)
    scores = []
    for row in records:
        n = int(row['raw']['nClicks'])
        if n != len(times):
            continue
        intervals = [float(row['raw'][f'ICI{j}']) for j in range(1, n)]
        # Independently reproduce parseAnnotations' operator order from raw ICIs.
        clicks = [ordered_sum(intervals[:j]) for j in range(n)]
        r = normalized(clicks)
        distance = ordered_sum(abs(a-b) for a, b in zip(p, r))/len(p)
        scores.append((distance, row['sourceLine']))
    # Exact distance first; source line only breaks exact ties. No fuzzy ties.
    return sorted(scores)[:3]

def verify(probes):
    source_hash = '1856c8bf915cc5ae6f928aaa2036cbbc6ad8840bb6e4f6a96aaeb96953215da2'
    assert sha('data/context/sperm-whale-dialogues.csv') == source_hash, 'source SHA-256 mismatch'
    manifest = read('src/atlas/manifest.json')
    for name in ['report', 'summary']:
        identity = manifest[name]
        path = 'public' + identity['path']
        assert sha(path) == identity['sha256'], path + ': SHA-256 mismatch'
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
        features[row['id']] = check_record(row, original, raw[row['sourceLine']-2])

    assert atlas['accounting'] == dict(sourceRows=3840, validRows=3790, excludedRows=50,
        longRows=sum(len(r['clicks'])>12 for r in atlas['records']),
        subComposerGapRows=sum(min(r['features']['intervalsSeconds'])<.04 for r in atlas['records']))
    assert atlas['accounting']['longRows'] == 124 and atlas['accounting']['subComposerGapRows'] == 173
    assert atlas['support'] == dict(recs=len({r['rec'] for r in atlas['records']}),
        prefixes=len({r['prefix'] for r in atlas['records']}), roots=len({r['root'] for r in atlas['records']}))
    assert [g['clickCount'] for g in atlas['groups']] == list(range(2, 30))
    for g in atlas['groups']:
        rows = [r for r in atlas['records'] if len(r['clicks']) == g['clickCount']]
        roots = Counter(r['root'] for r in rows)
        assert g['records'] == len(rows) and g['roots'] == len(roots)
        assert g['recs'] == len({r['rec'] for r in rows}) and g['prefixes'] == len({r['prefix'] for r in rows})
        assert g['sparse'] == (len(rows) < 20 or len(roots) < 3)
        check_root_contributions(g, roots)
        for key in ['durationSeconds', 'intervalCV', 'endpointRatio']:
            check_quantiles(g[key], [features[r['id']][key] for r in rows])
        assert len(g['gapShares']) == g['clickCount']-1
        for j in range(g['clickCount']-1):
            check_quantiles(g['gapShares'][j], [features[r['id']]['gapShares'][j] for r in rows])

    assert len(probes) == 51
    for probe in probes:
        expected = nearest_scores(probe['times'], atlas['records'])
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
    return dict(status='Independent stdlib verification passed', records=3790, exclusions=50,
        wholeLongRows=124, subComposerGapRows=173, countGroups=28, nearestProbes=len(probes),
        testOnlyCoordinateMedianSum=sum(medians), sourceSha256=source_hash, methodSha256=method_hash)


if __name__ == '__main__':
    print(json.dumps(verify(json.load(sys.stdin)), indent=2))
