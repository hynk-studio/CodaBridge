import type { Recording, ViewMode } from "./types.ts";
import { compareTiming, measureTiming } from "./timing.ts";
import { selectionKey } from "./catalog.ts";
import type { CompletedInvestigation } from "../investigation.ts";

export const LIMITATIONS = [
  "Click positions are machine estimates of transient peaks, not source annotations or human-reviewed click onsets.",
  "Selected intervals may contain multiple codas, echoes, or unrelated transients. Biological coda boundaries are unverified.",
  "The source supplies no per-file speaker identity, recording-system metadata, or behavioral/dialogue context.",
  "Timing distance describes normalized spacing only. It is not a similarity percentage, semantic confidence, or biological category.",
  "This small curated catalog does not establish population-level findings.",
  "Generated interpretation, when available, is separate from measured evidence. A valid reference is traceability, not proof of correctness.",
] as const;

export function timingInput(recording: Recording) {
  return {
    durationSeconds: recording.audio.durationSeconds,
    clickTimesSeconds: recording.annotation.clickTimesSeconds,
    selectedIntervalSeconds: recording.annotation.selectedIntervalSeconds,
  };
}

export function buildEvidence(
  a: Recording,
  b: Recording,
  view: ViewMode,
  generatedAt = new Date().toISOString(),
  investigation: CompletedInvestigation | null = null,
) {
  // Snapshot the current selections. Later UI changes cannot mutate an exported packet.
  return structuredClone({
    format: "codabridge-comparison-evidence",
    formatVersion: "2.0.0",
    appVersion: "0.2.0",
    generatedAt,
    view,
    playback: { rate: 1, normalizationChangesPlayback: false },
    selection: [a, b].map((recording, index) => ({
      side: index === 0 ? "A" : "B",
      sourceId: recording.id,
      source: recording.source,
      audio: recording.audio,
      annotation: recording.annotation,
      originalTiming: timingInput(recording),
      result: measureTiming(timingInput(recording)),
    })),
    comparison: compareTiming(timingInput(a), timingInput(b)),
    investigation:
      investigation?.selectionKey === selectionKey(a, b) ? investigation : null,
    limitations: [...LIMITATIONS],
  });
}

export function evidenceJson(
  evidence: ReturnType<typeof buildEvidence>,
): string {
  // JSON silently changes NaN/Infinity to null. Refuse to export malformed evidence.
  return JSON.stringify(
    evidence,
    (_key, value: unknown) => {
      if (typeof value === "number" && !Number.isFinite(value))
        throw new Error("Cannot export non-finite measurements.");
      return value;
    },
    2,
  );
}
