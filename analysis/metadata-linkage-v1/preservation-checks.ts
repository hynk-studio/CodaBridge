// Additive review correction. The original producer and its provenance stay frozen.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { identity, ROOT } from "./io.ts";

export const AUDIT_BASE = "b3fb7daaa6d851baf35b8224648c25d743ea466f";
export const AUDIT_SNAPSHOT = "821b0cd43d710c0f5f710cbece25257c5ae794fb";
interface RecordedFile { path: string; sha256: string; bytes?: number; gitBlob?: string }
type SnapshotReader = (revision: string, path: string) => Buffer;

// Identities from AUDIT_SNAPSHOT, not regenerated from a later working tree.
const preservation = { path: ROOT + "preservation-manifest.json", bytes: 111098, sha256: "1df9a6b63a7a342c813f74a4a835874c7e2a77f9d3c363f13b735c7a2a84e9de", gitBlob: "e74678d57d23bb3d55cde911d0eaaf003868d83c" };
const evidence = { path: "docs/metadata-linkage-v1/manifest.json", bytes: 3132, sha256: "630a0aa909f2d69b08faf1775a89a3e0a93f0a2d9aa7b9a1e70cd5cc76a61b39", gitBlob: "0bdb830d4a45eace0d75d2128e2e9cecbc29b7e1" };

function checked(file: RecordedFile, bytes: Buffer, context = file.path) {
  const actual = identity(bytes);
  assert.equal(actual.sha256, file.sha256, `${context}: SHA-256 mismatch`);
  if (file.bytes !== undefined) assert.equal(actual.bytes, file.bytes, `${context}: byte count mismatch`);
  if (file.gitBlob !== undefined) assert.equal(actual.gitBlob, file.gitBlob, `${context}: Git blob mismatch`);
  return bytes;
}

function historicalManifest(bytes: Buffer): { base: string; files: RecordedFile[] } {
  const manifest = JSON.parse(checked(preservation, bytes).toString("utf8"));
  assert.equal(manifest.base, AUDIT_BASE);
  assert.equal(manifest.files.length, 462);
  return manifest;
}

// Only existing entries in the pinned manifest are selected; new files are not frozen.
// Application/server code, CSS, current docs, tests and tooling are intentionally absent.
function frozenDataOrEvidence(path: string) {
  return path.startsWith("data/") || path.startsWith("src/data/")
    || /^public\/(audio|prediction|prediction-v02)\//.test(path)
    || /^analysis\/dialogue-transfer(?:-v02)?\/(?:.*\.json|requirements\.txt)$/.test(path)
    || /^docs\/dialogue-transfer-v0\.(?:1(?:-review)?|2)\//.test(path);
}

export function frozenFiles(root = "."): RecordedFile[] {
  const read = (path: string) => readFileSync(join(root, path));
  const manifest = historicalManifest(read(preservation.path));
  const savedEvidence = JSON.parse(checked(evidence, read(evidence.path)).toString("utf8")) as { files: RecordedFile[] };
  const reportFile = savedEvidence.files.find(f => f.path === ROOT + "results/report.json")!;
  const report = JSON.parse(checked(reportFile, read(reportFile.path)).toString("utf8")) as { provenance: { producerFiles: RecordedFile[] } };
  const files = [preservation, evidence, ...manifest.files.filter(f => frozenDataOrEvidence(f.path)),
    ...savedEvidence.files, ...report.provenance.producerFiles.filter(f => f.path.endsWith(".json"))];
  return [...new Map(files.map(f => [f.path, f])).values()];
}

// Ordinary tests use this current-tree guard. No Git history or external cache is needed.
export function checkFrozenArtifacts(root = ".") {
  const files = frozenFiles(root);
  for (const f of files) checked(f, readFileSync(join(root, f.path)));
  return { auditSnapshot: AUDIT_SNAPSHOT, frozenFiles: files.length };
}

// Reader injection is for disposable TEST ONLY fixtures; production reads Git objects.
export function checkHistoricalFiles(files: RecordedFile[], readSnapshot: SnapshotReader) {
  for (const revision of [AUDIT_BASE, AUDIT_SNAPSHOT]) {
    for (const f of files) checked(f, readSnapshot(revision, f.path), `${revision}:${f.path}`);
  }
}

export function checkHistoricalPreservation(readSnapshot: SnapshotReader = (revision, path) =>
  execFileSync("git", ["show", `${revision}:${path}`], { maxBuffer: 128 * 1024 * 1024 })) {
  const manifest = historicalManifest(readSnapshot(AUDIT_SNAPSHOT, preservation.path));
  checkHistoricalFiles(manifest.files, readSnapshot);
  return { base: AUDIT_BASE, auditSnapshot: AUDIT_SNAPSHOT, unchangedFiles: manifest.files.length, checkedSnapshots: 2 };
}
