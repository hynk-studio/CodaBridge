import { recordings } from "../domain/catalog.ts";
import type { Recording } from "../domain/types.ts";
import { compareTiming, measureTiming, METRIC } from "../domain/timing.ts";
import { timingInput } from "../domain/evidence.ts";
import {
  blockTiming,
  parseDraft,
  seedBlock,
  span,
  type Block,
  type Draft,
} from "./model.ts";

export function compareBlock(
  draft: Draft,
  activeId: string,
  previous: Block | null = null,
  catalog: Recording[] = recordings,
) {
  const valid = parseDraft(draft);
  const active = valid.blocks.find((b) => b.id === activeId);
  if (!active) throw new Error("No selected block.");
  const seed = seedBlock(active.seed.recordingId);
  const timing = blockTiming(active);
  const excludedIds = valid.ancestry.map((s) => s.recordingId);
  const seen = new Set(
    catalog
      .filter((r) => excludedIds.includes(r.id))
      .map((r) => r.audio.sha256),
  );
  const excludedDuplicates: string[] = [];
  const candidates = catalog
    .filter((r) => {
      if (excludedIds.includes(r.id)) return false;
      if (seen.has(r.audio.sha256)) {
        excludedDuplicates.push(r.id);
        return false;
      }
      seen.add(r.audio.sha256);
      return true;
    })
    .map((r) => ({
      sourceId: r.id,
      comparison: compareTiming(timing, timingInput(r)),
    }));
  const matches = candidates
    .filter((c) => c.comparison.status === "comparable")
    .sort(
      (a, b) =>
        (a.comparison.status === "comparable" ? a.comparison.value : 0) -
          (b.comparison.status === "comparable" ? b.comparison.value : 0) ||
        a.sourceId.localeCompare(b.sourceId),
    );
  return {
    blockId: active.id,
    metric: METRIC,
    measurements: measureTiming(timing),
    seed: {
      sourceId: active.seed.recordingId,
      comparison: compareTiming(timing, blockTiming(seed)),
      originalOffsetSeconds: active.seed.originalOffsetSeconds,
      spanSeconds: span(seed),
      currentSpanSeconds: span(active),
    },
    previous: previous
      ? {
          comparison: compareTiming(blockTiming(previous), timing),
          spanSeconds: span(previous),
          label: "Previous local revision (user-authored timing)",
        }
      : null,
    catalogCount: catalog.length,
    candidateCount: candidates.length,
    eligibleCount: matches.length,
    excludedIds,
    excludedDuplicates,
    matches,
    rejected: candidates.filter((c) => c.comparison.status !== "comparable"),
  };
}
export function beforeAfter(before: Draft, after: Draft) {
  const ids = [
    ...new Set([...before.blocks, ...after.blocks].map((b) => b.id)),
  ];
  return ids.map((id) => {
    const old = before.blocks.find((b) => b.id === id),
      current = after.blocks.find((b) => b.id === id);
    return {
      blockId: id,
      beforePosition: old ? before.blocks.indexOf(old) + 1 : null,
      afterPosition: current ? after.blocks.indexOf(current) + 1 : null,
      beforeSpan: old ? span(old) : null,
      afterSpan: current ? span(current) : null,
      beforeSpacing: old?.spacingAfter ?? null,
      afterSpacing: current?.spacingAfter ?? null,
      comparison:
        old && current
          ? compareTiming(blockTiming(old), blockTiming(current))
          : null,
    };
  });
}
