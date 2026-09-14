import { CATALOG_VERSION, recordings } from "../domain/catalog.ts";
import { fields, id, newId, numberIn, parseDraft, resolveSeed, seedBlock, text, type Block, type Draft } from "../composer/model.ts";
import { RENDERER } from "../composer/sound.ts";

export const EXCHANGE_LIMITS = Object.freeze({ turns: 8, bytes: 512 * 1024, span: 120, gapMin: .05, gapMax: 5, gapDefault: .5, alias: 48, label: 80, message: 2000, depth: 12, nodes: 8192 });
export const INTERPRETATION = "Human-created synthetic timing; animal meaning unknown; plaintext, not encrypted; authorship unverified.";

// A compact descriptor rebuilt from this catalog, never import-supplied prose.
export function sourceDescriptor(recordingId: string) {
  const r = recordings.find(r => r.id === recordingId);
  if (!r) throw new Error("Unsupported source recording.");
  return {
    recordingId: r.id, dataset: r.source.dataset, sourceRevision: r.source.revision,
    filename: r.source.filename, audioSha256: r.audio.sha256, audioBytes: r.audio.bytes,
    transformations: [...r.audio.transformations], originalOffsetSeconds: r.annotation.clickTimesSeconds[0],
    originalClickTimesSeconds: [...r.annotation.clickTimesSeconds],
    annotationVersion: r.annotation.version, annotationMethod: r.annotation.method,
    annotationStatus: r.annotation.status, humanReview: r.annotation.humanReview,
    license: r.source.license, attribution: r.source.attribution, citation: r.source.citation,
  };
}
export type Source = ReturnType<typeof sourceDescriptor>;
export interface PhraseBlock { id: string; times: number[]; spacingAfter: number; source: Source }
export interface Phrase { blocks: PhraseBlock[] }
export interface Parent { turnId: string; digest: string }
export interface TurnContent {
  id: string; exchangeId: string; role: "A" | "B"; alias: string; label: string;
  createdAt: string | null; message: string; phrase: Phrase; parent: Parent | null;
}
export interface Turn extends TurnContent { digest: string }
export interface Payload {
  format: "codabridge-exchange"; version: 1; protection: "none";
  catalogVersion: string; rendererVersion: string; interpretation: typeof INTERPRETATION;
  exchangeId: string; turns: Turn[]; arrangement: { kind: "human-authored"; gaps: number[] };
}
export interface Envelope extends Payload { digest: string }

