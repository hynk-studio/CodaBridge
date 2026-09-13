"""Independent stdlib CSV/Decimal reconstruction; never imports the TS matcher.

No fitting, numpy, pickle, notebook execution or result mutation. Original
validity is read from the preserved parseAnnotations intermediate, not redefined.
"""
import csv
import hashlib
import json
import re
from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal, localcontext
from functools import cache
from pathlib import Path

ROOT = Path("analysis/metadata-linkage-v1")
D = Decimal


def read(path):
    return json.loads(Path(path).read_text())


def check(condition, label):
    if not condition:
        raise AssertionError(label)


def equal(a, b, label):
    if a != b:
        raise AssertionError(f"{label}: {a!r} != {b!r}")


def identity(path):
    b = Path(path).read_bytes()
    return dict(bytes=len(b), sha256=hashlib.sha256(b).hexdigest(),
                gitBlob=hashlib.sha1(f"blob {len(b)}\0".encode() + b).hexdigest())


def csv_rows(path):
    with Path(path).open(newline="") as f:
        reader = csv.DictReader(f)
        _ = reader.fieldnames
        result, previous_end = [], reader.line_num
        for row in reader:
            result.append((previous_end + 1, row))
            previous_end = reader.line_num
    return result


@cache
def measured(s):
    if not re.fullmatch(r"[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?", s):
        return None
    value = D(s)
    return value, D("0.5") * D(10) ** value.as_tuple().exponent


def comparison(a, b):
    if a is None or b is None:
        return "missing", None, None
    delta, allowance = b[0] - a[0], a[1] + b[1]
    return ("exact" if delta == 0 else "rounding-compatible" if abs(delta) <= allowance else "conflict", delta, allowance)


def agrees(a, b):
    return comparison(a, b)[0] in ("exact", "rounding-compatible")


def check_comparison(saved, a, b, label):
    status, delta, allowance = comparison(a, b)
    equal(saved["status"], status, label + " status")
    equal(None if saved["delta"] is None else D(saved["delta"]), delta, label + " delta")
    equal(None if saved["allowance"] is None else D(saved["allowance"]), allowance, label + " allowance")


def ici_sum(row, maximum):
    n = int(row["nClicks"])
    if not 1 <= n <= maximum + 1:
        return None
    intervals = [measured(row[f"ICI{i}"]) for i in range(1, n)]
    if any(v is None for v in intervals):
        return None
    return sum((v[0] for v in intervals), D(0)), sum((v[1] for v in intervals), D(0))


@cache
def civil(s):
    base, _, fraction = s.partition(".")
    dt = datetime.strptime(base, "%Y-%m-%d %H:%M:%S") - datetime(1970, 1, 1)
    return D(dt.days * 86400 + dt.seconds) + D("0." + (fraction or "0")), D("0.5") * D(10) ** -len(fraction) if fraction else D(0)


def difference(a, b):
    return a[0] - b[0], a[1] + b[1]


def date_candidates(s):
    match = re.fullmatch(r"(\d{2})-(\d{2}|מרץ|מאי)-(\d{4})", s)
    if not match:
        return []
    a, month, year = match.groups()
    months = {"מרץ": 3, "מאי": 5}
    a, y, b = int(a), int(year), months.get(month, int(month) if month.isdigit() else 0)
    pairs = [(b, a)] if month in months else [(b, a), (a, b)]
    result = set()
    for mo, day in pairs:
        try:
            result.add(datetime(y, mo, day).strftime("%Y-%m-%d"))
        except ValueError:
            pass
    return sorted(result)


