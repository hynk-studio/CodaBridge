import type { Coda } from "./model.ts";
export const PREDICTION_MODELS = ["M0", "M1", "M2", "M2-lagged"] as const;
export type PredictionModel = typeof PREDICTION_MODELS[number];
export const BIN_NAMES = ["Short", "Medium", "Long"] as const;
export const CONTRAST_KEYS = ["M2_vs_M1", "M2-lagged_vs_M1", "M2_vs_M2-lagged"] as const;
type Gain = Record<typeof CONTRAST_KEYS[number], number>;
export interface PredictionRecord {
  id: string; currentRow: number; targetRow: number; parentGroup: string; rec: string;
  continuityId: string; cutoff: number; cutoffError: number; fold: number;
  category: number; targetDuration: number; edges: number[];
  selfRows: number[]; recentRows: number[]; laggedRows: number[];
  recentAges: number[]; laggedAges: number[];
  predictions: Record<PredictionModel, { raw: number[]; scoring: number[]; logLossBits: number; clippedClasses: number }>;
  gainBits: Gain;
}
export interface PredictionExample { record: PredictionRecord; history: Coda[]; target: Coda }
interface GroupMetric { parentGroup: string; n: number; gainBits: Gain; logLossBits: Record<PredictionModel, number> }
export interface PredictionSummary {
  schemaVersion: "dialogue-transfer-summary-v1";
  identity: string; question: string; status: "completed" | "failed" | "insufficient-data";
  failures: { reason: string; fold?: number | null }[];
  cohort: { sourceRows: number; validRows: number; eligibleExamples: number; eligibleRecGroups: number; eligibleParentGroups: number; beforeLagRequirement: number; lagRequirementCost: number };
  metrics: { n: number; logLossBits: Record<PredictionModel, number>; gainBits: Gain; groupMacroGainBits: Gain; perGroup: GroupMetric[] } | null;
  uncertainty: { seed: number; resamples: number; coverage: string; intervals: Record<typeof CONTRAST_KEYS[number], { pooled: number[]; groupMacro: number[] }> } | null;
  selectedExamples: PredictionExample[];
  folds: { fold: number; edges: number[]; testCount: number; trainingCount: number; testGroups: string[] }[];
  limitations: string[];
  source: { recordUrl: string; license: string; releaseCommit: string; csvSha256: string; attribution: string };
  provenance: { freezeCommit: string; producerCommit: string; producerTree: string; hashes: Record<string, string>; versions: Record<string, string> };
  report: { path: "/prediction/dialogue-transfer-report.json"; sha256: string; bytes: number };
}
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const integer = (v: unknown) => finite(v) && Number.isInteger(v) && v >= 0;
const object = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const numbers = (v: unknown, length: number) => Array.isArray(v) && v.length === length && v.every(finite);
const text = (v: unknown) => typeof v === "string" && v.length > 0 && v.length <= 1000;
const sha = (v: unknown) => typeof v === "string" && /^[0-9a-f]{64}$/.test(v);
const commit = (v: unknown) => typeof v === "string" && /^[0-9a-f]{40}$/.test(v);
const gains = (v: unknown) => object(v) && CONTRAST_KEYS.every(k => finite(v[k]));
const losses = (v: unknown) => object(v) && PREDICTION_MODELS.every(k => finite(v[k]) && v[k] >= 0);
const edges = (v: unknown) => numbers(v, 2) && (v as number[])[0] > 0 && (v as number[])[1] > (v as number[])[0];
const rows = (v: unknown) => Array.isArray(v) && v.length <= 6 && v.every(integer);
function coda(c: any) {
  return object(c) && integer(c.sourceLine) && text(c.id) && text(c.rec) && text(c.caller) && finite(c.onset) && finite(c.duration) && c.duration > 0 && Array.isArray(c.clicks) && c.clicks.length >= 2 && c.clicks.length <= 29 && c.clicks[0] === 0 && c.clicks.every((x: unknown, i: number) => finite(x) && (i === 0 || x > c.clicks[i - 1])) && Math.abs(c.clicks.at(-1) - c.duration) < 1e-9;
}
export function validatePredictionSummary(value: unknown): PredictionSummary {
  const fail = () => { throw new Error("The saved prediction summary is unavailable or invalid. No estimate is substituted."); };
  if (!object(value) || new TextEncoder().encode(JSON.stringify(value)).length > 256 * 1024) return fail();
  const s = value;
  if (s.schemaVersion !== "dialogue-transfer-summary-v1" || s.identity !== "Precomputed held-out prediction" || !text(s.question) || !["completed", "failed", "insufficient-data"].includes(s.status) || !Array.isArray(s.failures) || !s.failures.every((f: any) => object(f) && text(f.reason)) || !object(s.cohort) || !["sourceRows", "validRows", "eligibleExamples", "eligibleRecGroups", "eligibleParentGroups", "beforeLagRequirement", "lagRequirementCost"].every(k => integer(s.cohort[k])) || !Array.isArray(s.selectedExamples) || s.selectedExamples.length > 5 || !Array.isArray(s.folds) || s.folds.length > 5 || !Array.isArray(s.limitations) || s.limitations.length > 20 || !s.limitations.every(text)) return fail();
  if (!object(s.source) || s.source.recordUrl !== "https://zenodo.org/records/10817697" || s.source.license !== "CC BY 4.0" || !text(s.source.attribution) || !sha(s.source.csvSha256) || !commit(s.source.releaseCommit) || !object(s.provenance) || !commit(s.provenance.producerCommit) || !commit(s.provenance.producerTree) || !commit(s.provenance.freezeCommit) || !object(s.report) || s.report.path !== "/prediction/dialogue-transfer-report.json" || !sha(s.report.sha256) || !integer(s.report.bytes) || s.report.bytes > 8 * 1024 * 1024) return fail();
  if (s.status !== "completed") {
    if (s.metrics !== null || s.uncertainty !== null || s.selectedExamples.length || !s.failures.length) return fail();
    return s as PredictionSummary;
  }
  if (s.failures.length || !s.selectedExamples.length || !object(s.metrics) || s.metrics.n !== s.cohort.eligibleExamples || !losses(s.metrics.logLossBits) || !gains(s.metrics.gainBits) || !gains(s.metrics.groupMacroGainBits) || !Array.isArray(s.metrics.perGroup) || s.metrics.perGroup.length !== s.cohort.eligibleParentGroups || !s.metrics.perGroup.every((g: any) => object(g) && text(g.parentGroup) && integer(g.n) && g.n > 0 && gains(g.gainBits) && losses(g.logLossBits))) return fail();
  // A missing interval does not erase a recorded point estimate. Malformed intervals still fail validation.
  if (s.uncertainty !== null && (!object(s.uncertainty) || s.uncertainty.resamples !== 2000 || !integer(s.uncertainty.seed) || !object(s.uncertainty.intervals) || !CONTRAST_KEYS.every(k => object(s.uncertainty.intervals[k]) && ["pooled", "groupMacro"].every(weight => { const range = s.uncertainty.intervals[k][weight]; return numbers(range, 2) && range[0] <= range[1]; })))) return fail();
  if (s.folds.length < 3 || !s.folds.every((f: any) => object(f) && integer(f.fold) && edges(f.edges) && integer(f.testCount) && integer(f.trainingCount) && Array.isArray(f.testGroups) && f.testGroups.every(text))) return fail();
  for (const example of s.selectedExamples) {
    if (!object(example) || !object(example.record) || !coda(example.target) || !Array.isArray(example.history) || example.history.length > 6 || !example.history.length || !example.history.every(coda)) return fail();
    const r = example.record;
    if (!text(r.id) || !text(r.rec) || !text(r.parentGroup) || !text(r.continuityId) || !integer(r.currentRow) || !integer(r.targetRow) || !integer(r.fold) || !integer(r.category) || r.category > 2 || !finite(r.cutoff) || !finite(r.cutoffError) || !finite(r.targetDuration) || !edges(r.edges) || ![r.selfRows, r.recentRows, r.laggedRows].every(rows) || r.selfRows.length < 1 || r.recentRows.length !== 2 || r.laggedRows.length !== 2 || !numbers(r.recentAges, 2) || !numbers(r.laggedAges, 2) || !gains(r.gainBits) || !object(r.predictions)) return fail();
    for (const model of PREDICTION_MODELS) {
      const p = r.predictions[model];
      if (!object(p) || ![p.raw, p.scoring].every(v => numbers(v, 3) && v.every((x: number) => x >= 0 && x <= 1) && Math.abs(v.reduce((a: number, b: number) => a + b, 0) - 1) < 1e-9) || !finite(p.logLossBits) || !integer(p.clippedClasses)) return fail();
    }
    const allowedRows = [...r.selfRows, ...r.recentRows, ...r.laggedRows];
    if (new Set(allowedRows).size !== allowedRows.length || allowedRows.includes(r.targetRow) || example.history.length !== allowedRows.length || !example.history.every((c: Coda) => allowedRows.includes(c.sourceLine) && c.rec === r.rec && c.onset + c.duration <= r.cutoff + 1e-9) || example.target.sourceLine !== r.targetRow || example.target.rec !== r.rec || example.target.onset <= r.cutoff || example.target.duration !== r.targetDuration) return fail();
    const current = example.history.find((c: Coda) => c.sourceLine === r.currentRow);
    if (!current || Math.abs(current.onset + current.duration - r.cutoff) > 1e-9 || example.target.caller !== current.caller) return fail();
    if (r.category !== (r.targetDuration <= r.edges[0] ? 0 : r.targetDuration <= r.edges[1] ? 1 : 2)) return fail();
    const fold = s.folds.find((f: any) => f.fold === r.fold);
    if (!fold || JSON.stringify(fold.edges) !== JSON.stringify(r.edges) || !fold.testGroups.includes(r.parentGroup)) return fail();
  }
  return s as PredictionSummary;
}
// This is a presentation boundary, not secrecy: public static data include targets.
export function predictionView(example: PredictionExample, revealed: boolean) {
  return { history: example.history, currentRow: example.record.currentRow, cutoff: example.record.cutoff, edges: example.record.edges, selfOnly: example.record.predictions.M1.scoring, selfPartner: example.record.predictions.M2.scoring, ...(revealed ? { target: example.target, category: example.record.category, gain: example.record.gainBits.M2_vs_M1 } : {}) };
}
export function predictionFinding(status: PredictionSummary["status"], gain: number | null, interval: readonly number[] | null) {
  if (status === "failed") return "Experiment failed — no primary estimate";
  if (status !== "completed" || gain === null || !Number.isFinite(gain)) return "Insufficient data — no primary estimate";
  const point = gain > 0 ? "Positive pooled estimate" : gain < 0 ? "Negative pooled estimate" : "Zero pooled estimate";
  if (!interval || interval.length !== 2 || !interval.every(Number.isFinite) || interval[0] > interval[1]) return `${point} — uncertainty unavailable`;
  // Describe the estimate and conditional interval separately, without an effect/significance claim.
  if (interval[0] <= 0 && interval[1] >= 0) return `${point} — interval spans zero`;
  return `${point} — interval ${interval[0] > 0 ? "above" : "below"} zero`;
}
