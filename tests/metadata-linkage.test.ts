import { test } from "node:test";
import assert from "node:assert/strict";
import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseCsv } from "../analysis/metadata-linkage-v1/csv.ts";
import { agrees, civilTime, compare, decimal, difference, format, measure } from "../analysis/metadata-linkage-v1/precision.ts";
import { compareMaor, linkMaor, maorMetadata, uniqueCompatible } from "../analysis/metadata-linkage-v1/maor.ts";
import { joinCeti, linkCeti } from "../analysis/metadata-linkage-v1/ceti.ts";
import { parseAnnotations } from "../src/lab/parse.ts";
import { checkedBytes, identity } from "../analysis/metadata-linkage-v1/io.ts";
import { AUDIT_BASE, AUDIT_SNAPSHOT, checkFrozenArtifacts, checkHistoricalFiles, checkHistoricalPreservation, frozenFiles } from "../analysis/metadata-linkage-v1/preservation-checks.ts";
import { dateCandidates } from "../analysis/metadata-linkage-v1/dates.ts";

// TEST ONLY invented metadata/annotations; no source files or results are edited.
const row = (line = 2, overrides: Record<string, string> = {}) => ({ line, raw: { REC: "testAA001_1", Whale: "2", TsTo: "516.00250", nClicks: "3", Duration: "0.3930500", ...Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`ICI${i + 1}`, i < 2 ? "0.1965250" : "0"])), Name: "TEST WHALE", Unit: "U", UnitNum: "11", IDN: "5151", Focal: "1.0", Date: "02-03-2015", TagOnTime: "11:20:26", Tag: "testAA", codaNUM2018: "1", ...overrides } });
test("TEST ONLY CSV quoted commas/newlines, physical lines and malformed input", () => {
  assert.deepEqual(parseCsv('a,b\r\n"x,y","he said ""a"""\r\n"two\nlines",\r\n'), [{ line: 2, raw: { a: "x,y", b: 'he said "a"' } }, { line: 3, raw: { a: "two\nlines", b: "" } }]);
  for (const s of ['a,a\nx,y\n', 'a,b\nx\n', 'a,b\n"x', 'a,b\n"x"z,y']) assert.throws(() => parseCsv(s));
});
test("TEST ONLY exact decimal and timezone-free nanosecond differences enforce written precision", () => {
  assert.equal(decimal("NaN"), null); assert.equal(decimal("Infinity"), null); assert.equal(decimal(""), null);
  assert.equal(decimal("3.9305e-1"), decimal("0.39305"));
  const onset = difference(civilTime("2015-02-03 11:29:02.002500000"), civilTime("2015-02-03 11:20:26"));
  assert.equal(format(onset!.value), "516.0025");
  assert.equal(compare(measure("516.0025"), onset).status, "exact");
  assert.equal(compare(measure("1.000000"), measure("1.00000049")).status, "rounding-compatible");
  assert.equal(compare(measure("1.000000"), measure("1.00000051")).status, "conflict");
  assert.equal(civilTime("2015-02-30 11:00:00"), null);
  assert.equal(civilTime("2015-02-03 11:00:00Z"), null);
  assert.equal(format(difference(civilTime("2016-03-01 00:00:00.000000001"), civilTime("2016-02-29 23:59:59.999999999"))!.value), "0.000000002");
});
test("TEST ONLY unknown labels, U unit, tag wearer versus producer are separate", () => {
  assert.equal(maorMetadata(row().raw).unitCandidate, "U");
  for (const raw of [row(2, { Focal: "0.0" }).raw, row(2, { Focal: "" }).raw, row(2, { Name: "UNID", IDN: "9999", Unit: "ZZZ" }).raw, row(2, { IDN: "0" }).raw]) assert.equal(maorMetadata(raw).producerCandidate, null);
  assert.equal(maorMetadata(row(2, { Unit: "ZZZ" }).raw).unitCandidate, null);
});
test("TEST ONLY Maor retains collisions, relabeling, full long ICIs and annotation conflicts", () => {
  const a = row(), changedCaller = row(5, { Whale: "1" });
  assert.equal(compareMaor(a, changedCaller).compatible, true);
  assert.equal(compareMaor(a, changedCaller).key.whaleEqual, false);
  assert.equal(compareMaor(a, changedCaller).key.rec, "exact-REC");
  const links = linkMaor([a], [changedCaller, row(6)]);
  assert.equal(links[0].candidates.length, 2); assert.equal(uniqueCompatible(links[0].candidates), null);
  assert.equal(linkMaor([a], [row(7, { REC: "otherA001_1" })])[0].candidates.length, 0);
  const countConflict = compareMaor(a, row(5, { nClicks: "4" }));
  assert.equal(countConflict.compatible, false); assert.equal(countConflict.countEqual, false);
  const long = row(2, { nClicks: "29", ...Object.fromEntries(Array.from({ length: 28 }, (_, i) => [`ICI${i + 1}`, "0.100000"])) });
  const late = compareMaor(long, { ...long, line: 9, raw: { ...long.raw, ICI28: "0.200000" } });
  assert.equal(late.compatible, false); assert.equal(late.iciConflicts[0].index, 28);
  assert.equal(compareMaor(a, row(7, { ICI40: "0.001" })).compatible, false);
  assert.equal(compareMaor(a, row(7, { ICI3: "0.00000001" })).compatible, false);
  const durationConflict = compareMaor(a, row(7, { Duration: "0.9900000" }));
  assert.equal(durationConflict.compatible, true); assert.equal(durationConflict.reportedDuration.status, "conflict");
});
test("TEST ONLY date ambiguity is retained; textual March does not become February", () => {
  assert.deepEqual(dateCandidates("02-03-2015"), ["2015-02-03", "2015-03-02"]);
  assert.deepEqual(dateCandidates("02-מרץ-2015"), ["2015-03-02"]);
  assert.deepEqual(dateCandidates("12-מאי-2016"), ["2016-05-12"]);
  assert.deepEqual(dateCandidates("31-03-2015"), ["2015-03-31"]);
  assert.deepEqual(dateCandidates("31-02-2015"), []);
  assert.deepEqual(dateCandidates(""), []);
});

