import type { Coda } from "./model.ts";
import { PREDICTION_MODELS, CONTRAST_KEYS, predictionFinding, type PredictionModel } from "./prediction.ts";

export const RESEARCH_IDS = ["duration", "count", "gap", "coverage-duration"] as const;
export type ResearchId = typeof RESEARCH_IDS[number];
type State = "completed" | "failed" | "insufficient-data";
type Values = Record<string, number>;
export interface Aggregate { n: number; loss: Values; mae: Values; gain: Values }
export interface Metrics {
  status: "empty" | "limited-group-coverage" | "descriptive";
  groups: number; pooled: Aggregate | null; macro: Omit<Aggregate, "n"> | null;
  perGroup?: (Aggregate & { parentGroup: string; pooledContribution: Values; macroContribution: Values })[];
  outOfRangeMeans?: Record<string, { outsideTrainingCountRange: number; outsideSourceCountRange: number }>;
}
export interface ResearchRecord {
  id: string; currentRow: number; targetRow: number; rec: string; parentGroup: string; cutoff: number; cutoffError: number; fold: number;
  selfRows: number[]; recentRows: number[]; laggedRows: number[];
  target: number; targets: { duration: number; count: number; gap: number };
  predictions: Record<string, { value: number; nativePoint: number; loss: number; absoluteError: number }>;
  gain: Values;
}
export interface ResearchStudy {
  id: ResearchId; role: string; cohort: "core" | "coverage"; estimator: "ridge" | "poisson"; target: "duration" | "count" | "gap";
  status: State; failures: { reason: string; fold?: number; model?: string }[];
  models: PredictionModel[]; metrics: Metrics | null;
  uncertainty: { intervals: Record<string, { pooled: number[]; macro: number[] }>; resamples: number; interpretation: string } | null;
  selectedRecords: ResearchRecord[]; warningsCount: number;
  folds: { fold: number; trainingCount: number; testCount: number; latestAgeMedian: number; testGroups: string[]; trainingGroups: string[] }[];
  deletions: { removedRoot: string; n: number; pooledGain: Values; macroGain: Values }[];
  strata: Record<string, Record<string, Metrics>>;
}
export interface ResearchExample { id: string; currentRow: number; cutoff: number; rec: string; parentGroup: string; history: Coda[]; target: Coda; gapSeconds: number }
interface Cohort { examples: number; recGroups: number; parentGroups: number }
export interface ResearchSummary {
  schemaVersion: "dialogue-transfer-summary-v02"; identity: string; status: "completed" | "partial";
  studies: ResearchStudy[]; examples: ResearchExample[]; limitations: string[];
  cohorts: { core: Cohort; coverage: Cohort; beforeHistoryRequirement: number; fewerThanTwoCost: number };
  source: { recordUrl: string; csvSha256: string; releaseCommit: string; license: string; attribution: string };
  provenance: { freezeCommit: string; producerCommit: string; producerTree: string };
  report: { path: "/prediction-v02/dialogue-transfer-report.json"; bytes: number; sha256: string };
}
export const RESEARCH_LABELS = {
  duration: { title: "Next coda duration", unit: "squared log units", point: "s · back-transformed log point", diagnostic: "absolute log error" },
  count: { title: "Next coda click count", unit: "Poisson deviance per coda", point: "clicks · conditional mean", diagnostic: "absolute count error" },
  gap: { title: "Time until next eligible recorded focal coda", unit: "squared log units", point: "s · back-transformed log point", diagnostic: "absolute log error" },
  "coverage-duration": { title: "Duration with two completed partners", unit: "squared log units", point: "s · back-transformed log point", diagnostic: "absolute log error" },
};
export function researchFinding(study: ResearchStudy) {
  if (study.status === "failed") return "Study failed — no estimate";
  if (!study.metrics?.pooled) return "Insufficient data — no estimate";
  return predictionFinding("completed", study.metrics.pooled.gain.M2_vs_M1, study.uncertainty?.intervals.M2_vs_M1.pooled ?? null);
}
const object = (v: unknown): v is Record<string, any> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const integer = (v: unknown): v is number => finite(v) && Number.isInteger(v) && v >= 0;
const text = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 1500;
const array = (v: unknown, max: number): v is any[] => Array.isArray(v) && v.length <= max;
const hex = (v: unknown, n: number) => typeof v === "string" && new RegExp(`^[0-9a-f]{${n}}$`).test(v);
const same = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b));
const values = (v: unknown, keys: readonly string[], nonnegative = false) => object(v) && keys.every(k => finite(v[k]) && (!nonnegative || v[k] >= -1e-12));
const interval = (v: unknown) => array(v, 2) && v.length === 2 && v.every(finite) && v[0] <= v[1];
function coda(c: any): c is Coda {
  return object(c) && integer(c.sourceLine) && text(c.id) && text(c.rec) && text(c.caller) && finite(c.onset) && finite(c.duration) && c.duration > 0 && array(c.clicks, 29) && c.clicks.length >= 2 && c.clicks[0] === 0 && c.clicks.every((v, i) => finite(v) && (i === 0 || v > c.clicks[i - 1])) && same(c.clicks.at(-1), c.duration);
}
function metrics(m: any, models: readonly string[], keys: readonly string[]) {
  if (!object(m) || !integer(m.groups)) return false;
  if (m.status === "empty") return m.groups === 0 && m.pooled === null && m.macro === null;
  const scores = (v: any) => object(v) && values(v.loss, models, true) && values(v.mae, models, true) && values(v.gain, keys);
  return ["descriptive", "limited-group-coverage"].includes(m.status) && m.groups > 0 && scores(m.pooled) && integer(m.pooled.n) && m.pooled.n > 0 && scores(m.macro);
}
export function validateResearchSummary(value: unknown): ResearchSummary {
  const fail = (): never => { throw new Error("The saved v0.2 summary is unavailable or invalid. No estimate is substituted."); };
  if (!object(value) || value.schemaVersion !== "dialogue-transfer-summary-v02" || !text(value.identity) || !["completed", "partial"].includes(value.status)) return fail();
  if (!object(value.report) || value.report.path !== "/prediction-v02/dialogue-transfer-report.json" || !integer(value.report.bytes) || value.report.bytes < 1 || value.report.bytes > 33554432 || !hex(value.report.sha256, 64)) return fail();
  if (!object(value.source) || value.source.csvSha256 !== "1856c8bf915cc5ae6f928aaa2036cbbc6ad8840bb6e4f6a96aaeb96953215da2" || value.source.releaseCommit !== "7228c8eed2cc27ddd23b74c51aeccec9d762389e" || !/^https:\/\/zenodo\.org\/records\/\d+$/.test(value.source.recordUrl) || !text(value.source.license) || !text(value.source.attribution)) return fail();
  if (!object(value.provenance) || !["freezeCommit", "producerCommit", "producerTree"].every(k => hex(value.provenance[k], 40))) return fail();
  if (!array(value.limitations, 30) || !value.limitations.every(text) || !object(value.cohorts)) return fail();
  for (const key of ["core", "coverage"]) if (!object(value.cohorts[key]) || !["examples", "recGroups", "parentGroups"].every(k => integer(value.cohorts[key][k]) && value.cohorts[key][k] > 0 && value.cohorts[key][k] <= 3840)) return fail();
  if (!integer(value.cohorts.beforeHistoryRequirement) || !integer(value.cohorts.fewerThanTwoCost)) return fail();
  if (!array(value.examples, 5) || !value.examples.length || new Set(value.examples.map(e => e.id)).size !== value.examples.length) return fail();
  for (const e of value.examples) {
    if (!object(e) || !text(e.id) || !integer(e.currentRow) || !text(e.rec) || !text(e.parentGroup) || !e.rec.startsWith(e.parentGroup) || !finite(e.cutoff) || !array(e.history, 6) || e.history.length < 5 || !coda(e.target) || !finite(e.gapSeconds) || e.gapSeconds <= 0) return fail();
    const current = e.history.find(c => c.sourceLine === e.currentRow);
    if (!current || !e.history.every(coda) || e.history.some(c => c.rec !== e.rec || c.sourceLine === e.target.sourceLine || c.onset + c.duration > e.cutoff + 1e-9) || new Set(e.history.map(c => c.sourceLine)).size !== e.history.length || !same(current.onset + current.duration, e.cutoff) || e.target.rec !== e.rec || e.target.caller !== current.caller || e.target.onset <= e.cutoff || !same(e.target.onset - e.cutoff, e.gapSeconds)) return fail();
  }
  if (!array(value.studies, 4) || value.studies.length !== 4) return fail();
  for (const [i, s] of value.studies.entries()) {
    const models = i === 3 ? PREDICTION_MODELS.slice(0, 3) : PREDICTION_MODELS, keys = i === 3 ? CONTRAST_KEYS.slice(0, 1) : CONTRAST_KEYS;
    if (!object(s) || s.id !== RESEARCH_IDS[i] || s.cohort !== (i === 3 ? "coverage" : "core") || s.estimator !== (i === 1 ? "poisson" : "ridge") || s.target !== (i === 3 ? "duration" : RESEARCH_IDS[i]) || s.role !== ["PRIMARY", "SECONDARY", "SECONDARY", "COVERAGE SENSITIVITY"][i] || JSON.stringify(s.models) !== JSON.stringify(models) || !["completed", "failed", "insufficient-data"].includes(s.status) || !array(s.failures, 100) || !s.failures.every(f => object(f) && text(f.reason)) || !integer(s.warningsCount) || !array(s.selectedRecords, 5) || !array(s.folds, 5) || !array(s.deletions, 30) || !object(s.strata)) return fail();
    if (s.status !== "completed") {
      if (!s.failures.length || s.metrics !== null || s.uncertainty !== null || s.selectedRecords.length || s.deletions.length || Object.keys(s.strata).length) return fail();
      continue;
    }
    if (s.failures.length || !metrics(s.metrics, models, keys) || s.metrics.pooled.n !== value.cohorts[s.cohort].examples || s.metrics.groups !== value.cohorts[s.cohort].parentGroups || !array(s.metrics.perGroup, 30) || s.metrics.perGroup.length !== s.metrics.groups || !s.metrics.perGroup.every((g: any) => text(g.parentGroup) && integer(g.n) && values(g.loss, models, true) && values(g.mae, models, true) && values(g.gain, keys) && values(g.pooledContribution, keys) && values(g.macroContribution, keys))) return fail();
    if (s.uncertainty !== null && (!object(s.uncertainty) || s.uncertainty.resamples !== 2000 || !text(s.uncertainty.interpretation) || !object(s.uncertainty.intervals) || !keys.every(k => object(s.uncertainty.intervals[k]) && interval(s.uncertainty.intervals[k].pooled) && interval(s.uncertainty.intervals[k].macro)))) return fail();
    if (s.folds.length !== 5 || new Set(s.folds.map((f: any) => f.fold)).size !== 5 || !s.folds.every((f: any) => integer(f.fold) && f.fold < 5 && integer(f.trainingCount) && integer(f.testCount) && finite(f.latestAgeMedian) && array(f.testGroups, 30) && f.testGroups.every(text) && array(f.trainingGroups, 30) && f.trainingGroups.every(text) && !f.testGroups.some((g: string) => f.trainingGroups.includes(g)))) return fail();
    if (s.deletions.length !== s.metrics.groups || new Set(s.deletions.map((d: any) => d.removedRoot)).size !== s.metrics.groups || !s.deletions.every((d: any) => text(d.removedRoot) && integer(d.n) && values(d.pooledGain, keys) && values(d.macroGain, keys)) || !s.metrics.perGroup.every((g: any) => s.deletions.some((d: any) => d.removedRoot === g.parentGroup))) return fail();
    if (!object(s.metrics.outOfRangeMeans) || !models.every(m => object(s.metrics.outOfRangeMeans[m]) && integer(s.metrics.outOfRangeMeans[m].outsideTrainingCountRange) && integer(s.metrics.outOfRangeMeans[m].outsideSourceCountRange))) return fail();
    for (const [partition, cells] of Object.entries({ previous: ["present", "absent"], overlap: ["definite", "no-definite-overlap"], age: ["at-or-below", "above"] })) {
      if (!object(s.strata[partition]) || !cells.every(cell => metrics(s.strata[partition][cell], models, keys))) return fail();
    }
    if (s.selectedRecords.length !== (i === 3 ? 0 : value.examples.length)) return fail();
    for (const [j, r] of s.selectedRecords.entries()) {
      const e = value.examples[j];
      if (!object(r) || r.id !== e.id || r.currentRow !== e.currentRow || r.targetRow !== e.target.sourceLine || r.rec !== e.rec || r.parentGroup !== e.parentGroup || !finite(r.cutoff) || !same(r.cutoff, e.cutoff) || !finite(r.cutoffError) || r.cutoffError < 0 || !integer(r.fold) || r.fold >= 5 || !object(r.targets) || !finite(r.target) || !object(r.predictions) || !values(r.gain, keys)) return fail();
      if (!same(r.targets.duration, Math.log(e.target.duration)) || r.targets.count !== e.target.clicks.length || !same(r.targets.gap, Math.log(e.gapSeconds)) || r.target !== r.targets[s.target]) return fail();
      for (const name of ["selfRows", "recentRows", "laggedRows"]) if (!array(r[name], 2) || !r[name].length || !r[name].every((row: any) => integer(row) && e.history.some((c: Coda) => c.sourceLine === row))) return fail();
      if (r.recentRows.length !== 2 || r.laggedRows.length !== 2 || new Set([...r.selfRows, ...r.recentRows, ...r.laggedRows]).size !== e.history.length) return fail();
      for (const model of models) {
        const p = r.predictions[model];
        if (!object(p) || !finite(p.value) || !finite(p.nativePoint) || p.nativePoint <= 0 || !finite(p.loss) || p.loss < -1e-12 || !finite(p.absoluteError) || p.absoluteError < 0 || !same(p.nativePoint, s.estimator === "poisson" ? p.value : Math.exp(p.value))) return fail();
      }
    }
  }
  if ((value.status === "completed") !== value.studies.every(s => s.status === "completed")) return fail();
  return value as ResearchSummary;
}

export function researchView(example: ResearchExample, studies: ResearchStudy[], revealed: boolean) {
  const predictions = studies.filter(s => s.cohort === "core").map(s => {
    const r = s.selectedRecords.find(r => r.id === example.id);
    return { id: s.id, role: s.role, status: s.status, fold: r?.fold, points: r ? Object.fromEntries(s.models.map(m => [m, { value: r.predictions[m].value, nativePoint: r.predictions[m].nativePoint }])) : null };
  });
  // Explicit projection: target, target-derived errors and source target IDs never enter the hidden view.
  return { currentRow: example.currentRow, cutoff: example.cutoff, rec: example.rec, parentGroup: example.parentGroup, history: example.history, predictions,
    ...(revealed ? { target: example.target, gapSeconds: example.gapSeconds, records: Object.fromEntries(studies.filter(s => s.cohort === "core").map(s => [s.id, s.selectedRecords.find(r => r.id === example.id)])) } : {}) };
}

export async function readResearchBytes(response: Response, limit: number) {
  if (!response.ok || !response.body) throw new Error("The saved research file could not be loaded.");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new Error("The saved research file exceeds its size limit."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
