import { compareTiming, measureTiming, METRIC, type TimingInput } from "../domain/timing.ts";
import type { Coda } from "../lab/model.ts";
import type { parseAnnotations } from "../lab/parse.ts";
import { ATLAS_LIMITATIONS, ATLAS_METHOD, SOURCE_SHA256 } from "./method.ts";

export interface Features {
  clickCount: number;
  intervalsSeconds: number[];
  durationSeconds: number;
  gapShares: number[];
  clickPositions: number[];
  meanIntervalSeconds: number;
  intervalCV: number;
  endpointRatio: number;
  endpointShareDifference: number;
  shapeInformative: boolean;
}
export type AtlasRecord = Coda & { prefix: string; root: string; features: Features };
export type Quantiles = { p10: number; p50: number; p90: number };
export interface GroupSummary {
  clickCount: number;
  records: number;
  recs: number;
  prefixes: number;
  roots: number;
  rootContributions: { root: string; records: number; share: number }[];
  largestRootShare: number | null;
  sparse: boolean;
  durationSeconds: Quantiles | null;
  intervalCV: Quantiles | null;
  endpointRatio: Quantiles | null;
  gapShares: (Quantiles | null)[];
}
export interface FileIdentity { path: string; bytes: number; sha256: string }
export interface AtlasSummary {
  schema: "codabridge-style-atlas-summary-v1";
  atlasVersion: "1.0.0";
  sourceSha256: string;
  methodSha256: string;
  accounting: { sourceRows: number; validRows: number; excludedRows: number; longRows: number; subComposerGapRows: number };
  support: { recs: number; prefixes: number; roots: number };
  groups: GroupSummary[];
  report: FileIdentity;
}
export interface AtlasReport {
  schema: "codabridge-style-atlas-v1";
  atlasVersion: "1.0.0";
  sourceSha256: string;
  sourceRecord: Record<string, unknown>;
  methodSha256: string;
  method: typeof ATLAS_METHOD;
  provenance: { base: string; producerFiles: FileIdentity[]; sourceRecordSha256: string };
  limitations: typeof ATLAS_LIMITATIONS;
  accounting: AtlasSummary["accounting"];
  support: AtlasSummary["support"];
  groups: GroupSummary[];
  records: AtlasRecord[];
  exclusions: ReturnType<typeof parseAnnotations>["excluded"];
}

