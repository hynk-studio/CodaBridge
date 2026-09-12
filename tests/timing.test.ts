import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compareTiming, measureTiming } from "../src/domain/timing.ts";
import type { TimingInput } from "../src/domain/timing.ts";

// All timings in this file are labeled synthetic unit-test data, never product recordings.
const synthetic = (times: number[], duration = 10): TimingInput => ({
  clickTimesSeconds: times,
  durationSeconds: duration,
  selectedIntervalSeconds: { start: 0, end: duration },
});
const valid = (times: number[]) => {
  const result = measureTiming(synthetic(times));
  assert.equal(result.status, "valid");
  return result.measurements;
};

describe("synthetic timing arithmetic", () => {
  it("preserves times, calculates intervals and distinguishes recording duration from span", () => {
    const input = synthetic([1, 1.25, 2]);
    const original = structuredClone(input);
    const result = measureTiming(input);
    assert.equal(result.status, "valid");
    assert.deepEqual(result.measurements.intervalsSeconds, [0.25, 0.75]);
    assert.equal(result.measurements.clickSpanSeconds, 1);
    assert.equal(result.measurements.recordingDurationSeconds, 10);
    assert.deepEqual(input, original);
  });
  it("normalizes intervals to sum to one and anchors click positions at zero and one", () => {
    const measured = valid([0.13, 0.22, 0.67, 0.96]);
    assert.ok(
      Math.abs(measured.normalizedIntervals.reduce((a, b) => a + b) - 1) <
        1e-12,
    );
    assert.equal(measured.normalizedClickPositions[0], 0);
    assert.equal(measured.normalizedClickPositions.at(-1), 1);
  });
  it("is invariant to an offset and a uniform time scale", () => {
    const original = synthetic([0.25, 0.5, 1]);
    for (const times of [
      [3.25, 3.5, 4],
      [1, 2, 4],
    ]) {
      const compared = compareTiming(original, synthetic(times));
      assert.equal(compared.status, "comparable");
      assert.equal(compared.value, 0);
    }
  });
  it("detects changed spacing with the specified mean absolute difference", () => {
    const comparison = compareTiming(
      synthetic([0, 0.25, 1]),
      synthetic([0, 0.5, 1]),
    );
    assert.equal(comparison.status, "comparable");
    assert.equal(comparison.value, 0.25);
    assert.equal(comparison.metric.version, "1.0.0");
  });
  it("handles the minimum two-click case", () => {
    assert.deepEqual(valid([0, 1]).normalizedIntervals, [1]);
  });
});

describe("invalid or incompatible synthetic timing", () => {
  for (const [label, times] of Object.entries({
    duplicate: [0, 0, 1],
    unsorted: [1, 0.5, 2],
    nan: [0, NaN],
    infinite: [0, Infinity],
    negative: [-1, 1],
    beyond: [0, 11],
    insufficient: [0],
    empty: [],
    string: [0, "1"],
  })) {
    it(`rejects ${label} timestamps without coercion, sorting, or padding`, () => {
      const input = synthetic(times as number[]);
      assert.equal(measureTiming(input).status, "invalid");
      assert.equal(
        compareTiming(input, synthetic([0, 1])).status,
        "not-comparable",
      );
    });
  }
  it("rejects malformed recording duration or selected interval", () => {
    for (const duration of [0, -1, Infinity, NaN])
      assert.equal(
        measureTiming(synthetic([0, 1], duration)).status,
        "invalid",
      );
    for (const selectedIntervalSeconds of [
      { start: -1, end: 2 },
      { start: 2, end: 1 },
      { start: 0, end: 11 },
      { start: 0, end: NaN },
      { start: 0.5, end: 2 },
    ]) {
      assert.equal(
        measureTiming({ ...synthetic([0, 1]), selectedIntervalSeconds }).status,
        "invalid",
      );
    }
  });
  it("refuses unequal click counts", () => {
    const comparison = compareTiming(synthetic([0, 1]), synthetic([0, 0.5, 1]));
    assert.equal(comparison.status, "not-comparable");
    assert.equal(comparison.code, "UNEQUAL_CLICK_COUNTS");
    assert.equal("value" in comparison, false);
  });
  it("identifies invalid B independently", () => {
    const comparison = compareTiming(synthetic([0, 1]), synthetic([1, 0]));
    assert.equal(comparison.status, "not-comparable");
    assert.equal(comparison.code, "INVALID_B");
  });
});
