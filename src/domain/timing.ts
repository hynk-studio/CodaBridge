export interface TimingInput {
  durationSeconds: number;
  clickTimesSeconds: readonly number[];
  selectedIntervalSeconds: { start: number; end: number };
}

export interface Measurements {
  clickCount: number;
  recordingDurationSeconds: number;
  clickSpanSeconds: number;
  intervalsSeconds: number[];
  normalizedIntervals: number[];
  normalizedClickPositions: number[];
}

export type TimingErrorCode =
  | "INVALID_DURATION"
  | "INVALID_INTERVAL"
  | "INSUFFICIENT_CLICKS"
  | "INVALID_TIMESTAMP"
  | "NON_INCREASING_TIMES"
  | "OUTSIDE_INTERVAL";
export type TimingResult =
  | { status: "valid"; measurements: Measurements }
  | { status: "invalid"; code: TimingErrorCode; reason: string };

export const METRIC = {
  id: "normalized-interval-mad",
  version: "1.0.0",
  name: "Mean absolute normalized interval difference",
  unit: "dimensionless",
  interpretation: "Smaller means closer under this timing metric.",
} as const;

export function measureTiming(input: TimingInput): TimingResult {
  const {
    durationSeconds: duration,
    clickTimesSeconds: times,
    selectedIntervalSeconds: region,
  } = input;
  const invalid = (code: TimingErrorCode, reason: string): TimingResult => ({
    status: "invalid",
    code,
    reason,
  });
  if (!Number.isFinite(duration) || duration <= 0)
    return invalid(
      "INVALID_DURATION",
      "Recording duration must be finite and positive.",
    );
  if (
    !region ||
    !Number.isFinite(region.start) ||
    !Number.isFinite(region.end) ||
    region.start < 0 ||
    region.end > duration ||
    region.start >= region.end
  ) {
    return invalid(
      "INVALID_INTERVAL",
      "Selected interval must lie within the recording and have positive duration.",
    );
  }
  if (!Array.isArray(times) || times.length < 2)
    return invalid(
      "INSUFFICIENT_CLICKS",
      "At least two click times are required.",
    );
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    if (typeof t !== "number" || !Number.isFinite(t) || t < 0 || t > duration)
      return invalid(
        "INVALID_TIMESTAMP",
        `Click ${i + 1} must be a finite time within the recording.`,
      );
    if (i > 0 && t <= times[i - 1])
      return invalid(
        "NON_INCREASING_TIMES",
        "Click times must be strictly increasing; duplicates are not allowed.",
      );
    if (t < region.start || t > region.end)
      return invalid(
        "OUTSIDE_INTERVAL",
        `Click ${i + 1} is outside the selected interval.`,
      );
  }
  const clickSpanSeconds = times[times.length - 1] - times[0];
  const intervalsSeconds = times.slice(1).map((t, i) => t - times[i]);
  return {
    status: "valid",
    measurements: {
      clickCount: times.length,
      recordingDurationSeconds: duration,
      clickSpanSeconds,
      intervalsSeconds,
      normalizedIntervals: intervalsSeconds.map(
        (interval) => interval / clickSpanSeconds,
      ),
      normalizedClickPositions: times.map(
        (t) => (t - times[0]) / clickSpanSeconds,
      ),
    },
  };
}

export type Comparison =
  | { status: "comparable"; metric: typeof METRIC; value: number }
  | {
      status: "not-comparable";
      metric: typeof METRIC;
      code: "INVALID_A" | "INVALID_B" | "UNEQUAL_CLICK_COUNTS";
      reason: string;
    };

export function compareTiming(a: TimingInput, b: TimingInput): Comparison {
  const left = measureTiming(a);
  const right = measureTiming(b);
  if (left.status === "invalid")
    return {
      status: "not-comparable",
      metric: METRIC,
      code: "INVALID_A",
      reason: `Recording A: ${left.reason}`,
    };
  if (right.status === "invalid")
    return {
      status: "not-comparable",
      metric: METRIC,
      code: "INVALID_B",
      reason: `Recording B: ${right.reason}`,
    };
  if (left.measurements.clickCount !== right.measurements.clickCount)
    return {
      status: "not-comparable",
      metric: METRIC,
      code: "UNEQUAL_CLICK_COUNTS",
      reason:
        "Equal click counts are required. No alignment, padding, or truncation is applied.",
    };
  const differences = left.measurements.normalizedIntervals.map((value, i) =>
    Math.abs(value - right.measurements.normalizedIntervals[i]),
  );
  return {
    status: "comparable",
    metric: METRIC,
    value: differences.reduce((sum, x) => sum + x, 0) / differences.length,
  };
}
