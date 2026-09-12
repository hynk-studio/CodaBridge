import { CATALOG_VERSION, recordings } from "../domain/catalog.ts";
import { METRIC, type TimingInput } from "../domain/timing.ts";
import type { Recording } from "../domain/types.ts";

// Engineering limits for this editor, not limits on whale biology.
export const COMPOSER_LIMITS = Object.freeze({
  blocks: 4,
  markers: 12,
  phraseSeconds: 30,
  gapMin: 0.04,
  gapMax: 5,
  spacingMin: 0.05,
  spacingMax: 5,
  scaleMin: 0.25,
  scaleMax: 4,
  operations: 8,
  codebook: 12,
  history: 40,
  projectBytes: 131072,
  requestBytes: 32768,
});
export const CREATION_IDENTITY =
  "Human-created · synthetic timing sonification";
export const CREATION_LIMITATIONS = [
  "Meaning to sperm whales: unknown. Creator-assigned meaning is personal, not a translation.",
  "Seed markers are machine estimates, not verified coda boundaries or human-reviewed onsets.",
  "Timing similarity is descriptive. It does not establish identity, intent, biological naturalness or shared meaning.",
  "Each block is compared separately in a four-recording catalog. Unequal counts are not aligned or padded.",
  "Synthetic clicks illustrate timing; they do not reproduce a whale's voice. No wildlife playback use.",
] as const;

export class ComposerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ComposerError";
  }
}
export interface SeedRef {
  recordingId: string;
  sourceRevision: string;
  annotationVersion: string;
  originalOffsetSeconds: number;
}
export interface Block {
  id: string;
  times: number[];
  spacingAfter: number;
  meaning: string;
  seed: SeedRef;
}
export interface Draft {
  version: 1;
  id: string;
  revision: number;
  title: string;
  intention: string;
  blocks: Block[];
  ancestry: SeedRef[];
}
export type Operation =
  | { op: "scale_duration"; blockId: string; factor: number }
  | { op: "set_gap"; blockId: string; gapIndex: number; seconds: number }
  | { op: "set_spacing"; blockId: string; seconds: number }
  | { op: "duplicate_block"; blockId: string; newBlockId: string }
  | { op: "remove_block"; blockId: string }
  | { op: "move_block"; blockId: string; toIndex: number }
  | { op: "add_seed"; sourceId: string; newBlockId: string };

export function fields(
  value: unknown,
  keys: string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).length !== keys.length ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw new ComposerError("Invalid project or operation fields.");
  return value as Record<string, unknown>;
}
export function text(value: unknown, max = 160): string {
  // Explicit import boundary: reject non-printing controls, permit ordinary whitespace.
  if (
    typeof value !== "string" ||
    value.length > max ||
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  )
    throw new ComposerError(
      "Text exceeds the allowed size or contains control characters.",
    );
  return value;
}
export function id(value: unknown): string {
  if (typeof value !== "string" || !/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(value))
    throw new ComposerError("Invalid stable ID.");
  return value;
}
export const newId = () => `b-${crypto.randomUUID()}`;
export function numberIn(value: unknown, min: number, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  )
    throw new ComposerError(`Use a finite value from ${min} to ${max}.`);
  return value;
}
export function seedRef(r: Recording): SeedRef {
  return {
    recordingId: r.id,
    sourceRevision: r.source.revision,
    annotationVersion: r.annotation.version,
    originalOffsetSeconds: r.annotation.clickTimesSeconds[0],
  };
}
export function resolveSeed(value: unknown): SeedRef {
  const input = fields(value, [
    "recordingId",
    "sourceRevision",
    "annotationVersion",
    "originalOffsetSeconds",
  ]);
  const source = recordings.find((r) => r.id === input.recordingId);
  if (
    !source ||
    Object.entries(seedRef(source)).some(([key, v]) => input[key] !== v)
  )
    throw new ComposerError(
      "Source reference does not match the pinned catalog.",
    );
  return seedRef(source);
}
export function seedBlock(sourceId: string, blockId = newId()): Block {
  const source = recordings.find((r) => r.id === sourceId);
  if (!source) throw new ComposerError("Unknown seed recording.");
  const offset = source.annotation.clickTimesSeconds[0];
  return {
    id: id(blockId),
    times: source.annotation.clickTimesSeconds.map((t) => t - offset),
    spacingAfter: 0.5,
    meaning: "",
    seed: seedRef(source),
  };
}
export function createDraft(sourceId: string): Draft {
  const block = seedBlock(sourceId);
  return {
    version: 1,
    id: `p-${crypto.randomUUID()}`,
    revision: 0,
    title: "My first coda",
    intention: "",
    blocks: [block],
    ancestry: [structuredClone(block.seed)],
  };
}
export function parseBlock(value: unknown): Block {
  const v = fields(value, ["id", "times", "spacingAfter", "meaning", "seed"]);
  if (
    !Array.isArray(v.times) ||
    v.times.length < 2 ||
    v.times.length > COMPOSER_LIMITS.markers ||
    v.times[0] !== 0
  )
    throw new ComposerError("A block needs 2–12 markers, starting at zero.");
  const times = v.times.map((t) =>
    numberIn(t, 0, COMPOSER_LIMITS.phraseSeconds),
  );
  for (let i = 1; i < times.length; i++) {
    // Tiny tolerance only for IEEE-754 subtraction at the exact engineering bounds.
    const gap = times[i] - times[i - 1];
    if (
      gap < COMPOSER_LIMITS.gapMin - 1e-12 ||
      gap > COMPOSER_LIMITS.gapMax + 1e-12
    )
      throw new ComposerError(
        "Each marker gap must be between 0.04 and 5 seconds.",
      );
  }
  return {
    id: id(v.id),
    times,
    spacingAfter: numberIn(
      v.spacingAfter,
      COMPOSER_LIMITS.spacingMin,
      COMPOSER_LIMITS.spacingMax,
    ),
    meaning: text(v.meaning),
    seed: resolveSeed(v.seed),
  };
}
export const span = (block: Block) => block.times[block.times.length - 1];
export const phraseDuration = (draft: Draft) =>
  draft.blocks.reduce(
    (total, b, i) =>
      total + span(b) + (i < draft.blocks.length - 1 ? b.spacingAfter : 0),
    0,
  );
