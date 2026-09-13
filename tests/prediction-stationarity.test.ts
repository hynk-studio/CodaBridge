import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertTrainingStationarity, reconstructPrediction, trainingObjectiveGradient, type SavedFit, type TrainingRow } from "../analysis/dialogue-transfer/stationarity.ts";

const read = (path: string) => JSON.parse(readFileSync(`analysis/dialogue-transfer/${path}`, "utf8"));
const protocol = read("protocol.json"), report = read("results/report.json"), fits = read("results/fold-fits.json"), cohort = read("inputs/cohort.json").examples;
const training = (fold: number, model: string): TrainingRow[] => {
  const edges = report.folds.find((f: any) => f.fold === fold).edges;
  return cohort.filter((e: any) => report.split.assignments[e.parentGroup] !== fold).map((e: any) => ({ features: e.features[model], category: e.targetDuration <= edges[0] ? 0 : e.targetDuration <= edges[1] ? 1 : 2 }));
};
const near = (a: number, b: number, tolerance = 1e-12) => assert.ok(Number.isFinite(a) && Math.abs(a - b) <= tolerance, `${a} differs from ${b}`);

test("all 15 saved fold/model gradients satisfy the unchanged frozen stationarity tolerance without fitting", () => {
  for (const f of fits) for (const model of ["M1", "M2", "M2-lagged"]) {
    const diagnostic = trainingObjectiveGradient(training(f.fold, model), f.models[model], protocol.logistic.C);
    assert.ok(assertTrainingStationarity(diagnostic, protocol.logistic.tol, { fold: f.fold, model }) <= protocol.logistic.tol);
  }
});

test("TEST ONLY hand-computable objective uses mean natural-log loss, 1/(C*n) penalty gradient and unpenalized intercept", () => {
  const rows = [0, 1, 2].map(category => ({ features: [1], category }));
  const fit: SavedFit = { imputer: [0], mean: [0], scale: [1], coefficients: [[2], [2], [2]], intercepts: [4, 4, 4] };
  const d = trainingObjectiveGradient(rows, fit, 2);
  near(d.objective, Math.log(3) + 1);
  d.gradient.flat().forEach(v => near(v, 1 / 3));
  d.interceptGradient.forEach(v => near(v, 0));
  fit.coefficients = [[0], [0], [0]];
  assert.ok(assertTrainingStationarity(trainingObjectiveGradient(rows, fit, 2), protocol.logistic.tol, { fold: 0, model: "TEST ONLY balanced fixture" }) < 1e-15);
});

test("TEST ONLY nonfinite and excessive coefficient/intercept gradients fail with fold/model identity", () => {
  for (const component of ["gradient", "interceptGradient"] as const) for (const value of [NaN, Infinity, -Infinity, 2 * protocol.logistic.tol, -2 * protocol.logistic.tol]) {
    const diagnostic = { objective: 1, gradient: [[0]], interceptGradient: [0] };
    if (component === "gradient") diagnostic.gradient[0][0] = value;
    else diagnostic.interceptGradient[0] = value;
    assert.throws(() => assertTrainingStationarity(diagnostic, protocol.logistic.tol, { fold: 2, model: "M2-lagged TEST ONLY" }), /Fold 2 \/ M2-lagged TEST ONLY: (nonfinite training gradient|maximum training gradient .* exceeds frozen protocol tolerance)/);
  }
  const boundary = { objective: 1, gradient: [[protocol.logistic.tol]], interceptGradient: [0] };
  assert.equal(assertTrainingStationarity(boundary, protocol.logistic.tol, { fold: 0, model: "TEST ONLY boundary" }), protocol.logistic.tol);
  boundary.gradient[0][0] *= 1 + Number.EPSILON;
  assert.throws(() => assertTrainingStationarity(boundary, protocol.logistic.tol, { fold: 0, model: "TEST ONLY boundary" }), /exceeds frozen protocol tolerance/);
});

test("TEST ONLY common class coefficient shift preserves softmax replay but fails penalized stationarity", () => {
  const original = fits[0].models.M1 as SavedFit, shifted = structuredClone(original), rows = training(fits[0].fold, "M1");
  // Alter only an in-memory copy; adding the same weight to every class shifts all logits equally.
  shifted.coefficients.forEach(w => { w[0] += 1; });
  for (const row of rows) {
    const expected = reconstructPrediction(row.features, original).p;
    reconstructPrediction(row.features, shifted).p.forEach((p, k) => near(p, expected[k]));
  }
  const diagnostic = trainingObjectiveGradient(rows, shifted, protocol.logistic.C);
  assert.throws(() => assertTrainingStationarity(diagnostic, protocol.logistic.tol, { fold: fits[0].fold, model: "M1 TEST ONLY common shift" }), /Fold 0 \/ M1 TEST ONLY common shift: maximum training gradient .* exceeds frozen protocol tolerance/);
  // Nonfinite input also reaches the enforced finite-gradient check, not a false numerical pass.
  shifted.coefficients[0][0] = NaN;
  assert.throws(() => assertTrainingStationarity(trainingObjectiveGradient(rows, shifted, protocol.logistic.C), protocol.logistic.tol, { fold: 0, model: "M1 TEST ONLY nonfinite" }), /Fold 0 \/ M1 TEST ONLY nonfinite: nonfinite training gradient/);
  assert.deepEqual(original, read("results/fold-fits.json")[0].models.M1);
});