const md = [{ line: 2, raw: { codanum: "1", focal: "True", whale: "TEST WHALE", codatype: "x", handv: "a", Duration: "0.39305" } }, { line: 3, raw: { codanum: "2", focal: "True", whale: "TEST WHALE", codatype: "x", handv: "a", Duration: "0.39305" } }];
const sp = md.map(r => ({ ...r, raw: { ...r.raw, autovpkcodastr: "aaa" } }));
const co = [{ line: 2, raw: { whale: "TEST WHALE", prevcodanum: "1", codanum: "2", prevtagondt: "2015-02-03 11:20:26", tagondt: "2015-02-03 11:20:26", prevcodadt: "2015-02-03 11:29:02.002500000", prevcodaenddt: "2015-02-03 11:29:02.395550000", codadt: "2015-02-03 11:29:07.002500000", codaenddt: "2015-02-03 11:29:07.395550000", prevclicknum: "3", clicknum: "1", deltasec: "4.60695" } }];
test("TEST ONLY CETI documented role join, sequence support, missing last count and collision rejection", () => {
  const joined = joinCeti(md, sp, co);
  assert.equal(joined.events[1].lastCount, null); assert.equal(joined.events[1].spectralCount, 3);
  assert.ok(agrees(joined.pairChecks[0].gap));
  const source = [row(), row(3, { TsTo: "521.00250" })];
  const linked = linkCeti(source, joined);
  assert.equal(linked.sequenceChecks[0].combinations[0].supported, true);
  assert.deepEqual(linked.links[1].candidates[0].sequenceLines, [2]);
  assert.equal(linked.links[1].candidates[0].lastClickPosition, null);
  const collision = linkCeti([...source, row(9)], joined);
  assert.ok(collision.sequenceChecks[0].combinations.every(c => !c.supported));
  const differentCaller = linkCeti([source[0], row(3, { TsTo: "521.00250", Whale: "1" })], joined);
  assert.equal(differentCaller.sequenceChecks[0].combinations[0].supported, false);
  const wrongTime = linkCeti([row(2, { TsTo: "500.0000" })], joined);
  assert.equal(wrongTime.links[0].candidates.length, 0); // Same duration cannot create a link.
});
test("TEST ONLY conflicting CETI duplicates and inconsistent metadata never choose a winner", () => {
  const duplicate = joinCeti([...md, md[0]], sp, co);
  assert.ok(duplicate.events[0].conflicts.includes("duplicate-codamd-ID"));
  assert.equal(linkCeti([row()], duplicate).links[0].candidates[0].compatible, false);
  const bad = joinCeti(md, [{ ...sp[0], raw: { ...sp[0].raw, whale: "DIFFERENT" } }, sp[1]], co);
  assert.ok(bad.events[0].conflicts.includes("whale-metadata-disagreement"));
  const altered = joinCeti(md, sp, [...co, { line: 9, raw: { ...co[0].raw, prevcodadt: "2015-02-03 11:29:02.003500000" } }]);
  assert.ok(altered.events[0].conflicts.includes("conflicting-timing-observations"));
  assert.equal(altered.events[0].timing, null);
});
test("Original source validation and current frozen data/results retain their recorded identities", () => {
  const parsed = parseAnnotations(readFileSync("data/context/sperm-whale-dialogues.csv", "utf8"));
  assert.equal(parsed.calls.length, 3790); assert.equal(parsed.excluded.length, 50);
  assert.equal(checkFrozenArtifacts().frozenFiles, frozenFiles().length);
});
test("TEST ONLY application edits pass the current guard; changed frozen source, cohort and results fail", () => {
  const dir = mkdtempSync(join(tmpdir(), "codabridge-metadata-frozen-test-"));
  try {
    // Private copies only: never edit an owner file, even while other tests run.
    for (const f of frozenFiles()) {
      const destination = join(dir, f.path);
      mkdirSync(dirname(destination), { recursive: true }); copyFileSync(f.path, destination);
    }
    const applicationPaths = ["src/App.tsx", "src/composer/Composer.tsx", "src/styles.css", "server/worker.ts"];
    for (const path of applicationPaths) {
      const destination = join(dir, path);
      mkdirSync(dirname(destination), { recursive: true });
      copyFileSync(path, destination);
    }
    const before = checkFrozenArtifacts(dir);
    for (const path of applicationPaths) appendFileSync(join(dir, path), "\n/* TEST ONLY legitimate application edit, outside frozen artifacts */\n");
    assert.deepEqual(checkFrozenArtifacts(dir), before);
    for (const path of ["data/context/sperm-whale-dialogues.csv", "analysis/dialogue-transfer/inputs/cohort.json",
      "analysis/dialogue-transfer-v02/inputs/core.json", "analysis/dialogue-transfer-v02/results/fold-fits.json",
      "public/prediction/dialogue-transfer-report.json", "docs/dialogue-transfer-v0.2/browser-delivered.json",
      "analysis/metadata-linkage-v1/results/candidate-mapping.json", "analysis/metadata-linkage-v1/protocol.json",
      "analysis/metadata-linkage-v1/preservation-manifest.json", "docs/metadata-linkage-v1/manifest.json"]) {
      const destination = join(dir, path);
      writeFileSync(destination, "TEST ONLY tampered frozen bytes\n");
      assert.throws(() => checkFrozenArtifacts(dir), { message: new RegExp(`${path.replaceAll(".", "\\.")}.*SHA-256 mismatch`) });
      copyFileSync(path, destination);
    }
    unlinkSync(join(dir, "analysis/dialogue-transfer-v02/inputs/coverage.json"));
    assert.throws(() => checkFrozenArtifacts(dir), /ENOENT.*coverage\.json/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("TEST ONLY historical preservation checks both recorded snapshots and rejects missing/tampered bytes", () => {
  const dir = mkdtempSync(join(tmpdir(), "codabridge-metadata-history-test-"));
  const bytes = Buffer.from("TEST ONLY historical source\n");
  const files = ["src/App.tsx", "data/source.csv"].map(path => ({ path, ...identity(bytes) }));
  const read = (revision: string, path: string) => readFileSync(join(dir, revision, path));
  try {
    for (const revision of [AUDIT_BASE, AUDIT_SNAPSHOT]) for (const f of files) {
      const path = join(dir, revision, f.path);
      mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes);
    }
    checkHistoricalFiles(files, read);
    for (const revision of [AUDIT_BASE, AUDIT_SNAPSHOT]) {
      const path = join(dir, revision, files[0].path);
      writeFileSync(path, "TEST ONLY tampered historical application\n");
      assert.throws(() => checkHistoricalFiles(files, read), new RegExp(`${revision}:src/App.tsx: SHA-256 mismatch`));
      unlinkSync(path); assert.throws(() => checkHistoricalFiles(files, read), /ENOENT/);
      writeFileSync(path, bytes);
    }
    // Removing entries or replacing the full manifest cannot weaken the historical claim.
    assert.throws(() => checkHistoricalPreservation(read), /ENOENT.*preservation-manifest\.json/);
    const manifestPath = join(dir, AUDIT_SNAPSHOT, "analysis/metadata-linkage-v1/preservation-manifest.json");
    mkdirSync(dirname(manifestPath), { recursive: true });
    writeFileSync(manifestPath, JSON.stringify({ base: AUDIT_BASE, files: [] }));
    assert.throws(() => checkHistoricalPreservation(read), /preservation-manifest\.json: SHA-256 mismatch/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("TEST ONLY missing or tampered source bytes fail before completed audit output", () => {
  const dir = mkdtempSync(join(tmpdir(), "codabridge-metadata-test-")), file = join(dir, "synthetic.csv");
  try {
    const expected = identity(Buffer.from("TEST ONLY\n"));
    assert.throws(() => checkedBytes(file, expected), /ENOENT/);
    writeFileSync(file, "TEST ONLY\n"); assert.equal(checkedBytes(file, expected).length, 10);
    writeFileSync(file, "TEST CHANGED\n"); assert.throws(() => checkedBytes(file, expected));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test("Saved full-file audit reproduces all 25 seed events with count source evidence", () => {
  const mapping = JSON.parse(readFileSync("analysis/metadata-linkage-v1/results/candidate-mapping.json", "utf8"));
  const seed = mapping.seedReproduction as { sourceLine: number; rec: string; caller: string; codanum: string; compatible: boolean; sequenceSupported: boolean; whale: string; tagOn: string; onset: string; duration: string; lastClickPosition: number | null; lastClickEvidence: { coartLine: number; role: string; position: number }[] }[];
  assert.equal(seed.length, 25);
  for (const [rec, n] of Object.entries({ sw061b001_513: 15, sw061b001_629: 4, sw061b001_4333: 6 })) assert.equal(seed.filter(s => s.rec === rec).length, n);
  for (const s of seed) {
    assert.ok(s.compatible && s.sequenceSupported); assert.equal(s.caller, "1"); assert.equal(s.whale, "ATWOOD"); assert.equal(s.tagOn, "2015-02-03 11:20:26");
    assert.ok(s.lastClickEvidence.length && s.lastClickEvidence.every(e => e.role === "previous" && e.position === s.lastClickPosition));
  }
  const example = seed.find(s => s.sourceLine === 56)!;
  assert.equal(example.codanum, "4985"); assert.equal(example.onset, "516.0025"); assert.equal(example.duration, "0.39305"); assert.equal(example.lastClickPosition, 9);
  const coverage = JSON.parse(readFileSync("analysis/metadata-linkage-v1/results/coverage.json", "utf8"));
  for (const key of ["core", "coverage"]) assert.equal(coverage.cohorts[key].exampleStatus["fully-identified-candidate"], 0);
  const report = JSON.parse(readFileSync("analysis/metadata-linkage-v1/results/report.json", "utf8"));
  assert.equal("undefined" in report.maor.keyScopes, false);
});
