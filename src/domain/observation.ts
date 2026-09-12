import { measureTiming, type TimingInput } from "./timing.ts";

export function measuredObservation(a: TimingInput, b: TimingInput): string {
  const left = measureTiming(a);
  const right = measureTiming(b);
  if (left.status !== "valid" || right.status !== "valid")
    return "Interval contrast is unavailable because timing validation failed.";
  const firstA = left.measurements.intervalsSeconds[0];
  const firstB = right.measurements.intervalsSeconds[0];
  return `The first estimated interval is ${firstA.toFixed(3)} s in A and ${firstB.toFixed(3)} s in B. ${firstA === firstB ? "Their lengths are equal." : `It is ${firstA < firstB ? "shorter" : "longer"} in A.`}`;
}
