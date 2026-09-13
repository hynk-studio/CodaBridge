import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildResearchCohorts } from "../analysis/dialogue-transfer-v02/cohort.ts";
import { checkNumerical, quantile, replay, scalarLoss, stats } from "../analysis/dialogue-transfer-v02/verification-math.ts";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const config = read("analysis/dialogue-transfer-v02/protocol.json");
const source = readFileSync("data/context/sperm-whale-dialogues.csv", "utf8");
const header = source.split("\n")[0];
// TEST ONLY synthetic annotation rows. Never exported as research evidence.
function row(onset: number, caller: number, duration = 1, rec = "testAA001_1", clicks = 3) {
  return [rec, clicks, duration.toFixed(6), ...Array.from({ length: 28 }, (_, i) => i < clicks - 1 ? (duration / (clicks - 1)).toFixed(6) : "0"), caller, onset.toFixed(6)].join(",");
}
const build = (rows: string[]) => buildResearchCohorts(`${header}\n${rows.join("\n")}\n`);
const history = () => Array.from({ length: 20 }, (_, i) => row(i * 3, i % 2 + 1));

test("v0.2 reproduces frozen core/coverage from full source and preserves common endpoint support", () => {
  const actual = buildResearchCohorts(source);
  for (const key of ["core", "coverage"] as const) {
    assert.deepEqual(actual[key], read(`analysis/dialogue-transfer-v02/inputs/${key}.json`));
    assert.deepEqual(actual[`${key}Split`], read(`analysis/dialogue-transfer-v02/${key}-split.json`));
    for (const example of actual[key]) {
      assert.ok(Object.values(example.targets).every(Number.isFinite));
      assert.equal(example.targets.count, example.sourceBindings.target.clickCount);
      assert.equal(example.targets.duration, Math.log(example.sourceBindings.target.duration));
      assert.equal(example.targets.gap, Math.log(example.sourceBindings.target.onset - example.cutoff));
    }
  }
  assert.equal(actual.core.length, 723); assert.equal(actual.coverage.length, 1017);
  assert.deepEqual(actual.coreSplit, read("analysis/dialogue-transfer/split-manifest.json"));
  for (const [group, fold] of Object.entries(actual.coreSplit.assignments)) assert.equal(actual.coverageSplit.assignments[group], fold);
  assert.deepEqual(actual.coverageSplit.appendedGroups, ["sw119b"]);
  assert.equal(actual.coverageSplit.assignments.sw119b, 4);
  const core = new Map(actual.core.map(e => [e.id, e]));
  for (const e of actual.coverage) {
    assert.equal("M2-lagged" in e.features, false);
    assert.equal("lagged" in e.sourceBindings, false);
    assert.ok(e.completedPartnerRows.length >= 2);
    if (core.has(e.id)) {
      assert.deepEqual(e.features.M1, core.get(e.id)!.features.M1);
      assert.deepEqual(e.features.M2, core.get(e.id)!.features.M2);
    } else assert.ok(e.completedPartnerRows.length < 4);
  }
});

test("TEST ONLY upstream future/target mutations change targets, never admissible predictors or replay", () => {
  const original = build(history());
  for (const key of ["core", "coverage"] as const) {
    const fixed = original[key].find(e => e.currentRow === 14)!;
    assert.ok(fixed);
    const changedRows = history();
    // Current row 14 starts at 36 and completes at 37. Partner at 39 and target at 42 are future.
    changedRows[13] = row(39.5, 2, 1.5, "testAA001_1", 4);
    changedRows[14] = row(42.25, 1, 2, "testAA001_1", 5);
    const changed = build(changedRows)[key].find(e => e.currentRow === fixed.currentRow)!;
    assert.deepEqual(changed.features, fixed.features);
    assert.deepEqual(changed.prefix, fixed.prefix);
    assert.deepEqual(changed.sourceBindings.self, fixed.sourceBindings.self);
    assert.deepEqual(changed.sourceBindings.recent, fixed.sourceBindings.recent);
    assert.notDeepEqual(changed.targets, fixed.targets);
    for (const kind of ["ridge", "poisson"]) {
      const size = fixed.features.M2!.length;
      const fit = { coefficients: Array(size).fill(.001), intercept: .1, imputer: Array(size).fill(0), mean: Array(size).fill(0), scale: Array(size).fill(1) };
      assert.deepEqual(replay(changed.features.M2!, fit, kind), replay(fixed.features.M2!, fit, kind));
    }
  }
  const invalid = history(); invalid[14] = row(42, 1, -1);
  const rejected = build(invalid);
  for (const key of ["core", "coverage"] as const) assert.ok(!rejected[key].some(e => e.currentRow === 14));
  // An unfinished partner cannot donate its final duration; a cross-REC caller is never imported.
  const unfinished = history(); unfinished[13] = row(36.5, 2, 4);
  const extended = [...unfinished, ...history().map((_, i) => row(i * 3, i % 2 + 1, 1, "testBB001_1"))];
  for (const key of ["core", "coverage"] as const) {
    const a = build(unfinished)[key].find(e => e.currentRow === 14)!;
    const b = build(extended)[key].find(e => e.currentRow === 14)!;
    assert.deepEqual(a.features, original[key].find(e => e.currentRow === 14)!.features);
    assert.deepEqual(b.features, a.features);
  }
});