export function exactShape(value: unknown, keys: string[]) { return fields(value, keys); }
export function humanText(value: unknown, max: number) {
  const valid = text(value, max);
  // UTF-16 limits; preserve Unicode exactly, but reject unpaired surrogates.
  for (let i = 0; i < valid.length; i++) {
    const code = valid.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = valid.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error("Text contains an unpaired Unicode surrogate.");
    } else if (code >= 0xdc00 && code <= 0xdfff) throw new Error("Text contains an unpaired Unicode surrogate.");
  }
  return valid;
}
export function digestText(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new Error("Invalid SHA-256 digest.");
  return value;
}
function source(value: unknown): Source {
  const recordingId = (value as Partial<Source> | null)?.recordingId;
  const expected = sourceDescriptor(typeof recordingId === "string" ? recordingId : "");
  const v = exactShape(value, Object.keys(expected));
  for (const [key, actual] of Object.entries(expected)) {
    if (JSON.stringify(v[key]) !== JSON.stringify(actual)) throw new Error("Source descriptor does not match the pinned catalog.");
  }
  return expected;
}
export function editorDraft(phrase: Phrase): Draft {
  const blocks: Block[] = phrase.blocks.map(b => ({
    id: b.id, times: [...b.times], spacingAfter: b.spacingAfter, meaning: "",
    seed: resolveSeed({ recordingId: b.source.recordingId, sourceRevision: b.source.sourceRevision,
      annotationVersion: b.source.annotationVersion, originalOffsetSeconds: b.source.originalOffsetSeconds }),
  }));
  return parseDraft({ version: 1, id: "exchange-editor", revision: 0, title: "", intention: "", blocks,
    ancestry: [...new Map(blocks.map(b => [b.seed.recordingId, b.seed])).values()] });
}
export function phraseFromBlocks(blocks: Block[], freshIds = false): Phrase {
  blocks.forEach(b => resolveSeed(b.seed));
  return parsePhrase({ blocks: blocks.map(b => ({ id: freshIds ? newId() : b.id, times: [...b.times], spacingAfter: b.spacingAfter, source: sourceDescriptor(b.seed.recordingId) })) });
}
export function copyComposerTiming(draft: Draft, activeId: string, scope: "selected" | "phrase"): Phrase {
  const selected = scope === "phrase" ? draft.blocks : draft.blocks.filter(b => b.id === activeId);
  if (!selected.length) throw new Error("Select a Composer block first.");
  // Validate the chosen references, then project timing only. Removed ancestry,
  // project IDs/revisions, creator text, saved analysis and codebook never cross.
  for (const block of selected) resolveSeed(block.seed);
  return phraseFromBlocks(selected, true);
}
export const seedPhrase = (sourceId: string) => phraseFromBlocks([seedBlock(sourceId)]);
export function parsePhrase(value: unknown): Phrase {
  const v = exactShape(value, ["blocks"]);
  if (!Array.isArray(v.blocks) || !v.blocks.length || v.blocks.length > 4) throw new Error("A transmission needs 1–4 blocks.");
  const phrase: Phrase = { blocks: v.blocks.map(raw => {
    const b = exactShape(raw, ["id", "times", "spacingAfter", "source"]);
    if (!Array.isArray(b.times) || b.times.length < 2 || b.times.length > 12) throw new Error("A block needs 2–12 clicks.");
    return { id: id(b.id), times: b.times.map(t => numberIn(t, 0, 30) || 0), spacingAfter: numberIn(b.spacingAfter, .05, 5), source: source(b.source) };
  }) };
  editorDraft(phrase); // The original owner enforces gap, block, ID and phrase bounds.
  return phrase;
}
export function phraseSpan(phrase: Phrase) {
  return phrase.blocks.reduce((sum, b, i) => sum + b.times.at(-1)! + (i < phrase.blocks.length - 1 ? b.spacingAfter : 0), 0);
}
export function parseTurnContent(value: unknown): TurnContent {
  const v = exactShape(value, ["id", "exchangeId", "role", "alias", "label", "createdAt", "message", "phrase", "parent"]);
  if (v.role !== "A" && v.role !== "B") throw new Error("Turn roles must be A or B.");
  let createdAt: string | null = null;
  if (v.createdAt !== null) {
    createdAt = humanText(v.createdAt, 24);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(createdAt) || !Number.isFinite(Date.parse(createdAt)) || new Date(createdAt).toISOString() !== createdAt) throw new Error("Invalid self-declared creation time.");
  }
  const parent = v.parent === null ? null : exactShape(v.parent, ["turnId", "digest"]);
  return { id: id(v.id), exchangeId: id(v.exchangeId), role: v.role,
    alias: humanText(v.alias, EXCHANGE_LIMITS.alias), label: humanText(v.label, EXCHANGE_LIMITS.label), createdAt,
    message: humanText(v.message, EXCHANGE_LIMITS.message), phrase: parsePhrase(v.phrase),
    parent: parent ? { turnId: id(parent.turnId), digest: digestText(parent.digest) } : null };
}
export function turnContent(turn: Turn): TurnContent {
  const { digest: _digest, ...content } = turn;
  return parseTurnContent(content);
}
export function guardStructure(value: unknown) {
  const stack = [{ value, depth: 0 }]; let nodes = 0;
  while (stack.length) {
    const item = stack.pop()!;
    if (++nodes > EXCHANGE_LIMITS.nodes || item.depth > EXCHANGE_LIMITS.depth) throw new Error("Coda structure is too complex.");
    const v = item.value;
    if (typeof v === "number" && !Number.isFinite(v)) throw new Error("Nonfinite coda number.");
    if (typeof v === "string" && v.length > EXCHANGE_LIMITS.message) throw new Error("Coda text is too long.");
    if (v && typeof v === "object") {
      if (Object.keys(v).length > 128) throw new Error("Coda container is too large.");
      for (const [key, child] of Object.entries(v)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Unsafe coda field.");
        stack.push({ value: child, depth: item.depth + 1 });
      }
    }
  }
}
export function parsePayload(value: unknown): Payload {
  guardStructure(value);
  const v = exactShape(value, ["format", "version", "protection", "catalogVersion", "rendererVersion", "interpretation", "exchangeId", "turns", "arrangement"]);
  if (v.format !== "codabridge-exchange" || v.version !== 1 || v.protection !== "none") throw new Error("Unsupported coda format, version or protection.");
  if (v.catalogVersion !== CATALOG_VERSION || v.rendererVersion !== RENDERER.version || v.interpretation !== INTERPRETATION) throw new Error("Unsupported catalog, renderer or interpretation boundary.");
  if (!Array.isArray(v.turns) || !v.turns.length || v.turns.length > EXCHANGE_LIMITS.turns) throw new Error("An exchange needs 1–8 turns.");
  const exchangeId = id(v.exchangeId), ids = new Set<string>();
  const turns = v.turns.map(raw => {
    const t = exactShape(raw, ["id", "exchangeId", "role", "alias", "label", "createdAt", "message", "phrase", "parent", "digest"]);
    const { digest, ...content } = t;
    return { ...parseTurnContent(content), digest: digestText(digest) };
  });
  for (const [i, turn] of turns.entries()) {
    if (ids.has(turn.id) || turn.exchangeId !== exchangeId || turn.role !== (i % 2 ? "B" : "A")) throw new Error("Duplicate turn ID or invalid exchange/role order.");
    ids.add(turn.id);
    const previous = turns[i - 1];
    if (!previous ? turn.parent !== null : !turn.parent || turn.parent.turnId !== previous.id || turn.parent.digest !== previous.digest) throw new Error("Broken parent ID/digest chain.");
  }
  const a = exactShape(v.arrangement, ["kind", "gaps"]);
  if (a.kind !== "human-authored" || !Array.isArray(a.gaps) || a.gaps.length !== turns.length - 1) throw new Error("Invalid playback arrangement dimensions.");
  const gaps = a.gaps.map(g => numberIn(g, EXCHANGE_LIMITS.gapMin, EXCHANGE_LIMITS.gapMax));
  const span = turns.reduce((sum, t, i) => sum + phraseSpan(t.phrase) + (gaps[i] ?? 0), 0);
  numberIn(span, 0, EXCHANGE_LIMITS.span);
  return { format: "codabridge-exchange", version: 1, protection: "none", catalogVersion: CATALOG_VERSION,
    rendererVersion: RENDERER.version, interpretation: INTERPRETATION, exchangeId, turns, arrangement: { kind: "human-authored", gaps } };
}
