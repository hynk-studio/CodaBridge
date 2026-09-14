// PUBLIC TEST ONLY artifact utility. Node crypto + the independent Python
// Exchange checker; never imports the production sealed or Exchange helpers.
import assert from "node:assert/strict";
import { createCipheriv, createDecipheriv, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

export const sha = bytes => createHash("sha256").update(bytes).digest("hex");
function decode(text, min, max) {
  assert.equal(typeof text, "string"); assert.match(text, /^[A-Za-z0-9_-]+$/);
  assert.ok(text.length <= Math.ceil(max * 4 / 3));
  const value = Buffer.from(text, "base64url");
  assert.ok(value.length >= min && value.length <= max); assert.equal(value.toString("base64url"), text); return value;
}
function keyBytes(code) { assert.match(code, /^cbsk1-[A-Za-z0-9_-]{43}$/); return decode(code.slice(6), 32, 32); }
function aad(w) { return Buffer.from(JSON.stringify({ format: w.format, version: w.version, algorithm: w.algorithm, tagLength: w.tagLength, iv: w.iv })); }
export function decryptArtifact(bytes, code) {
  assert.ok(bytes.length <= 1048576);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const keys = [...text.matchAll(/("(?:[^"\\]|\\.)*")\s*:/g)].map(m => JSON.parse(m[1]));
  assert.equal(new Set(keys).size, keys.length);
  const w = JSON.parse(text);
  assert.deepEqual(Object.keys(w).sort(), ["algorithm", "ciphertext", "format", "iv", "tagLength", "version"]);
  assert.equal(w.format, "codabridge-sealed"); assert.equal(w.version, 1); assert.equal(w.algorithm, "AES-256-GCM"); assert.equal(w.tagLength, 128);
  const raw = keyBytes(code), iv = decode(w.iv, 12, 12), joined = decode(w.ciphertext, 16, 524304);
  try {
    const decipher = createDecipheriv("aes-256-gcm", raw, iv, { authTagLength: 16 });
    decipher.setAAD(aad(w)); decipher.setAuthTag(joined.subarray(-16));
    const plain = Buffer.concat([decipher.update(joined.subarray(0, -16)), decipher.final()]);
    assert.ok(plain.length > 0 && plain.length <= 524288); new TextDecoder("utf-8", { fatal: true }).decode(plain);
    return plain;
  } finally { raw.fill(0); }
}
export function encryptPublicFixture(plain, raw, iv) {
  // Explicit TEST ONLY inputs, not linked into the application bundle.
  const w = { format: "codabridge-sealed", version: 1, algorithm: "AES-256-GCM", tagLength: 128, iv: iv.toString("base64url") };
  const cipher = createCipheriv("aes-256-gcm", raw, iv, { authTagLength: 16 }); cipher.setAAD(aad(w));
  const joined = Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
  return Buffer.from(JSON.stringify({ ...w, ciphertext: joined.toString("base64url") }));
}
export function verifyManifest(path) {
  const manifest = JSON.parse(readFileSync(path, "utf8")); assert.equal(manifest.label, "PUBLIC TEST ONLY - never use these opening keys for private content");
  const dir = dirname(resolve(path)), results = []; let previous = null;
  for (const entry of manifest.entries) {
    const bytes = readFileSync(resolve(dir, entry.file)), expected = readFileSync(resolve(dir, entry.expected));
    const plain = decryptArtifact(bytes, entry.openingCode); assert.ok(plain.equals(expected), "Exact pre-encryption bytes differ");
    const content = JSON.parse(plain);
    if (previous && entry.prefix) assert.deepEqual(content.turns.slice(0, previous.turns.length), previous.turns);
    const python = spawnSync("python3", ["scripts/verify-exchange.py", resolve(dir, entry.expected)], { encoding: "utf8" });
    assert.equal(python.status, 0, "Independent Exchange verifier failed");
    results.push({ file: entry.file, sealedBytes: bytes.length, sealedSha256: sha(bytes), plaintextBytes: plain.length, plaintextSha256: sha(plain), turns: content.turns.length, innerProtection: content.protection, authenticated: true, exactOriginalBytes: true, independentExchange: JSON.parse(python.stdout) });
    previous = content; plain.fill(0);
  }
  return { label: "PUBLIC TEST ONLY verification; not cryptographic certification", node: process.version, checker: "Node createDecipheriv + independent Python Exchange verifier", results };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(verifyManifest(process.argv[2]), null, 2)); }
  catch { console.error("Sealed artifact verification failed. No candidate content or key is logged."); process.exitCode = 1; }
}
