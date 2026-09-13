import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
export const ROOT = "analysis/metadata-linkage-v1/";
export const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));
export const sha256 = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
export function identity(b: Buffer) { return { bytes: b.length, sha256: sha256(b), gitBlob: createHash("sha1").update(`blob ${b.length}\0`).update(b).digest("hex") }; }
export interface Source { id: string; repo: string; commit: string; path: string; url: string; cachePath: string; bytes: number; sha256: string; gitBlob: string }
export function sources(): Source[] { return readJson(ROOT + "retrieval-manifest.json"); }
export function checkedBytes(path: string, expected: { bytes: number; sha256: string; gitBlob: string }) {
  const b = readFileSync(path);
  assert.deepEqual(identity(b), { bytes: expected.bytes, sha256: expected.sha256, gitBlob: expected.gitBlob }, path);
  return b;
}
export function checkPreservation() {
  const m = readJson(ROOT + "preservation-manifest.json");
  for (const f of m.files) checkedBytes(f.path, f);
  return { base: m.base, unchangedFiles: m.files.length };
}
export function loadSources() {
  return Object.fromEntries(sources().map(s => [s.id, checkedBytes(s.cachePath, s).toString("utf8")]));
}
