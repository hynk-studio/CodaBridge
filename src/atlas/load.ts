import manifest from "./manifest.json" with { type: "json" };
import { ATLAS_METHOD, ATLAS_LIMITATIONS, SOURCE_RELEASE, SOURCE_SHA256 } from "./method.ts";
import { atlasRecord, catalogSummary, featuresFromIntervals, type AtlasRecord, type AtlasReport, type AtlasSummary, type FileIdentity } from "./model.ts";

export { manifest as ATLAS_MANIFEST };
function requireValue(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(`Atlas validation: ${reason}`);
}
function same(a: unknown, b: unknown, name: string) {
  requireValue(JSON.stringify(a) === JSON.stringify(b), `${name} mismatch`);
}
export function validateRecord(row: AtlasRecord) {
  requireValue(row && Number.isInteger(row.sourceLine) && row.sourceLine >= 2 && row.sourceLine <= 3841 && row.id === `row-${row.sourceLine}`, "source row identity");
  requireValue(typeof row.rec === "string" && /^[a-zA-Z0-9_]+$/.test(row.rec) && typeof row.caller === "string" && /^[1-9]\d*$/.test(row.caller), "local source labels");
  requireValue(row.raw && Object.keys(row.raw).length === 33 && Object.values(row.raw).every(v => typeof v === "string" && v.length <= 80), "raw source fields");
  requireValue(Array.isArray(row.clicks) && row.clicks.length >= 2 && row.clicks.length <= 29 && row.clicks[0] === 0, "click dimensions");
  requireValue(row.raw.REC === row.rec && row.raw.Whale === row.caller && Number(row.raw.nClicks) === row.clicks.length && Number(row.raw.TsTo) === row.onset && Number(row.raw.Duration) === row.declaredDuration, "raw row binding");
  requireValue(Number.isFinite(row.onset) && row.onset >= 0 && Number.isFinite(row.declaredDuration) && row.declaredDuration > 0 && Number.isFinite(row.durationTolerance) && row.durationTolerance > 0, "source measurements");
  const expected = atlasRecord(row), d = expected.features.intervalsSeconds, clicks = [0];
  for (const interval of d) clicks.push(clicks.at(-1)! + interval);
  same(row.clicks, clicks, "whole absolute clicks");
  same(row.duration, expected.features.durationSeconds, "duration");
  same(row.prefix, expected.prefix, "prefix"); same(row.root, expected.root, "root");
  same(row.features, expected.features, "features");
  const p = row.features.gapShares;
  requireValue(Math.abs(p.reduce((a, b) => a + b, 0) - 1) <= ATLAS_METHOD.arithmeticTolerance, "unit sum");
  featuresFromIntervals(d);
  return row;
}
export function validateSummary(value: unknown): AtlasSummary {
  const s = value as AtlasSummary;
  requireValue(s && s.schema === "codabridge-style-atlas-summary-v1" && s.atlasVersion === "1.0.0", "summary schema/version");
  requireValue(s.sourceSha256 === SOURCE_SHA256 && s.methodSha256 === manifest.methodSha256, "summary source/method hash");
  same(s.report, manifest.report, "report identity");
  requireValue(s.accounting?.sourceRows === 3840 && s.accounting.validRows === 3790 && s.accounting.excludedRows === 50, "full source accounting");
  requireValue(Array.isArray(s.groups) && s.groups.length === 28 && s.groups.every((g, i) => g.clickCount === i + 2 && g.gapShares.length === i + 1 && Number.isInteger(g.records) && g.records >= 0 && g.roots === g.rootContributions.length && g.sparse === (g.records < 20 || g.roots < 3)), "count group dimensions/support");
  requireValue(s.groups.reduce((sum, g) => sum + g.records, 0) === 3790, "summary coverage");
  return s;
}
export function validateAtlas(value: unknown, summary: AtlasSummary): AtlasReport {
  const a = value as AtlasReport;
  requireValue(a && a.schema === "codabridge-style-atlas-v1" && a.atlasVersion === "1.0.0", "report schema/version");
  requireValue(a.sourceSha256 === SOURCE_SHA256 && a.methodSha256 === manifest.methodSha256, "report source/method hash");
  same(a.method, ATLAS_METHOD, "method"); same(a.limitations, ATLAS_LIMITATIONS, "limitations");
  requireValue(a.sourceRecord?.releaseCommit === SOURCE_RELEASE && a.sourceRecord.id === "zenodo-10817697", "archived source identity");
  requireValue(Array.isArray(a.records) && a.records.length === 3790 && Array.isArray(a.exclusions) && a.exclusions.length === 50, "report coverage");
  const lines = new Set<number>();
  a.records.forEach((r, i) => {
    validateRecord(r);
    requireValue(!lines.has(r.sourceLine) && (i === 0 || a.records[i - 1].sourceLine < r.sourceLine), "duplicate/unordered row"); lines.add(r.sourceLine);
  });
  for (const e of a.exclusions) {
    requireValue(Number.isInteger(e.sourceLine) && e.sourceLine >= 2 && e.sourceLine <= 3841 && !lines.has(e.sourceLine) && Array.isArray(e.reasons) && e.reasons.length > 0, "exclusion binding"); lines.add(e.sourceLine);
  }
  requireValue(lines.size === 3840, "missing source rows");
  const expected = catalogSummary(a.records, a.exclusions.length);
  for (const k of ["accounting", "support", "groups"] as const) { same(a[k], expected[k], k); same(a[k], summary[k], `summary ${k}`); }
  return a;
}
export async function sha256(bytes: Uint8Array) {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, "0")).join("");
}
export async function checkedAsset(identity: FileIdentity, ceiling: number, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  requireValue(identity.bytes > 0 && identity.bytes <= ceiling && /^\/style-atlas-v1\/(atlas|summary)\.json$/.test(identity.path), "asset bounds/path");
  const response = await fetcher(identity.path, { signal, redirect: "error" });
  if (!response.ok) throw new Error(`Atlas download unavailable (HTTP ${response.status}).`);
  const declared = response.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > ceiling)) throw new Error("Atlas asset exceeds byte limit.");
  if (!response.body) throw new Error("Atlas response body unavailable.");
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      if (signal.aborted) throw new DOMException("Aborted", "AbortError");
      const { done, value } = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > ceiling || total > identity.bytes) throw new Error("Atlas asset exceeds expected byte limit.");
      chunks.push(value);
    }
  } catch (e) { await reader.cancel().catch(() => {}); throw e; } finally { reader.releaseLock(); }
  if (total !== identity.bytes) throw new Error("Atlas asset is incomplete or has the wrong size.");
  const bytes = new Uint8Array(total); let offset = 0;
  for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
  if (await sha256(bytes) !== identity.sha256) throw new Error("Atlas asset hash mismatch.");
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  return bytes;
}
export interface LoadedAtlas { atlas: AtlasReport; summary: AtlasSummary; bytes: Uint8Array }
let cache: LoadedAtlas | null = null;
export async function loadAtlas(signal: AbortSignal): Promise<LoadedAtlas> {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  if (cache) return cache;
  const summary = validateSummary(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await checkedAsset(manifest.summary, ATLAS_METHOD.byteLimits.summary, signal))));
  const bytes = await checkedAsset(summary.report, ATLAS_METHOD.byteLimits.report, signal);
  const atlas = validateAtlas(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), summary);
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  cache = { atlas, summary, bytes };
  return cache;
}
