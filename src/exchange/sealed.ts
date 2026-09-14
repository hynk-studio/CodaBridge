import { boundedJson, parseEnvelope, utf8 } from "./format.ts";
import { EXCHANGE_LIMITS, exactShape, type Envelope } from "./model.ts";
import { scanJson } from "./json.ts";

export const SEALED_LIMITS = Object.freeze({ bytes: 1024 * 1024, ciphertext: 524304, code: 80 });
const UNLOCK_ERROR = "Could not unlock: wrong key or damaged file.";
export interface SealedHeader { format: "codabridge-sealed"; version: 1; algorithm: "AES-256-GCM"; tagLength: 128; iv: string }
export interface Sealed extends SealedHeader { ciphertext: string }
// An artifact contains ciphertext only. No inner IDs, digest, content or key.
export interface SealedArtifact { wrapper: Sealed; file: File }
export interface PreparedSeal { artifact: SealedArtifact; code: string }

export function cryptoAvailable() {
  return globalThis.isSecureContext !== false && typeof globalThis.crypto?.getRandomValues === "function" &&
    ["encrypt", "decrypt", "importKey", "digest"].every(k => typeof Reflect.get(globalThis.crypto?.subtle ?? {}, k) === "function");
}
function nativeCrypto() {
  if (!cryptoAvailable()) throw new Error("Sealed files are unavailable here. Use a secure context with native Web Crypto.");
  return globalThis.crypto;
}
export function base64url(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}
export function decode64(value: unknown, min: number, max: number) {
  if (typeof value !== "string" || value.length < Math.ceil(min * 4 / 3) || value.length > Math.ceil(max * 4 / 3) || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) throw new Error("Invalid sealed encoding.");
  const bytes = Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
  if (bytes.length < min || bytes.length > max || base64url(bytes) !== value) { bytes.fill(0); throw new Error("Invalid sealed encoding."); }
  return bytes;
}
export function openingKey(code: string) {
  // Only surrounding ASCII space, TAB, CR and LF; never normalize the key.
  if (typeof code !== "string" || code.length > SEALED_LIMITS.code) throw new Error("Invalid opening code.");
  const clean = code.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, "");
  if (!/^cbsk1-[A-Za-z0-9_-]{43}$/.test(clean)) throw new Error("Invalid opening code.");
  try { return decode64(clean.slice(6), 32, 32); } catch { throw new Error("Invalid opening code."); }
}
export function header(v: SealedHeader): SealedHeader {
  return { format: v.format, version: v.version, algorithm: v.algorithm, tagLength: v.tagLength, iv: v.iv };
}
export const authenticatedHeader = (v: SealedHeader) => utf8(JSON.stringify(header(v)));
export function parseSealed(text: string): Sealed {
  const raw = scanJson(text, SEALED_LIMITS.bytes, 1, 32);
  const v = exactShape(raw, ["format", "version", "algorithm", "tagLength", "iv", "ciphertext"]);
  if (v.format !== "codabridge-sealed" || v.version !== 1 || v.algorithm !== "AES-256-GCM" || v.tagLength !== 128) throw new Error("Unsupported sealed format, version or algorithm.");
  decode64(v.iv, 12, 12).fill(0); decode64(v.ciphertext, 16, SEALED_LIMITS.ciphertext).fill(0);
  return Object.freeze({ format: "codabridge-sealed", version: 1, algorithm: "AES-256-GCM", tagLength: 128, iv: v.iv as string, ciphertext: v.ciphertext as string });
}
export function sealedArtifact(wrapper: Sealed, bytes = utf8(JSON.stringify(wrapper))): SealedArtifact {
  if (bytes.length > SEALED_LIMITS.bytes) throw new Error("Sealed file exceeds 1 MiB.");
  return Object.freeze({ wrapper, file: new File([bytes], `codabridge-sealed-${wrapper.iv}.coda.sealed.json`, { type: "application/json", lastModified: 0 }) });
}
export async function encryptEnvelope(envelope: Envelope): Promise<PreparedSeal> {
  const api = nativeCrypto();
  let raw: Uint8Array<ArrayBuffer> | null = null, iv: Uint8Array<ArrayBuffer> | null = null, plaintext: Uint8Array<ArrayBuffer> | null = null, key: CryptoKey | null = null;
  try {
    // Independently revalidate the finalized snapshot, including its digests.
    plaintext = utf8(boundedJson(await parseEnvelope(boundedJson(envelope))));
    raw = new Uint8Array(32); iv = new Uint8Array(12);
    api.getRandomValues(raw); api.getRandomValues(iv);
    const h: SealedHeader = { format: "codabridge-sealed", version: 1, algorithm: "AES-256-GCM", tagLength: 128, iv: base64url(iv) };
    key = await api.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
    const encrypted = new Uint8Array(await api.subtle.encrypt({ name: "AES-GCM", iv, additionalData: authenticatedHeader(h), tagLength: 128 }, key, plaintext));
    const wrapper = Object.freeze({ ...h, ciphertext: base64url(encrypted) });
    encrypted.fill(0);
    return { artifact: sealedArtifact(wrapper), code: `cbsk1-${base64url(raw)}` };
  } catch { throw new Error("Could not prepare a sealed file. Current work is unchanged; no plaintext file was prepared."); }
  finally { raw?.fill(0); iv?.fill(0); plaintext?.fill(0); raw = null; iv = null; plaintext = null; key = null; }
}
export async function decryptEnvelope(artifact: SealedArtifact, code: string): Promise<Envelope> {
  const api = nativeCrypto();
  let raw: Uint8Array<ArrayBuffer> | null = null, plaintext: Uint8Array<ArrayBuffer> | null = null, key: CryptoKey | null = null;
  try {
    const sealed = parseSealed(JSON.stringify(artifact.wrapper));
    raw = openingKey(code); code = "";
    key = await api.subtle.importKey("raw", raw, "AES-GCM", false, ["decrypt"]);
    raw.fill(0); raw = null;
    plaintext = new Uint8Array(await api.subtle.decrypt({ name: "AES-GCM", iv: decode64(sealed.iv, 12, 12), additionalData: authenticatedHeader(sealed), tagLength: 128 }, key, decode64(sealed.ciphertext, 16, SEALED_LIMITS.ciphertext)));
    if (plaintext.length > EXCHANGE_LIMITS.bytes) throw new Error();
    return await parseEnvelope(new TextDecoder("utf-8", { fatal: true }).decode(plaintext));
  } catch { throw new Error(UNLOCK_ERROR); }
  finally { code = ""; raw?.fill(0); plaintext?.fill(0); raw = null; plaintext = null; key = null; }
}

export type CodaCandidate = { kind: "plain"; envelope: Envelope } | { kind: "sealed"; artifact: SealedArtifact };
export async function readExchangeFile(file: File): Promise<CodaCandidate> {
  if (file.size > SEALED_LIMITS.bytes) throw new Error("Selected file exceeds 1 MiB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    if (bytes.length > SEALED_LIMITS.bytes) throw new Error("Selected file exceeds 1 MiB.");
    let text: string;
    try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("Coda file must contain valid UTF-8."); }
    // Dispatch is bounded; each parser then enforces its own unchanged limits.
    const raw = scanJson(text, SEALED_LIMITS.bytes, EXCHANGE_LIMITS.depth, EXCHANGE_LIMITS.nodes * 2);
    if ((raw as { format?: unknown } | null)?.format === "codabridge-sealed") return { kind: "sealed", artifact: sealedArtifact(parseSealed(text), bytes) };
    return { kind: "plain", envelope: await parseEnvelope(text) };
  } finally { bytes.fill(0); }
}
