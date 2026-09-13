import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { predictionFinding, predictionView, validatePredictionSummary } from "../src/lab/prediction.ts";
const saved = () => JSON.parse(readFileSync("public/prediction/summary.json", "utf8"));
test("bounded browser summary has authentic OOF examples with no target in the unrevealed view", () => {
  const data = validatePredictionSummary(saved());
  assert.equal(data.status, "completed");
  for (const example of data.selectedExamples) {
    const hidden = predictionView(example, false), visible = predictionView(example, true);
    assert.equal("target" in hidden, false); assert.equal("category" in hidden, false); assert.equal("gain" in hidden, false);
    assert.ok(hidden.history.every(c => c.sourceLine !== example.target.sourceLine && c.onset + c.duration <= hidden.cutoff));
    assert.deepEqual(visible.target, example.target);
    assert.equal(visible.category, example.record.category);
    assert.deepEqual(predictionView(example, false), hidden);
  }
});
test("schema rejects future history, broken probabilities, target/bin mismatch and unsafe report URL", () => {
  for (const change of [
    (s: any) => { s.selectedExamples[0].history[0] = s.selectedExamples[0].target; },
    (s: any) => { s.selectedExamples[0].record.predictions.M1.scoring = [1, 1, 1]; },
    (s: any) => { s.selectedExamples[0].record.category = 9; },
    (s: any) => { s.selectedExamples[0].record.edges = [2, 1]; },
    (s: any) => { s.report.path = "https://outside.invalid/report"; },
    (s: any) => { s.report.bytes = 100000000; },
    (s: any) => { s.provenance.producerCommit = "invented"; },
    (s: any) => { s.metrics.gainBits.M2_vs_M1 = null; },
  ]) { const s = saved(); change(s); assert.throws(() => validatePredictionSummary(s)); }
});
test("frozen primary headline distinguishes its positive estimate from the interval spanning zero", () => {
  const s = validatePredictionSummary(saved());
  assert.equal(s.metrics!.gainBits.M2_vs_M1, 0.0022025623791761683);
  assert.equal(predictionFinding(s.status, s.metrics!.gainBits.M2_vs_M1, s.uncertainty!.intervals.M2_vs_M1.pooled), "Positive pooled estimate — interval spans zero");
});
test("TEST ONLY failed and insufficient states never substitute a primary estimate", () => {
  for (const status of ["failed", "insufficient-data"] as const) {
    const s = saved(); Object.assign(s, { status, metrics: null, uncertainty: null, selectedExamples: [], failures: [{ reason: "TEST ONLY failure state" }] });
    assert.equal(validatePredictionSummary(s).status, status);
    assert.match(predictionFinding(status, null, null), /no primary estimate/);
    assert.match(predictionFinding(status, .1, [.01, .2]), /no primary estimate/);
    s.metrics = saved().metrics;
    assert.throws(() => validatePredictionSummary(s));
  }
  for (const gain of [null, NaN, Infinity]) assert.match(predictionFinding("completed", gain, null), /no primary estimate/);
});
test("TEST ONLY headlines preserve point-estimate signs and describe interval position without effect claims", () => {
  for (const [gain, point] of [[.1, "Positive"], [-.1, "Negative"], [0, "Zero"], [-0, "Zero"]] as const) {
    for (const interval of [[-.2, .2], [-.2, 0], [0, .2], [0, 0]])
      assert.equal(predictionFinding("completed", gain, interval), `${point} pooled estimate — interval spans zero`);
    assert.equal(predictionFinding("completed", gain, [.01, .2]), `${point} pooled estimate — interval above zero`);
    assert.equal(predictionFinding("completed", gain, [-.2, -.01]), `${point} pooled estimate — interval below zero`);
    for (const interval of [null, [], [.1], [.2, -.2], [NaN, .2], [-.2, Infinity]])
      assert.equal(predictionFinding("completed", gain, interval), `${point} pooled estimate — uncertainty unavailable`);
  }
});
test("TEST ONLY missing uncertainty retains a completed estimate; malformed intervals remain invalid", () => {
  const s = saved(); s.uncertainty = null;
  assert.equal(validatePredictionSummary(s).metrics!.gainBits.M2_vs_M1, saved().metrics.gainBits.M2_vs_M1);
  for (const interval of [[], [.2, -.2], [-.1, null]]) {
    const invalid = saved(); invalid.uncertainty.intervals.M2_vs_M1.pooled = interval;
    assert.throws(() => validatePredictionSummary(invalid));
  }
});
