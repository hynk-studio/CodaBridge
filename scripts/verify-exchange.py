"""Independent stdlib checks of TEST ONLY browser-delivered coda files and PCM.

No production TypeScript helper is imported; no file is modified. Python 3.9+.
"""
import argparse
import hashlib
import json
import math
import pathlib
import re
import struct
from decimal import Decimal

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = json.loads((ROOT/'src/data/recordings.json').read_text())
BOUNDARY = 'Human-created synthetic timing; animal meaning unknown; plaintext, not encrypted; authorship unverified.'
TURN_KEYS = ['id', 'exchangeId', 'role', 'alias', 'label', 'createdAt', 'message', 'phrase', 'parent']
SOURCE_KEYS = ['recordingId', 'dataset', 'sourceRevision', 'filename', 'audioSha256', 'audioBytes', 'transformations',
               'originalOffsetSeconds', 'originalClickTimesSeconds', 'annotationVersion', 'annotationMethod',
               'annotationStatus', 'humanReview', 'license', 'attribution', 'citation']
PAYLOAD_KEYS = ['format', 'version', 'protection', 'catalogVersion', 'rendererVersion', 'interpretation', 'exchangeId', 'turns', 'arrangement']


def encode(value):
    """Known-schema compact encoding; independent finite binary64 spelling.

    Python's shortest representation is reformatted to the ECMAScript decimal /
    exponent thresholds for these bounded numeric fields. No Unicode normalization.
    """
    if value is None or isinstance(value, (bool, str)):
        return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    if isinstance(value, (int, float)):
        assert math.isfinite(value)
        if value == 0:
            return '0'
        spelling = repr(value)
        if 1e-6 <= abs(value) < 1e21:
            return format(Decimal(spelling), 'f').rstrip('0').rstrip('.') if '.' in format(Decimal(spelling), 'f') else format(Decimal(spelling), 'f')
        mantissa, exponent = spelling.lower().split('e')
        return mantissa.removesuffix('.0') + 'e' + ('+' if int(exponent) >= 0 else '-') + str(abs(int(exponent)))
    if isinstance(value, list):
        return '[' + ','.join(encode(v) for v in value) + ']'
    return '{' + ','.join(encode(k) + ':' + encode(v) for k, v in value.items()) + '}'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def ordered(value, keys):
    assert set(value) == set(keys)
    return {key: value[key] for key in keys}


def source(recording_id):
    r = next(r for r in CATALOG if r['id'] == recording_id)
    return dict(zip(SOURCE_KEYS, [r['id'], r['source']['dataset'], r['source']['revision'], r['source']['filename'],
        r['audio']['sha256'], r['audio']['bytes'], r['audio']['transformations'], r['annotation']['clickTimesSeconds'][0],
        r['annotation']['clickTimesSeconds'], r['annotation']['version'], r['annotation']['method'], r['annotation']['status'],
        r['annotation']['humanReview'], r['source']['license'], r['source']['attribution'], r['source']['citation']]))


def content(turn):
    result = {key: turn[key] for key in TURN_KEYS}
    assert set(result['phrase']) == {'blocks'}
    blocks = []
    for block in result['phrase']['blocks']:
        b = ordered(block, ['id', 'times', 'spacingAfter', 'source'])
        b['source'] = ordered(b['source'], SOURCE_KEYS)
        blocks.append(b)
    result['phrase'] = {'blocks': blocks}
    if result['parent'] is not None:
        result['parent'] = ordered(result['parent'], ['turnId', 'digest'])
    return result