test("TEST ONLY independent Ridge/Poisson checks enforce stationarity beyond prediction replay", () => {
  const rows = [{ features: [-1], target: -1 }, { features: [1], target: 1 }];
  const fit = { imputer: [0], mean: [0], scale: [1], coefficients: [2 / 3], intercept: 0 };
  assert.ok(checkNumerical(rows, fit, "ridge", config, "fixture/fold 0/M1").maximum < 1e-14);
  const poissonRows = rows.map(r => ({ ...r, target: 1 })), constant = { ...fit, coefficients: [0] };
  assert.equal(checkNumerical(poissonRows, constant, "poisson", config, "fixture/fold 0/M2").maximum, 0);
  for (const kind of ["ridge", "poisson"]) {
    const targetRows = kind === "ridge" ? rows : poissonRows;
    const valid = kind === "ridge" ? fit : constant;
    for (const coefficient of [NaN, Infinity, .3]) {
      assert.throws(() => checkNumerical(targetRows, { ...valid, coefficients: [coefficient] }, kind, config, "TEST ONLY/fold 2/M2"), /TEST ONLY\/fold 2\/M2/);
    }
    // Identical standardized columns: a coefficient shift (+c,-c) preserves EVERY prediction,
    // but violates the L2-penalized normal equation / gradient. No checked-in fit is changed.
    const duplicateRows = targetRows.map(r => ({ ...r, features: [...r.features, ...r.features] }));
    const w = kind === "ridge" ? .4 : 0;
    const validDuplicate = { imputer: [0, 0], mean: [0, 0], scale: [1, 1], coefficients: [w, w], intercept: 0 };
    checkNumerical(duplicateRows, validDuplicate, kind, config, "TEST ONLY valid duplicate columns");
    const shifted = { ...validDuplicate, coefficients: [w + 1, w - 1] };
    for (const r of duplicateRows) assert.ok(Math.abs(replay(r.features, validDuplicate, kind).value - replay(r.features, shifted, kind).value) <= Number.EPSILON);
    assert.throws(() => checkNumerical(duplicateRows, shifted, kind, config, "TEST ONLY/fold 4/M2-lagged"), /numerical acceptance failed/);
  }
});

test("TEST ONLY hand-computable losses and unequal-root weighting use each paired row", () => {
  assert.equal(scalarLoss(2, 1, "ridge"), 1);
  assert.equal(scalarLoss(3, 3, "poisson"), 0);
  assert.equal(scalarLoss(2, 1, "poisson"), 2 * (2 * Math.log(2) - 1));
  for (const p of [0, -1, Infinity, NaN]) assert.throws(() => scalarLoss(1, p, "poisson"));
  const record = (parentGroup: string, self: number, recent: number) => ({ parentGroup, predictions: { M1: { loss: self, absoluteError: self }, M2: { loss: recent, absoluteError: recent } }, gain: { M2_vs_M1: self - recent } });
  const metrics = stats([record("a", 2, 0), record("a", 2, 0), record("b", 0, 4)], ["M1", "M2"], ["M2_vs_M1"]);
  assert.equal(metrics.pooled!.gain.M2_vs_M1, 0);
  assert.equal(metrics.macro!.gain.M2_vs_M1, -1);
  assert.equal(metrics.perGroup[0].pooledContribution.M2_vs_M1, 4 / 3);
  assert.equal(metrics.perGroup[1].pooledContribution.M2_vs_M1, -4 / 3);
  assert.deepEqual([quantile([-4, -4, 2, 2], .025), quantile([-4, -4, 2, 2], .975)], [-4, 2]);
  assert.equal(stats([], ["M1", "M2"], ["M2_vs_M1"]).status, "empty");
});