export function timingFromClicks(clicks: readonly number[]): TimingInput {
  return { durationSeconds: clicks.at(-1)!, clickTimesSeconds: clicks, selectedIntervalSeconds: { start: clicks[0], end: clicks.at(-1)! } };
}
export function featuresFromIntervals(intervals: readonly number[]): Features {
  if (!Array.isArray(intervals) || intervals.length < 1 || intervals.length > 28 || intervals.some(d => !Number.isFinite(d) || d <= 0))
    throw new Error("Atlas timing needs 1–28 finite positive intervals.");
  const clicks = [0];
  for (const d of intervals) clicks.push(clicks.at(-1)! + d);
  const measured = measureTiming(timingFromClicks(clicks));
  if (measured.status !== "valid") throw new Error(measured.reason);
  const duration = measured.measurements.clickSpanSeconds, mean = duration / intervals.length;
  const gapShares = intervals.map(d => d / duration);
  const intervalCV = Math.sqrt(intervals.reduce((sum, d) => sum + ((d - mean) / mean) ** 2, 0) / intervals.length);
  const endpointRatio = intervals.at(-1)! / intervals[0];
  if (!Number.isFinite(intervalCV) || !Number.isFinite(endpointRatio)) throw new Error("Nonfinite Atlas feature.");
  return { clickCount: intervals.length + 1, intervalsSeconds: [...intervals], durationSeconds: duration, gapShares,
    clickPositions: measured.measurements.normalizedClickPositions, meanIntervalSeconds: mean, intervalCV, endpointRatio,
    endpointShareDifference: gapShares.at(-1)! - gapShares[0], shapeInformative: intervals.length > 1 };
}
export function featuresFromTiming(timing: TimingInput) {
  const measured = measureTiming(timing);
  if (measured.status !== "valid") throw new Error(measured.reason);
  return featuresFromIntervals(measured.measurements.intervalsSeconds);
}
export function atlasRecord(coda: Coda): AtlasRecord {
  // The parser owns acceptance and cumulative timing. Preserve decimal ICI text
  // instead of deriving original measurements by subtracting cumulative doubles.
  const d = Array.from({ length: coda.clicks.length - 1 }, (_, i) => Number(coda.raw[`ICI${i + 1}`]));
  return { ...coda, prefix: coda.rec.slice(0, 9), root: coda.rec.slice(0, 6), features: featuresFromIntervals(d) };
}
export function quantile(values: readonly number[], q: number): number | null {
  if (!Number.isFinite(q) || q < 0 || q > 1 || values.some(x => !Number.isFinite(x))) throw new Error("Invalid quantile input.");
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), h = (sorted.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
}
function quantiles(values: number[]): Quantiles | null {
  return values.length ? { p10: quantile(values, .1)!, p50: quantile(values, .5)!, p90: quantile(values, .9)! } : null;
}
export function summarizeGroup(records: AtlasRecord[], clickCount: number): GroupSummary {
  if (!Number.isInteger(clickCount) || clickCount < 2 || clickCount > 29 || records.some(r => r.features.clickCount !== clickCount)) throw new Error("Exact click count required.");
  const roots = [...new Set(records.map(r => r.root))].sort();
  const rootContributions = roots.map(root => { const n = records.filter(r => r.root === root).length; return { root, records: n, share: n / records.length }; });
  return { clickCount, records: records.length, recs: new Set(records.map(r => r.rec)).size, prefixes: new Set(records.map(r => r.prefix)).size,
    roots: roots.length, rootContributions, largestRootShare: roots.length ? Math.max(...rootContributions.map(r => r.share)) : null,
    sparse: records.length < ATLAS_METHOD.sparse.minimumRecords || roots.length < ATLAS_METHOD.sparse.minimumRoots,
    durationSeconds: quantiles(records.map(r => r.features.durationSeconds)), intervalCV: quantiles(records.map(r => r.features.intervalCV)),
    endpointRatio: quantiles(records.map(r => r.features.endpointRatio)),
    gapShares: Array.from({ length: clickCount - 1 }, (_, i) => quantiles(records.map(r => r.features.gapShares[i]))) };
}
export function catalogSummary(records: AtlasRecord[], excludedRows: number) {
  return {
    accounting: { sourceRows: records.length + excludedRows, validRows: records.length, excludedRows,
      longRows: records.filter(r => r.features.clickCount > 12).length, subComposerGapRows: records.filter(r => r.features.intervalsSeconds.some(d => d < .04)).length },
    support: { recs: new Set(records.map(r => r.rec)).size, prefixes: new Set(records.map(r => r.prefix)).size, roots: new Set(records.map(r => r.root)).size },
    groups: Array.from({ length: 28 }, (_, i) => summarizeGroup(records.filter(r => r.features.clickCount === i + 2), i + 2)),
  };
}
export function nearestReferences(timing: TimingInput, records: AtlasRecord[]) {
  const current = featuresFromTiming(timing);
  return records.filter(r => r.features.clickCount === current.clickCount).map(record => {
    const comparison = compareTiming(timing, timingFromClicks(record.clicks));
    if (comparison.status !== "comparable") throw new Error(comparison.reason);
    return { sourceLine: record.sourceLine, id: record.id, durationSeconds: record.duration, distance: comparison.value };
  }).sort((a, b) => a.distance - b.distance || a.sourceLine - b.sourceLine).slice(0, 3);
}
export interface CurrentTiming { blockId: string; revision: number; times: number[] }
// Deliberately excludes draft title, intention, codebook, seeds and other blocks.
export function timingBinding(current: CurrentTiming) {
  return JSON.stringify({ blockId: current.blockId, revision: current.revision, times: current.times });
}
export function compareWithAtlas(current: CurrentTiming, atlas: AtlasReport, report: FileIdentity) {
  const timing = timingFromClicks(current.times), features = featuresFromTiming(timing);
  const support = atlas.groups.find(g => g.clickCount === features.clickCount)!;
  if (!support) throw new Error("Unsupported click count.");
  const nearest = nearestReferences(timing, atlas.records);
  return {
    schema: "codabridge-composer-timing-reference-v1", identity: "Read-only descriptive timing comparison; not a project or Coda Packet",
    binding: timingBinding(current), currentTiming: { blockId: current.blockId, revision: current.revision, times: [...current.times], features },
    atlas: { version: atlas.atlasVersion, sourceSha256: SOURCE_SHA256, sourceRecord: atlas.sourceRecord, methodSha256: atlas.methodSha256, method: atlas.method, report },
    support, shapeStatus: !support.records ? "empty" : !features.shapeInformative ? "nondiscriminating-two-click" : support.sparse ? "sparse" : "descriptive",
    perPosition: features.gapShares.map((share, i) => ({ gap: i + 1, share, reference: support.gapShares[i],
      position: support.sparse || !features.shapeInformative ? "not-assessed" : share < support.gapShares[i]!.p10 ? "below-p10" : share > support.gapShares[i]!.p90 ? "above-p90" : "within-marginal-range" })),
    metric: METRIC, nearest: nearest.map(n => ({ ...n, reference: atlas.records.find(r => r.sourceLine === n.sourceLine)! })), limitations: ATLAS_LIMITATIONS,
  };
}
