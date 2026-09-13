import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseAnnotations } from "../src/lab/parse.ts";
import { atlasRecord, featuresFromIntervals, featuresFromTiming, quantile, summarizeGroup, nearestReferences, timingFromClicks, compareWithAtlas, timingBinding, type AtlasRecord } from "../src/atlas/model.ts";
import { ATLAS_MANIFEST, checkedAsset, validateAtlas, validateSummary } from "../src/atlas/load.ts";
import { annotationSchedule, renderAnnotation } from "../src/atlas/sound.ts";
import { createDraft, commitDraft, applyOperations, travel } from "../src/composer/model.ts";
import { projectJson, parseProject } from "../src/composer/project.ts";

const parsed = parseAnnotations(readFileSync("data/context/sperm-whale-dialogues.csv", "utf8"));
const summary = validateSummary(JSON.parse(readFileSync("public/style-atlas-v1/summary.json", "utf8")));
const report = validateAtlas(JSON.parse(readFileSync("public/style-atlas-v1/atlas.json", "utf8")), summary);
const close = (a: number, b: number, tolerance = 1e-10) => assert(Math.abs(a - b) < tolerance, `${a} != ${b}`);
function example(d: number[], line = 2, root = "test01"): AtlasRecord {
  const clicks = [0]; d.forEach(g => clicks.push(clicks.at(-1)! + g));
  const raw = { REC: `${root}001_1`, nClicks: String(clicks.length), Duration: String(clicks.at(-1)), ...Object.fromEntries(Array.from({ length: 28 }, (_, i) => [`ICI${i + 1}`, String(d[i] ?? 0)])), Whale: "1", TsTo: "0" };
  return atlasRecord({ id: `row-${line}`, sourceLine: line, rec: raw.REC, caller: "1", onset: 0, duration: clicks.at(-1)!, declaredDuration: clicks.at(-1)!, durationTolerance: 1e-10, clicks, raw });
}
test("Atlas covers unchanged full source and original exclusions, long codas and short gaps", () => {
  assert.deepEqual(report.records, parsed.calls.map(atlasRecord)); assert.deepEqual(report.exclusions, parsed.excluded);
  assert.deepEqual(report.accounting, { sourceRows: 3840, validRows: 3790, excludedRows: 50, longRows: 124, subComposerGapRows: 173 });
  assert.equal(report.records.find(r => r.clicks.length === 29)?.features.intervalsSeconds.length, 28);
  assert.deepEqual(report.support, { recs: 219, prefixes: 48, roots: 22 });
});
test("TEST ONLY hand-computable population CV, endpoint units, quantiles and degeneracy", () => {
  const f = featuresFromIntervals([1, 3]);
  assert.equal(f.durationSeconds, 4); assert.equal(f.meanIntervalSeconds, 2); assert.equal(f.intervalCV, .5);
  assert.equal(f.endpointRatio, 3); assert.equal(f.endpointShareDifference, .5); assert.deepEqual(f.gapShares, [.25, .75]);
  assert.equal(featuresFromIntervals([2, 2]).intervalCV, 0);
  assert.deepEqual(featuresFromIntervals([7]).gapShares, [1]); assert.equal(featuresFromIntervals([7]).shapeInformative, false);
  close(quantile([1, 2, 4, 8], .1)!, 1.3); assert.equal(quantile([1, 2, 4, 8], .5), 3);
  assert.equal(quantile([], .5), null); assert.equal(quantile([7], .9), 7); assert.equal(quantile([2, 2, 2], .1), 2);
});
test("TEST ONLY finite failures, exact-count rejection, sparse and empty states", () => {
  for (const d of [[], [0], [-1], [NaN], [Infinity], Array(29).fill(1), [Number.MAX_VALUE, Number.MAX_VALUE], [1, Number.MIN_VALUE]]) {
    assert.throws(() => featuresFromIntervals(d));
  }
  assert.throws(() => quantile([NaN], .5)); assert.throws(() => quantile([1], 2));
  assert.throws(() => summarizeGroup([example([1, 1])], 2));
  assert.equal(summarizeGroup([], 26).durationSeconds, null);
  assert.equal(summarizeGroup([example([1])], 2).sparse, true);
  assert.equal(summarizeGroup(Array.from({ length: 20 }, (_, i) => example([1, 2], i + 2, `test0${i % 3}`)), 3).sparse, false);
  assert.equal(summarizeGroup(Array.from({ length: 20 }, (_, i) => example([1, 2], i + 2)), 3).sparse, true);
});
test("TEST ONLY scale/time-origin invariance and complete normalized reconstruction", () => {
  const a = featuresFromIntervals([.02, .08, .2]), b = featuresFromIntervals([.2, .8, 2]);
  close(b.durationSeconds, a.durationSeconds * 10); close(b.intervalCV, a.intervalCV); close(b.endpointRatio, a.endpointRatio);
  a.gapShares.forEach((p, i) => close(p, b.gapShares[i])); close(a.gapShares.reduce((s, p) => s + p, 0), 1);
  const shifted = featuresFromTiming(timingFromClicks([10, 10.02, 10.1, 10.3]));
  shifted.gapShares.forEach((p, i) => close(p, a.gapShares[i]));
  a.clickPositions.forEach((p, i) => close(p * a.durationSeconds, [0, .02, .1, .3][i]));
});
test("TEST ONLY coordinate medians and percentiles are not an observed coda template", () => {
  const rows = [example([.8, .1, .1]), example([.1, .8, .1], 3), example([.1, .1, .8], 4)];
  const g = summarizeGroup(rows, 4), medians = g.gapShares.map(q => q!.p50), highs = g.gapShares.map(q => q!.p90);
  close(medians.reduce((s, p) => s + p, 0), .3); assert(highs.reduce((s, p) => s + p, 0) > 1);
  for (const row of rows) { assert.notDeepEqual(row.features.gapShares, medians); assert.equal(annotationSchedule(row).events.length, 4); }
  assert.throws(() => annotationSchedule({ ...rows[0], features: { ...rows[0].features, gapShares: medians } }));
});
test("TEST ONLY nearest metric stays equal-count with deterministic source-line ties", () => {
  const rows = [example([1, 2], 9), example([1, 2], 3), example([2, 1], 4), example([1], 2)];
  const nearest = nearestReferences(timingFromClicks([0, 1, 3]), rows);
  assert.deepEqual(nearest.map(r => r.sourceLine), [3, 9, 4]); assert.equal(nearest[0].distance, 0); close(nearest[2].distance, 1 / 3);
  assert.deepEqual(nearestReferences(timingFromClicks([0, 1, 3, 5]), rows), []);
  const two = nearestReferences(timingFromClicks([0, 7]), [example([3], 8), example([2], 4)]);
  assert.deepEqual(two.map(r => [r.sourceLine, r.distance]), [[4, 0], [8, 0]]);
});
test("whole annotation schedule retains all short gaps/long rows, gain and source binding", () => {
  const rows = [report.records[0], report.records.find(r => r.clicks.length === 29)!, report.records.reduce((a, b) => Math.min(...a.features.intervalsSeconds) < Math.min(...b.features.intervalsSeconds) ? a : b)];
  for (const r of rows) {
    const { schedule: s, samples } = renderAnnotation(r);
    assert.equal(s.events.length, r.clicks.length); assert(s.events.every(e => e.sourceRowId === r.id));
    s.events.forEach((e, i) => close(e.seconds, r.clicks[i] + .05)); close(s.duration, r.duration + .09);
    assert.equal(samples.length, Math.ceil(s.duration * 48000)); assert(samples.some(x => x !== 0)); assert(samples.every(x => Math.abs(x) <= .16));
  }
  assert.throws(() => annotationSchedule(example([121])));
});
test("source/schema/hash/dimension/truncation corruption fails explicitly", () => {
  for (const mutation of [(a: any) => a.records.pop(), (a: any) => a.exclusions.pop(), (a: any) => a.records[0].clicks.pop(), (a: any) => a.records[0].root = "whale", (a: any) => a.records[0].raw.Whale = "9", (a: any) => a.records[0].features.gapShares[0] = NaN, (a: any) => a.groups[3].roots++, (a: any) => a.methodSha256 = "0".repeat(64), (a: any) => a.records[1].sourceLine = 2, (a: any) => a.schema = "unknown"]) {
    const value = structuredClone(report); mutation(value); assert.throws(() => validateAtlas(value, summary));
  }
  assert.throws(() => validateSummary({ ...summary, groups: [] }));
});
test("bounded streamed loader rejects network, size, hash and aborted requests", async () => {
  const bytes = Buffer.from('{}\n'), identity = { path: "/style-atlas-v1/atlas.json", bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") };
  const signal = new AbortController().signal;
  assert.deepEqual(Buffer.from(await checkedAsset(identity, 10, signal, (async () => new Response(bytes)) as typeof fetch)), bytes);
  for (const response of [new Response(null, { status: 503 }), new Response(bytes, { headers: { 'content-length': '11' } }), new Response('{'), new Response('BAD'), new Response('TOO LONG')]) {
    await assert.rejects(() => checkedAsset(identity, 10, signal, (async () => response) as typeof fetch));
  }
  await assert.rejects(() => checkedAsset(identity, 10, signal, (async () => { throw new Error("Network offline"); }) as typeof fetch));
  const ac = new AbortController(); ac.abort();
  await assert.rejects(() => checkedAsset(identity, 10, ac.signal, (async () => new Response(bytes)) as typeof fetch));
  await assert.rejects(() => checkedAsset({ ...identity, bytes: 11 }, 10, signal));
});
test("read-only export binds latest timing; project, codebook and undo/redo are unchanged", () => {
  const draft = createDraft("dswp-1"), seed = draft.blocks[0], history = { past: [], present: draft, future: [] };
  const before = structuredClone(history);
  const current = { blockId: seed.id, revision: draft.revision, times: seed.times };
  const a = compareWithAtlas(current, report, ATLAS_MANIFEST.report);
  assert.equal(a.binding, timingBinding(current)); assert.deepEqual(history, before);
  assert(!JSON.stringify(a).includes('Creator intention')); assert(!Object.hasOwn(a, 'codebook')); assert(!Object.hasOwn(a, 'draft'));
  const edited = commitDraft(history, applyOperations(draft, [{ op: "scale_duration", blockId: seed.id, factor: 1.25 }]));
  const changed = { blockId: seed.id, revision: edited.present.revision, times: edited.present.blocks[0].times };
  const b = compareWithAtlas(changed, report, ATLAS_MANIFEST.report); assert.notEqual(a.binding, b.binding);
  close(b.currentTiming.features.durationSeconds, a.currentTiming.features.durationSeconds * 1.25);
  const back = travel(edited, "undo"), forward = travel(back, "redo");
  assert.deepEqual(forward.present.blocks[0].times, changed.times);
  // Strict existing project parsing, including human codebook data, stays authoritative.
  const saved = parseProject(projectJson(edited.present, [seed], null, seed.id));
  assert.deepEqual(saved.codebook, [seed]);
});
