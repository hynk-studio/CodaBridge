import data from "../data/recordings.json" with { type: "json" };
import type { Recording } from "./types.ts";
import { METRIC } from "./timing.ts";

export const CATALOG_VERSION = "2.0.0";
export const recordings = data as Recording[];

// Ordered A/B binding. A catalog revision is required for any annotation/data change.
export function selectionBinding(a: Recording, b: Recording) {
  return {
    catalogVersion: CATALOG_VERSION,
    metric: { id: METRIC.id, version: METRIC.version },
    selected: [a, b].map((recording) => ({
      id: recording.id,
      sourceRevision: recording.source.revision,
      audioSha256: recording.audio.sha256,
      annotationMethod: recording.annotation.method,
      annotationVersion: recording.annotation.version,
    })),
  };
}

export function selectionKey(a: Recording, b: Recording) {
  return JSON.stringify(selectionBinding(a, b));
}
