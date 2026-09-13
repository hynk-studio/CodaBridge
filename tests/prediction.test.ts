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
test("TEST ONLY failed, insufficient, negative and zero presentations never become positive success", () => {
  for (const status of ["failed", "insufficient-data"] as const) {
    const s = saved(); Object.assign(s, { status, metrics: null, uncertainty: null, selectedExamples: [], failures: [{ reason: "TEST ONLY failure state" }] });
    assert.equal(validatePredictionSummary(s).status, status);
    assert.match(predictionFinding(status, null), /no primary estimate/);
    s.metrics = saved().metrics;
    assert.throws(() => validatePredictionSummary(s));
  }
  assert.equal(predictionFinding("completed", 0), "No measured predictive gain");
  assert.equal(predictionFinding("completed", -.1), "Partner history worsened pooled prediction");
  assert.equal(predictionFinding("completed", .1), "Partner history improved pooled prediction");
  assert.match(predictionFinding("completed", null), /no primary estimate/);
});