def validate(path):
    raw = pathlib.Path(path).read_bytes()
    assert len(raw) <= 512 * 1024
    value = json.loads(raw.decode('utf-8'))
    assert set(value) == set(PAYLOAD_KEYS + ['digest'])
    assert [value[k] for k in PAYLOAD_KEYS[:6]] == ['codabridge-exchange', 1, 'none', '2.0.0', 'click-pulse-1', BOUNDARY]
    assert re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_-]{0,63}', value['exchangeId'])
    assert 1 <= len(value['turns']) <= 8
    ids, turns, events, spans = set(), [], [], []
    gaps = value['arrangement']['gaps']
    assert value['arrangement']['kind'] == 'human-authored' and len(gaps) == len(value['turns'])-1
    assert all(math.isfinite(g) and .05 <= g <= 5 for g in gaps)
    offset = .05
    for i, t in enumerate(value['turns']):
        assert set(t) == set(TURN_KEYS + ['digest'])
        assert t['id'] not in ids and re.fullmatch(r'[a-zA-Z][a-zA-Z0-9_-]{0,63}', t['id'])
        ids.add(t['id'])
        assert t['role'] == ('B' if i % 2 else 'A') and t['exchangeId'] == value['exchangeId']
        expected_parent = None if i == 0 else {'turnId': turns[-1]['id'], 'digest': turns[-1]['digest']}
        assert t['parent'] == expected_parent
        for key, limit in [('alias', 48), ('label', 80), ('message', 2000)]:
            assert len(t[key].encode('utf-16-le')) // 2 <= limit
        blocks = t['phrase']['blocks']
        assert 1 <= len(blocks) <= 4 and len({b['id'] for b in blocks}) == len(blocks)
        phrase_span = 0
        for j, b in enumerate(blocks):
            assert b['source'] == source(b['source']['recordingId'])
            times = b['times']
            assert 2 <= len(times) <= 12 and times[0] == 0 and all(math.isfinite(x) for x in times)
            assert all(.04-1e-12 <= y-x <= 5+1e-12 for x, y in zip(times, times[1:]))
            assert .05 <= b['spacingAfter'] <= 5
            for marker, timing in enumerate(times):
                events.append(dict(turn=i+1, block=j+1, marker=marker, seconds=offset+timing))
            step = times[-1] + (b['spacingAfter'] if j < len(blocks)-1 else 0)
            offset += step
            phrase_span = phrase_span + times[-1] + (b['spacingAfter'] if j < len(blocks)-1 else 0)
        assert phrase_span <= 30
        spans.append(phrase_span)
        offset += gaps[i] if i < len(gaps) else 0
        c = content(t)
        assert sha(encode(c).encode()) == t['digest'], 'turn hash'
        turns.append(dict(c, digest=t['digest']))
    span = 0
    for i, duration in enumerate(spans):
        span = span + duration + (gaps[i] if i < len(gaps) else 0)
    assert span <= 120 and len(events) <= 384
    payload = {k: value[k] for k in PAYLOAD_KEYS}
    payload['turns'] = turns
    payload['arrangement'] = ordered(value['arrangement'], ['kind', 'gaps'])
    assert sha(encode(payload).encode()) == value['digest'], 'envelope hash'
    assert encode(dict(payload, digest=value['digest'])).encode() == raw, 'noncanonical browser file bytes'
    return value, dict(path=str(path), bytes=len(raw), sha256=sha(raw), payloadSha256=value['digest'], turns=len(turns),
        messages=[t['message'] for t in turns], sources=sorted({b['source']['recordingId'] for t in turns for b in t['phrase']['blocks']}),
        events=events, phraseSpans=spans, span=span, duration=offset+.04)


def verify_wav(path, value, report):
    raw = pathlib.Path(path).read_bytes()
    assert raw[:4] == b'RIFF' and raw[8:16] == b'WAVEfmt ' and struct.unpack_from('<I', raw, 4)[0] == len(raw)-8
    assert struct.unpack_from('<IHHIIHH', raw, 16) == (16, 1, 1, 48000, 96000, 2, 16)
    assert raw[36:40] == b'data'
    data_bytes = struct.unpack_from('<I', raw, 40)[0]
    assert data_bytes % 2 == 0
    frames = data_bytes//2
    assert frames == math.ceil(report['duration']*48000)
    pcm = struct.unpack_from('<' + str(frames) + 'h', raw, 44)
    mask = bytearray(frames)
    for event in report['events']:
        start = math.floor(event['seconds']*48000+.5)
        for i in range(576):
            if start+i < frames:
                mask[start+i] = 1
                sample = .16 * math.sin(math.pi*i/576)**2 * math.exp(-(i/48000)*240) * math.sin(2*math.pi*1400*i/48000)
                assert abs(pcm[start+i] - math.floor(sample*32767+.5)) <= 1
    assert all(sample == 0 for i, sample in enumerate(pcm) if not mask[i])
    assert max(abs(s) for s in pcm) <= math.ceil(.16*32767)
    offset = 44+data_bytes
    assert raw[offset:offset+4] == b'LIST' and raw[offset+8:offset+16] == b'INFOICMT'
    metadata_size = struct.unpack_from('<I', raw, offset+16)[0]
    assert metadata_size <= 8192
    padded = metadata_size + metadata_size % 2
    assert struct.unpack_from('<I', raw, offset+4)[0] == 12+padded
    assert len(raw) == offset+20+padded and raw[offset+20+metadata_size-1] == 0
    metadata = json.loads(raw[offset+20:offset+20+metadata_size-1])
    assert set(metadata) == {'identity', 'renderer', 'sources'}
    assert metadata['identity'] == 'Human-created synthetic timing. Animal meaning unknown. Audio does not encode the human message.'
    assert metadata['renderer'] == dict(version='click-pulse-1', sampleRate=48000, gain=.16, pulseSeconds=.012, leadSeconds=.05, tailSeconds=.04)
    assert metadata['sources'] == [source(id) for id in report['sources']]
    return dict(path=str(path), bytes=len(raw), sha256=sha(raw), sampleRate=48000, channels=1, bits=16,
        frames=frames, durationSeconds=frames/48000, independentlyCheckedPulses=len(report['events']),
        outsideScheduleIsSilent=True, sourceMetadataMatches=True, metadataContainsOnlyTechnicalSourceFields=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='+')
    parser.add_argument('--wav')
    args = parser.parse_args()
    results, previous = [], None
    for path in args.files:
        current, report = validate(path)
        if previous is not None:
            assert current['turns'][:len(previous['turns'])] == previous['turns'], 'prior turns changed'
        results.append(report)
        previous = current
    wav = verify_wav(args.wav, previous, results[-1]) if args.wav else None
    print(json.dumps(dict(status='Independent source/hash/parent/timing verification passed', files=results, wav=wav), ensure_ascii=False, indent=2))
