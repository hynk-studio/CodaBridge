import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { researchFinding, researchView, validateResearchSummary, readResearchBytes } from "../src/lab/researchPrediction.ts";
const saved = () => JSON.parse(readFileSync("public/prediction-v02/summary.json", "utf8"));
test("v0.2 saved outcomes retain their signs, uncertainty, units and deterministic examples", () => {
  const s = validateResearchSummary(saved());
  assert.equal(s.status, "completed"); assert.equal(s.studies.length, 4);
  assert.equal(s.studies[0].metrics!.pooled!.gain.M2_vs_M1, 0.003317109960373785);
  assert.equal(researchFinding(s.studies[0]), "Positive pooled estimate — interval above zero");
  assert.equal(researchFinding(s.studies[1]), "Negative pooled estimate — interval spans zero");
  assert.equal(researchFinding(s.studies[2]), "Positive pooled estimate — interval spans zero");
  assert.equal(researchFinding(s.studies[3]), "Positive pooled estimate — interval spans zero");
  assert.deepEqual(s.examples.map(e => e.id), JSON.parse(readFileSync("analysis/dialogue-transfer-v02/core-split.json", "utf8")).selectedExamples);
  assert.equal(s.studies[3].selectedRecords.length, 0);
  for (const e of s.examples) {
    const hidden = researchView(e, s.studies, false), revealed = researchView(e, s.studies, true);
    for (const key of ["target", "gapSeconds", "records", "id"]) assert.equal(key in hidden, false);
    for (const p of hidden.predictions) for (const point of Object.values(p.points!)) assert.deepEqual(Object.keys(point), ["value", "nativePoint"]);
    assert.ok(hidden.history.every(c => c.sourceLine !== e.target.sourceLine && c.onset + c.duration <= e.cutoff));
    assert.deepEqual(revealed.target, e.target); assert.equal(revealed.gapSeconds, e.gapSeconds);
    assert.deepEqual(researchView(e, s.studies, false), hidden);
  }
});
test("TEST ONLY malformed v0.2 schemas cannot become estimates or leak future targets into history", () => {
  for (const change of [
    (s: any) => { s.examples[0].history[0] = s.examples[0].target; },
    (s: any) => { s.examples[0].gapSeconds += 1; },
    (s: any) => { s.studies[1].selectedRecords[0].targets.count += 1; },
    (s: any) => { s.studies[0].selectedRecords[0].predictions.M1.value = Infinity; },
    (s: any) => { s.studies[1].selectedRecords[0].predictions.M1.nativePoint = -1; },
    (s: any) => { s.studies[0].uncertainty.intervals.M2_vs_M1.pooled = [.1, -.1]; },
    (s: any) => { s.studies[3].models.push("M2-lagged"); },
    (s: any) => { s.studies[2].selectedRecords.pop(); },
    (s: any) => { s.studies[0].folds[0].trainingGroups.push(s.studies[0].folds[0].testGroups[0]); },
    (s: any) => { s.studies[0].deletions[0].removedRoot = "absent"; },
    (s: any) => { s.report.path = "https://outside.invalid/report"; },
    (s: any) => { s.report.bytes = 33554433; },
    (s: any) => { s.source.csvSha256 = "a".repeat(64); },
    (s: any) => { s.provenance.freezeCommit = "unknown"; },
  ]) { const s = saved(); change(s); assert.throws(() => validateResearchSummary(s)); }
});
test("TEST ONLY failed/insufficient endpoints, missing intervals and zero remain truthful", () => {
  for (const state of ["failed", "insufficient-data"]) {
    const s = saved(); s.status = "partial";
    Object.assign(s.studies[0], { status: state, metrics: null, uncertainty: null, selectedRecords: [], failures: [{ reason: "TEST ONLY unavailable endpoint" }], strata: {}, deletions: [] });
    const valid = validateResearchSummary(s);
    assert.match(researchFinding(valid.studies[0]), /no estimate/);
    assert.equal(researchView(valid.examples[0], valid.studies, false).predictions[0].points, null);
    s.studies[0].metrics = saved().studies[0].metrics;
    assert.throws(() => validateResearchSummary(s));
  }
  const s = saved(); s.studies[0].uncertainty = null;
  assert.equal(researchFinding(validateResearchSummary(s).studies[0]), "Positive pooled estimate — uncertainty unavailable");
  s.studies[0].metrics.pooled.gain.M2_vs_M1 = 0;
  assert.equal(researchFinding(validateResearchSummary(s).studies[0]), "Zero pooled estimate — uncertainty unavailable");
});
test("TEST ONLY streaming research reads enforce byte bounds and HTTP failure states", async () => {
  assert.equal(new TextDecoder().decode(await readResearchBytes(new Response("abc"), 3)), "abc");
  await assert.rejects(readResearchBytes(new Response("abcd"), 3), /size limit/);
  await assert.rejects(readResearchBytes(new Response("unavailable", { status: 503 }), 100), /could not be loaded/);
});
