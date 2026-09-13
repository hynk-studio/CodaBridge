import type { comparePairing } from "./model.ts";

export type PairingComparison = ReturnType<typeof comparePairing>;

// Presentation only: retain exact values, assignment membership and ordering.
export function scoreRows(comparison: PairingComparison) {
  return [
    { label: "Observed", offset: 0, value: comparison.observed.valueSeconds },
    ...comparison.controls
      .filter((control) => control.equivalentToOffset === null)
      .map((control) => ({ label: `Control ${control.offset}`, offset: control.offset, value: control.valueSeconds })),
  ];
}

export function scoreMaximum(comparison: PairingComparison) {
  return Math.max(0.05, Math.ceil(Math.max(...scoreRows(comparison).map((row) => row.value ?? 0)) / 0.05) * 0.05);
}

export function pairingFinding(comparison: PairingComparison) {
  const value = comparison.observed.valueSeconds;
  const range = comparison.controlSummary;
  if (value === null || !range) return "There is not enough data for a useful reassignment comparison.";
  if (value < range.minSeconds) return "The observed duration difference is below every reassigned score.";
  if (value > range.maxSeconds) return "The observed duration difference is above every reassigned score.";
  return "The observed duration difference falls within the reassigned range.";
}
