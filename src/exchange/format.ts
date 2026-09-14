import { scanJson } from "./json.ts";
import { CATALOG_VERSION } from "../domain/catalog.ts";
import { RENDERER } from "../composer/sound.ts";
import { EXCHANGE_LIMITS, INTERPRETATION, digestText, exactShape, guardStructure, parsePayload, parseTurnContent, turnContent, type Envelope, type Payload, type TurnContent } from "./model.ts";

export const utf8 = (text: string) => new TextEncoder().encode(text);
export function boundedJson(value: unknown) {
  const json = JSON.stringify(value);
  if (utf8(json).length > EXCHANGE_LIMITS.bytes) throw new Error("Coda file exceeds 512 KiB.");
  return json;
}
// Fixed schema field order is supplied by the validators, not arbitrary keys.
// ECMAScript JSON number/string spelling: finite binary64; -0 becomes 0;
// Unicode is preserved without normalization; no whitespace or trailing newline.
export const canonicalTurn = (value: unknown) => boundedJson(parseTurnContent(value));
export const canonicalPayload = (value: unknown) => boundedJson(parsePayload(value));
export async function sha256(text: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", utf8(text))), b => b.toString(16).padStart(2, "0")).join("");
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
async function sealEnvelope(value: Payload): Promise<Envelope> {
  const payload = parsePayload(value);
  const result = { ...payload, digest: await sha256(canonicalPayload(payload)) };
  boundedJson(result); // Output cap includes its digest.
  return freeze(result);
}
export async function appendTurn(previous: Envelope | null, input: TurnContent): Promise<Envelope> {
  const content = parseTurnContent(input);
  previous = previous ? await parseEnvelope(boundedJson(previous)) : null;
  const turn = { ...content, digest: await sha256(canonicalTurn(content)) };
  return sealEnvelope({ format: "codabridge-exchange", version: 1, protection: "none", catalogVersion: CATALOG_VERSION,
    rendererVersion: RENDERER.version, interpretation: INTERPRETATION, exchangeId: previous?.exchangeId ?? content.exchangeId,
    turns: [...(previous?.turns ?? []), turn], arrangement: { kind: "human-authored", gaps: [...(previous?.arrangement.gaps ?? []), ...(previous ? [EXCHANGE_LIMITS.gapDefault] : [])] } });
}
export async function changeArrangement(envelope: Envelope, index: number, seconds: number) {
  envelope = await parseEnvelope(boundedJson(envelope));
  if (!Number.isInteger(index) || index < 0 || index >= envelope.arrangement.gaps.length) throw new Error("Unknown turn gap.");
  const { digest: _digest, ...payload } = envelope;
  return sealEnvelope({ ...payload, arrangement: { kind: "human-authored", gaps: payload.arrangement.gaps.map((g, i) => i === index ? seconds : g) } });
}
export function decodeJson(text: string): unknown {
  if (utf8(text).length > EXCHANGE_LIMITS.bytes) throw new Error("Coda file exceeds 512 KiB.");
  return scanJson(text, EXCHANGE_LIMITS.bytes, EXCHANGE_LIMITS.depth);
}
export async function parseEnvelope(text: string): Promise<Envelope> {
  const raw = decodeJson(text); guardStructure(raw);
  const v = exactShape(raw, ["format", "version", "protection", "catalogVersion", "rendererVersion", "interpretation", "exchangeId", "turns", "arrangement", "digest"]);
  const { digest, ...fields } = v;
  const expected = digestText(digest), payload = parsePayload(fields);
  for (const turn of payload.turns) {
    if (await sha256(canonicalTurn(turnContent(turn))) !== turn.digest) throw new Error("Turn checksum mismatch.");
  }
  if (await sha256(canonicalPayload(payload)) !== expected) throw new Error("Exchange checksum mismatch.");
  return freeze({ ...payload, digest: expected });
}
export async function readCodaFile(file: File) {
  if (file.size > EXCHANGE_LIMITS.bytes) throw new Error("Coda file exceeds 512 KiB.");
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > EXCHANGE_LIMITS.bytes) throw new Error("Coda file exceeds 512 KiB.");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("Coda file must contain valid UTF-8."); }
  return parseEnvelope(text);
}
export const filename = (envelope: Envelope) => `codabridge-${envelope.exchangeId}-${envelope.turns.length}.coda.json`;
export function preparedFile(envelope: Envelope) {
  return new File([boundedJson(envelope)], filename(envelope), { type: "application/json", lastModified: 0 });
}

// Component-owned request generation, shared by reads, hashes and edits.
export class Generation {
  private revision = 0;
  next() { return ++this.revision; }
  current(token: number) { return token === this.revision; }
}