export function parseDraft(value: unknown): Draft {
  const v = fields(value, [
    "version",
    "id",
    "revision",
    "title",
    "intention",
    "blocks",
    "ancestry",
  ]);
  if (
    v.version !== 1 ||
    !Number.isSafeInteger(v.revision) ||
    (v.revision as number) < 0 ||
    (v.revision as number) > 1e9
  )
    throw new ComposerError("Unsupported draft version or revision.");
  if (
    !Array.isArray(v.blocks) ||
    !v.blocks.length ||
    v.blocks.length > COMPOSER_LIMITS.blocks ||
    !Array.isArray(v.ancestry) ||
    !v.ancestry.length ||
    v.ancestry.length > recordings.length
  )
    throw new ComposerError(
      "A phrase needs 1–4 blocks and valid seed references.",
    );
  const blocks = v.blocks.map(parseBlock),
    ancestry = v.ancestry.map(resolveSeed);
  if (
    new Set(blocks.map((b) => b.id)).size !== blocks.length ||
    new Set(ancestry.map((s) => s.recordingId)).size !== ancestry.length ||
    blocks.some(
      (b) => !ancestry.some((s) => s.recordingId === b.seed.recordingId),
    )
  )
    throw new ComposerError("Duplicate block IDs or missing ancestry.");
  const draft: Draft = {
    version: 1,
    id: id(v.id),
    revision: v.revision as number,
    title: text(v.title, 80),
    intention: text(v.intention, 240),
    blocks,
    ancestry,
  };
  if (phraseDuration(draft) > COMPOSER_LIMITS.phraseSeconds)
    throw new ComposerError("Keep the phrase within 30 seconds.");
  return draft;
}
export const blockTiming = (b: Block): TimingInput => ({
  durationSeconds: span(b),
  clickTimesSeconds: b.times,
  selectedIntervalSeconds: { start: 0, end: span(b) },
});
export function binding(
  draft: Draft,
  activeId: string,
  previous: Block | null = null,
): string {
  // Exact canonical content, not a collision-prone short hash. Source/annotation
  // references are validated; catalog/metric versions also bind a pending result.
  return JSON.stringify({
    catalogVersion: CATALOG_VERSION,
    metric: METRIC,
    draft: parseDraft(draft),
    activeId,
    previous: previous ? parseBlock(previous) : null,
  });
}
export function parseOperation(value: unknown): Operation {
  const op = (value as { op?: unknown } | null)?.op;
  const keys: Record<string, string[]> = {
    scale_duration: ["blockId", "factor"],
    set_gap: ["blockId", "gapIndex", "seconds"],
    set_spacing: ["blockId", "seconds"],
    duplicate_block: ["blockId", "newBlockId"],
    remove_block: ["blockId"],
    move_block: ["blockId", "toIndex"],
    add_seed: ["sourceId", "newBlockId"],
  };
  if (typeof op !== "string" || !Object.hasOwn(keys, op))
    throw new ComposerError("Unknown edit operation.");
  fields(value, ["op", ...keys[op]]);
  return structuredClone(value) as Operation; // Types/IDs/numbers checked during atomic application below.
}
export function applyOperations(input: Draft, values: unknown[]): Draft {
  const original = parseDraft(input);
  if (
    !Array.isArray(values) ||
    !values.length ||
    values.length > COMPOSER_LIMITS.operations
  )
    throw new ComposerError("A proposal must contain 1–8 operations.");
  const next = structuredClone(original);
  for (const raw of values) {
    const op = parseOperation(raw);
    if (op.op === "add_seed") {
      if (next.blocks.some((b) => b.id === op.newBlockId))
        throw new ComposerError("A block ID already exists.");
      const block = seedBlock(id(op.sourceId), id(op.newBlockId));
      next.blocks.push(block);
      if (!next.ancestry.some((s) => s.recordingId === block.seed.recordingId))
        next.ancestry.push(structuredClone(block.seed));
    } else {
      const index = next.blocks.findIndex((b) => b.id === id(op.blockId));
      if (index < 0) throw new ComposerError("The block is stale or absent.");
      const b = next.blocks[index];
      switch (op.op) {
        case "scale_duration":
          b.times = b.times.map(
            (t) =>
              t *
              numberIn(
                op.factor,
                COMPOSER_LIMITS.scaleMin,
                COMPOSER_LIMITS.scaleMax,
              ),
          );
          break;
        case "set_gap": {
          if (
            !Number.isInteger(op.gapIndex) ||
            op.gapIndex < 0 ||
            op.gapIndex >= b.times.length - 1
          )
            throw new ComposerError("Unknown gap.");
          const delta =
            numberIn(
              op.seconds,
              COMPOSER_LIMITS.gapMin,
              COMPOSER_LIMITS.gapMax,
            ) -
            (b.times[op.gapIndex + 1] - b.times[op.gapIndex]);
          b.times = b.times.map((t, i) => (i > op.gapIndex ? t + delta : t));
          break;
        }
        case "set_spacing":
          if (index === next.blocks.length - 1)
            throw new ComposerError(
              "No between-block space follows the final block.",
            );
          b.spacingAfter = numberIn(
            op.seconds,
            COMPOSER_LIMITS.spacingMin,
            COMPOSER_LIMITS.spacingMax,
          );
          break;
        case "duplicate_block":
          if (next.blocks.some((b) => b.id === op.newBlockId))
            throw new ComposerError("A block ID already exists.");
          next.blocks.splice(index + 1, 0, {
            ...structuredClone(b),
            id: id(op.newBlockId),
          });
          break;
        case "remove_block":
          next.blocks.splice(index, 1);
          break;
        case "move_block":
          if (
            !Number.isInteger(op.toIndex) ||
            op.toIndex < 0 ||
            op.toIndex >= next.blocks.length
          )
            throw new ComposerError("Invalid block position.");
          next.blocks.splice(index, 1);
          next.blocks.splice(op.toIndex, 0, b);
          break;
      }
    }
    parseDraft(next); // Every step is valid; no partial state escapes if any step fails.
  }
  if (JSON.stringify(next) === JSON.stringify(original))
    throw new ComposerError("This proposal makes no change.");
  next.revision++;
  return parseDraft(next);
}
export interface History {
  present: Draft;
  past: Draft[];
  future: Draft[];
}
export function commitDraft(history: History, draft: Draft): History {
  const next = parseDraft({ ...draft, revision: history.present.revision + 1 });
  if (
    JSON.stringify({ ...next, revision: 0 }) ===
    JSON.stringify({ ...history.present, revision: 0 })
  )
    return history;
  return {
    present: next,
    past: [...history.past, history.present].slice(-COMPOSER_LIMITS.history),
    future: [],
  };
}
export function travel(history: History, direction: "undo" | "redo"): History {
  const list = direction === "undo" ? history.past : history.future;
  if (!list.length) return history;
  const present = parseDraft({
    ...list[list.length - 1],
    revision: history.present.revision + 1,
  });
  return direction === "undo"
    ? {
        present,
        past: list.slice(0, -1),
        future: [...history.future, history.present],
      }
    : {
        present,
        past: [...history.past, history.present],
        future: list.slice(0, -1),
      };
}