def main():
    manifests = read(ROOT / "retrieval-manifest.json")
    for s in manifests:
        equal(identity(s["cachePath"]), {k: s[k] for k in ("bytes", "sha256", "gitBlob")}, s["id"])
    preserved = read(ROOT / "preservation-manifest.json")
    for f in preserved["files"]:
        equal(identity(f["path"]), {k: f[k] for k in ("bytes", "sha256", "gitBlob")}, f["path"])
    report, mapping, coverage = [read(ROOT / "results" / f) for f in ("report.json", "candidate-mapping.json", "coverage.json")]
    for f in report["provenance"]["producerFiles"] + report["provenance"]["cohortFiles"]:
        equal(identity(f["path"])["sha256"], f["sha256"], f["path"])
    original = csv_rows("data/context/sperm-whale-dialogues.csv")
    files = {s["id"]: s["cachePath"] for s in manifests}
    maor = csv_rows(files["maor/dataset/dswp-2014-2016-retagged-maor-2025.csv"])
    md, sp, co = [csv_rows(files["ceti/" + f]) for f in ("codamd.csv", "codasp.csv", "focal-coarticulation-metadata.csv")]
    mdi, spi = {r["codanum"]: (line, r) for line, r in md}, {r["codanum"]: (line, r) for line, r in sp}
    equal(len(mdi), len(md), "actual codamd unique IDs")
    equal(len(spi), len(sp), "actual codasp unique IDs")
    equal(set(mdi), set(spi), "actual metadata/spectral ID support")
    times, last_counts, observations = defaultdict(set), defaultdict(set), defaultdict(list)
    for line, r in co:
        for p in ("prev", ""):
            key = r[p + "codanum"]
            times[key].add((r["whale"], r[p + "tagondt"], r[p + "codadt"], r[p + "codaenddt"]))
            observations[key].append(line)
            if p and r["prevclicknum"]:
                last_counts[key].add(int(r["prevclicknum"]))
    events = {}
    for key in sorted(set(mdi) | set(spi) | set(times), key=int):
        # Pinned actual file has no ambiguous metadata; mutations are covered by
        # TEST ONLY TS diagnostics. Verify this fact instead of choosing a row.
        check(len(times[key]) <= 1 and len(last_counts[key]) <= 1, f"Actual ambiguous CETI ID {key}")
        _, meta = mdi[key]
        _, spectral = spi[key]
        for field in ("whale", "focal", "codatype", "handv"):
            equal(meta[field], spectral[field], f"{key}/{field}")
        spectral_count = len(spectral["autovpkcodastr"]) if re.fullmatch("[ai]+", spectral["autovpkcodastr"]) else None
        count = next(iter(last_counts[key]), None)
        if count is not None:
            equal(count, spectral_count, f"{key}/independent counts")
        timing = next(iter(times[key]), None)
        relative = duration = None
        if timing:
            name, tag, onset, end = timing
            equal(name, meta["whale"], f"{key}/timed name")
            relative = difference(civil(onset), (civil(tag)[0], D(0)))
            duration = difference(civil(end), civil(onset))
            check(agrees(measured(meta["Duration"]), duration), f"{key}/metadata duration")
        events[key] = dict(relative=relative, duration=duration, count=count, spectralCount=spectral_count, timing=timing, name=meta["whale"] or None)
    equal([e["codanum"] for e in mapping["cetiEvents"]], list(events), "complete CETI event enumeration")
    for stored_event in mapping["cetiEvents"]:
        key = stored_event["codanum"]
        equal(stored_event["metadataLines"], [mdi[key][0]], key + "/metadata binding")
        equal(stored_event["spectralLines"], [spi[key][0]], key + "/spectral binding")
        equal(stored_event["coartLines"], sorted(set(observations[key])), key + "/all timing bindings")
        equal(stored_event["lastClickPosition"], events[key]["count"], key + "/missing count preserved")
        equal(stored_event["spectralClickLabels"], events[key]["spectralCount"], key + "/separate spectral count")
        equal(stored_event["timingVariants"], len(times[key]), key + "/timing availability")
    saved = {r["sourceLine"]: r for r in mapping["rows"]}
    expected_bridges = [(line, r) for line, r in maor if r["codaNUM2018"] in events]
    equal([b["maorLine"] for b in mapping["namespaceBridges"]], [line for line, _ in expected_bridges], "all numeric namespace bridges")
    for bridge, (line, row) in zip(mapping["namespaceBridges"], expected_bridges):
        key = row["codaNUM2018"]
        event, (_, meta) = events[key], mdi[key]
        equal(bridge["codanum"], key, f"bridge {line}/ID")
        equal(bridge["metadataLines"], [mdi[key][0]], f"bridge {line}/metadata line")
        check_comparison(bridge["duration"][0], measured(row["Duration"]), measured(meta["Duration"]), f"bridge {line}/duration")
        equal(bridge["countEqual"], None if event["spectralCount"] is None else int(row["nClicks"]) == event["spectralCount"], f"bridge {line}/count")
        equal(bridge["nameEqual"], None if event["name"] is None else row["Name"] == event["name"], f"bridge {line}/name")
        equal(bridge["focalEqual"], (row["Focal"] in ("1", "1.0")) == (meta["focal"] == "True"), f"bridge {line}/focal")
        check_comparison(bridge["onset"], measured(row["TsTo"]), event["relative"], f"bridge {line}/onset")
        equal(bridge["maorDateCandidates"], date_candidates(row["Date"]), f"bridge {line}/unresolved dates")
    equal(set(saved), {line for line, _ in original}, "full original enumeration")
    maor_roots = defaultdict(list)
    for line, r in maor:
        maor_roots[r["REC"][:6]].append((line, r))
    maor_good, ceti_good, maor_candidates, ceti_candidates = {}, {}, {}, {}
    maor_reverse, ceti_reverse = defaultdict(list), defaultdict(list)
    key_counts, onset_counts = Counter(), Counter()
    for line, r in original:
        expected_m = [(ml, m) for ml, m in maor_roots[r["REC"][:6]] if agrees(measured(r["TsTo"]), measured(m["TsTo"]))]
        equal([x["maorLine"] for x in saved[line]["maor"]], [l for l, _ in expected_m], f"row {line}/all Maor candidates")
        maor_candidates[line], maor_good[line] = expected_m, []
        for sc, (ml, m) in zip(saved[line]["maor"], expected_m):
            label = f"row {line}/Maor {ml}"
            scope = "exact-REC" if r["REC"] == m["REC"] else "same-nine-character-file" if r["REC"][:9] == m["REC"][:9] else "same-six-character-root"
            equal(sc["key"]["rec"], scope, label + "/scope"); key_counts[scope] += 1
            equal(sc["key"]["whaleEqual"], r["Whale"] == m["Whale"], label + "/Whale")
            check_comparison(sc["key"]["onset"], measured(r["TsTo"]), measured(m["TsTo"]), label + "/onset")
            onset_counts[sc["key"]["onset"]["status"]] += 1
            statuses, conflicts = [], []
            for i in range(1, 29):
                a, b = measured(r[f"ICI{i}"]), measured(m[f"ICI{i}"])
                if a[0] == 0 or b[0] == 0:
                    a, b = (a[0], D(0)), (b[0], D(0))
                status = comparison(a, b)[0]; statuses.append(status)
                if not agrees(a, b):
                    conflicts.append(i)
                    check_comparison(next(v for v in sc["iciConflicts"] if v["index"] == i), a, b, label + f"/ICI{i}")
            equal([v["index"] for v in sc["iciConflicts"]], conflicts, label + "/all ICI conflicts")
            equal(sc["iciExact"], statuses.count("exact"), label + "/exact ICIs")
            equal(sc["iciRounded"], statuses.count("rounding-compatible"), label + "/rounded ICIs")
            extra = [i for i in range(29, 41) if D(m[f"ICI{i}"]) != 0]
            equal(sc["extraNonzeroIcis"], extra, label + "/extra ICIs")
            check_comparison(sc["reportedDuration"], measured(r["Duration"]), measured(m["Duration"]), label + "/reported duration")
            check_comparison(sc["iciDuration"], ici_sum(r, 28), ici_sum(m, 40), label + "/ICI duration")
            good = int(r["nClicks"]) == int(m["nClicks"]) and not conflicts and not extra
            equal(sc["compatible"], good, label + "/compatibility")
            if good:
                maor_good[line].append((ml, m)); maor_reverse[ml].append(line)
        expected_c = [(key, e) for key, e in events.items() if agrees(measured(r["TsTo"]), e["relative"])]
        equal([v["codanum"] for v in saved[line]["ceti"]], [key for key, _ in expected_c], f"row {line}/all CETI onset candidates")
        ceti_candidates[line], ceti_good[line] = expected_c, []
        for sc, (key, e) in zip(saved[line]["ceti"], expected_c):
            label = f"row {line}/CETI {key}"
            check_comparison(sc["onset"], measured(r["TsTo"]), e["relative"], label + "/onset")
            check_comparison(sc["wholeDuration"], ici_sum(r, 28), e["duration"], label + "/whole duration")
            check_comparison(sc["declaredDuration"], measured(r["Duration"]), e["duration"], label + "/declared duration")
            equal(sc["lastClickPosition"], e["count"], label + "/available last click")
            equal(sc["spectralClickLabels"], e["spectralCount"], label + "/separate spectral count")
            count_good = e["count"] is None or e["count"] == int(r["nClicks"])
            spectral_good = e["spectralCount"] is None or e["spectralCount"] == int(r["nClicks"])
            good = agrees(ici_sum(r, 28), e["duration"]) and count_good and spectral_good
            equal(sc["compatible"], good, label + "/compatibility")
            if good:
                ceti_good[line].append(key); ceti_reverse[key].append(line)
    equal(dict(key_counts), report["maor"]["keyScopes"], "key scope summary")
    equal(dict(onset_counts), report["maor"]["onsetAgreement"], "onset summary")
    originals = dict(original); supported = defaultdict(list)
    equal(len(mapping["sequenceChecks"]), len(co), "all coarticulation pairs enumerated")
    for (line, r), pair in zip(co, mapping["sequenceChecks"]):
        equal(pair["line"], line, "coart line")
        gap = difference(civil(r["codadt"]), civil(r["prevcodaenddt"]))
        check_comparison(pair["gap"], measured(r["deltasec"]), gap, f"coart {line}/gap")
        a, b = ceti_reverse[r["prevcodanum"]], ceti_reverse[r["codanum"]]
        combinations = []
        for x in a:
            for y in b:
                ra, rb = originals[x], originals[y]
                local = (ra["REC"], ra["Whale"]) == (rb["REC"], rb["Whale"])
                ordered = D(ra["TsTo"]) < D(rb["TsTo"])
                single = len(a) == len(b) == 1
                good = single and local and ordered and r["prevtagondt"] == r["tagondt"] and r["clicknum"] == "1" and agrees(measured(r["deltasec"]), gap)
                combinations.append(dict(previousRow=x, currentRow=y, sameLocalCaller=local, ordered=ordered, unique=single, supported=good))
                if good:
                    supported[(x, r["prevcodanum"])].append(line); supported[(y, r["codanum"])].append(line)
        equal(pair["combinations"], combinations, f"coart {line}/ordered local pair")
    valid = {c["sourceLine"] for c in read("analysis/dialogue-transfer/inputs/validated.json")["calls"]}
    reconstructed = {}
    for line, r in original:
        mm = maor_good[line]
        mc = mm[0] if len(mm) == 1 and len(maor_reverse[mm[0][0]]) == 1 else None
        cc = ceti_good[line]
        ci = cc[0] if len(cc) == 1 and len(ceti_reverse[cc[0]]) == 1 else None
        for candidate in saved[line]["ceti"]:
            equal(candidate["sequenceLines"], supported[(line, candidate["codanum"])], f"row {line}/sequence evidence")
        strict = events[ci]["name"] if ci and supported[(line, ci)] else None
        name, unit = None, None
        if mc:
            m = mc[1]
            if m["Focal"] in ("1", "1.0") and m["Name"].strip().upper() not in ("", "UNID", "UNKNOWN", "NA", "N/A") and m["IDN"].strip().upper() not in ("", "0", "9999", "NA", "N/A"):
                name = m["Name"].strip()
                if m["Unit"].strip().upper() not in ("", "ZZZ", "UNKNOWN", "NA", "N/A"):
                    unit = m["Unit"].strip()
        names = {x for x in (strict, name) if x}
        combined = next(iter(names)) if len(names) == 1 else None
        checks = dict(validated=line in valid, maorUniqueCompatibleLine=mc[0] if mc else None, cetiUniqueCompatibleId=ci,
                      maorFocalIdentityCandidate=name, cetiSequenceIdentity=strict, producerCandidate=combined, unitCandidate=unit if len(names) == 1 else None, identityConflict=len(names) > 1)
        for key, value in checks.items():
            equal(saved[line][key], value, f"row {line}/{key}")
        reconstructed[line] = checks
    def counts(lines):
        data = [reconstructed[l] for l in lines]
        return dict(rows=len(lines), maorEventCandidates=sum(bool(maor_candidates[l]) for l in lines),
                    maorUniqueCompatible=sum(r["maorUniqueCompatibleLine"] is not None for r in data), cetiTimedCompatible=sum(r["cetiUniqueCompatibleId"] is not None for r in data),
                    cetiSequenceIdentified=sum(r["cetiSequenceIdentity"] is not None for r in data), maorFocalNamedCandidates=sum(r["maorFocalIdentityCandidate"] is not None for r in data),
                    namedProducerCandidates=sum(r["producerCandidate"] is not None for r in data), unitCandidates=sum(r["unitCandidate"] is not None for r in data), identityConflicts=sum(r["identityConflict"] for r in data))
    equal(counts(list(originals)), coverage["raw"], "all raw coverage")
    equal(counts(sorted(valid)), coverage["validated"], "validated coverage")
    equal(coverage["raw"], report["rawCoverage"], "report raw coverage")
    equal(coverage["validated"], report["validatedCoverage"], "report validated coverage")
    folds = read("analysis/dialogue-transfer-v02/coverage-split.json")["assignments"]
    for root in coverage["roots"]:
        root_lines = [line for line, row in original if row["REC"][:6] == root["root"]]
        equal(root["coverage"], counts(root_lines), root["root"] + "/coverage")
        equal(root["fold"], folds.get(root["root"]), root["root"] + "/unchanged fold")
        equal(root["namedProducerCandidates"], sorted({reconstructed[line]["producerCandidate"] for line in root_lines if reconstructed[line]["producerCandidate"] is not None}), root["root"] + "/candidate names")
        raw_dates = {row["Date"] for _, row in maor if row["Tag"] == root["root"]}
        equal(root["maorDatesAsWritten"], sorted(raw_dates), root["root"] + "/raw dates")
        equal(root["maorDateCandidates"], sorted({d for s in raw_dates for d in date_candidates(s)}), root["root"] + "/date candidates")
    statuses = ("fully-identified-candidate", "partly-identified-candidate", "unidentified")
    def status(lines, field):
        n = sum(reconstructed[l][field] is not None for l in lines)
        return statuses[0] if n == len(lines) else statuses[1] if n else statuses[2]
    for key in ("core", "coverage"):
        examples = read(f"analysis/dialogue-transfer-v02/inputs/{key}.json")
        result = coverage["cohorts"][key]
        equal(result["examples"], len(examples), key + "/size")
        equal(len(result["records"]), len(examples), key + "/all examples enumerated")
        roles_all, all_used = defaultdict(list), set()
        counts_status, strict_status, available_status = Counter(), Counter(), Counter()
        for e, stored in zip(examples, result["records"]):
            previous = [l for l in e["selfRows"] if l != e["currentRow"]]
            lagged = e["laggedRows"] if key == "core" else []
            history = sorted(set(previous + e["recentRows"] + lagged))
            roles = dict(current=[e["currentRow"]], target=[e["targetRow"]], previousFocal=previous, recentPartner=e["recentRows"], laggedPartner=lagged,
                         featureHistory=history, allCompletedPartnerHistory=sorted(set(e["completedPartnerRows"])))
            used = sorted(set([e["currentRow"], e["targetRow"]] + history))
            check(set(used).issubset(valid), e["id"] + "/validated bindings")
            equal(stored["id"], e["id"], key + "/example ID")
            equal(stored["fold"], folds[e["parentGroup"]], e["id"] + "/unchanged fold")
            equal(stored["roles"], roles, e["id"] + "/role bindings")
            equal(stored["usedRows"], used, e["id"] + "/used rows")
            s, strict = status(used, "producerCandidate"), status(used, "cetiSequenceIdentity")
            available = status(set(used + e["completedPartnerRows"]), "producerCandidate")
            equal(stored["status"], s, e["id"] + "/candidate coverage")
            equal(stored["strictCetiStatus"], strict, e["id"] + "/strict coverage")
            equal(stored["allAvailableStatus"], available, e["id"] + "/available coverage")
            counts_status[s] += 1; strict_status[strict] += 1; available_status[available] += 1
            for role, lines in roles.items():
                roles_all[role].extend(lines)
            all_used.update(used)
        for role, lines in roles_all.items():
            equal(result["roles"][role], dict(occurrences=counts(lines), distinctRows=counts(sorted(set(lines)))), key + "/" + role)
        equal(result["usedDistinctRows"], counts(sorted(all_used)), key + "/distinct used rows")
        for field, values in (("exampleStatus", counts_status), ("strictCetiStatus", strict_status), ("allAvailableStatus", available_status)):
            equal(result[field], {s: values[s] for s in statuses}, key + "/" + field)
    seed = mapping["seedReproduction"]
    equal(len(seed), 25, "seed full-file event count")
    equal(Counter(s["rec"] for s in seed), Counter({"sw061b001_513": 15, "sw061b001_629": 4, "sw061b001_4333": 6}), "seed REC coverage")
    check(all(s["compatible"] and s["sequenceSupported"] and s["caller"] == "1" and s["whale"] == "ATWOOD" and s["tagOn"] == "2015-02-03 11:20:26" for s in seed), "seed identity/timing claims")
    for s in seed:
        for evidence in s["lastClickEvidence"]:
            cr = dict(co)[evidence["coartLine"]]
            equal((cr["prevcodanum"], int(cr["prevclicknum"])), (s["codanum"], evidence["position"]), f"seed {s['codanum']}/source count evidence")
    row56 = next(s for s in seed if s["sourceLine"] == 56)
    equal((row56["codanum"], D(row56["onset"]), D(row56["duration"]), row56["lastClickPosition"]), ("4985", D("516.0025"), D(".39305"), 9), "concrete row56")
    print(json.dumps(dict(status="Independent Decimal/CSV mapping and coverage verification passed", preservedFiles=len(preserved["files"]), rawRows=len(original),
                          maorCompatible=sum(len(v) for v in maor_good.values()), cetiCompatible=sum(len(v) for v in ceti_good.values()),
                          sequenceSupportedEvents=sum(bool(v) for v in supported.values()), seedEvents=len(seed)), indent=2))


if __name__ == "__main__":
    with localcontext() as context:
        context.prec = 70
        main()
