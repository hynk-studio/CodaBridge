import { parseAnnotations } from "../../src/lab/parse.ts";
import type { Coda } from "../../src/lab/model.ts";

export const halfUnit = (s: string) => {
  const [base, exp = "0"] = s.toLowerCase().split("e");
  return 0.5 * 10 ** (Number(exp) - (base.split(".")[1]?.length ?? 0));
};
export const onsetError = (c: Coda) => halfUnit(c.raw.TsTo);
export const endError = (c: Coda) => onsetError(c) + c.clicks.slice(1).reduce((s, _, i) => s + halfUnit(c.raw[`ICI${i + 1}`]), 0);
export const end = (c: Coda) => c.onset + c.duration;
export const beforeCutoff = (c: Coda, current: Coda) => end(c) + endError(c) + 1e-12 < end(current) - endError(current);
export const afterCutoff = (target: Coda, current: Coda) => target.onset - onsetError(target) > end(current) + endError(current) + 1e-12;
const order = (a: Coda, b: Coda) => a.onset - b.onset || a.sourceLine - b.sourceLine;
const fields = ["duration", "clickCount", "normalizedIciMean", "normalizedIciSd", "normalizedIciLastMinusFirst", "onsetAge", "endAge", "missing"];
export const featureDefinitions = {
  version: "features-v1",
  slots: fields,
  definitions: ["Duration is sum of all validated ICIs (seconds); no long-coda truncation.", "Normalized ICIs divide each true interval by duration; arithmetic mean, population SD and last minus first.", "Onset/end age = cutoff minus original annotated onset / ICI-derived end (seconds).", "Absent previous focal: seven nulls plus missing=1; otherwise missing=0. Each pair also has latest onset minus older end; absent older means null.", "M1 slots: current focal, previous completed focal, focal pair gap. M2 adds latest partner, preceding partner, partner pair gap. M2-lagged adds third latest partner, fourth latest partner, their pair gap. IDs/caller labels are audit keys only."],
  M1: [...["current", "previous"].flatMap(s => fields.map(f => `${s}.${f}`)), "selfGap"],
  augmented: [...["partnerLatest", "partnerPrevious"].flatMap(s => fields.map(f => `${s}.${f}`)), "partnerGap"],
};
function slot(c: Coda | undefined, cutoff: number): (number | null)[] {
  if (!c) return [null, null, null, null, null, null, null, 1];
  const ici = c.clicks.slice(1).map((v, i) => (v - c.clicks[i]) / c.duration);
  const mean = ici.reduce((s, v) => s + v, 0) / ici.length;
  return [c.duration, c.clicks.length, mean, Math.sqrt(ici.reduce((s, v) => s + (v - mean) ** 2, 0) / ici.length), ici.at(-1)! - ici[0], cutoff - c.onset, cutoff - end(c), 0];
}
function block(latest: Coda, previous: Coda | undefined, cutoff: number) {
  return [...slot(latest, cutoff), ...slot(previous, cutoff), previous ? latest.onset - end(previous) : null];
}
// This owner accepts available history only. It neither accepts nor reads a target.
// Defensive filtering also rejects future / unfinished codas in a supplied prefix.
export function prefixFeatures(current: Coda, prefix: Coda[]) {
  const completed = prefix.filter(c => c.id !== current.id && c.rec === current.rec && c.onset < current.onset && beforeCutoff(c, current)).sort(order);
  // Partners can start during current, provided the whole coda completed before cutoff.
  const partners = prefix.filter(c => c.rec === current.rec && c.caller !== current.caller && beforeCutoff(c, current)).sort(order);
  const localPartners = new Set(partners.map(c => c.caller));
  if (localPartners.size > 1) throw new Error("Prefix has more than two local callers.");
  const previous = completed.filter(c => c.caller === current.caller).at(-1);
  const recent = partners.slice(-2).reverse(), lagged = partners.slice(-4, -2).reverse();
  const self = block(current, previous, end(current));
  return {
    cutoff: end(current), cutoffError: endError(current),
    selfRows: [current.sourceLine, ...(previous ? [previous.sourceLine] : [])],
    recentRows: recent.map(c => c.sourceLine), laggedRows: lagged.map(c => c.sourceLine),
    completedPartnerRows: partners.map(c => c.sourceLine),
    features: { M1: self, M2: recent.length === 2 ? [...self, ...block(recent[0], recent[1], end(current))] : null, "M2-lagged": lagged.length === 2 ? [...self, ...block(lagged[0], lagged[1], end(current))] : null },
    recentAges: recent.map(c => end(current) - end(c)), laggedAges: lagged.map(c => end(current) - end(c)),
  };
}
export function buildCohort(csv: string, config: { maxGapSeconds: number; parentPrefixLength: number }) {
  const parsed = parseAnnotations(csv);
  const lines = csv.replace(/\r\n/g, "\n").trimEnd().split("\n"), headers = lines[0].split(",");
  const calls = new Map(parsed.calls.map(c => [c.sourceLine, c]));
  const rows = parsed.summaries.map(s => ({ ...s, raw: Object.fromEntries(headers.map((h, i) => [h, lines[s.sourceLine - 1].split(",")[i]])), reasons: parsed.excluded.find(e => e.sourceLine === s.sourceLine)?.reasons ?? [] }));
  type Row = typeof rows[number];
  const barriers: { rec: string; sourceLines: number[]; reason: string }[] = [];
  const ambiguous = new Set<number>();
  const duplicates: { file: string; sourceLines: number[] }[] = [];
  const fingerprints = new Map<string, number[]>();
  // Ignore local caller ID across REC: identical time and complete click pattern
  // in one actual file is a possible repeated annotation even with relabeling.
  for (const c of parsed.calls) {
    const key = JSON.stringify([c.rec.slice(0, 9), c.onset, c.clicks]);
    fingerprints.set(key, [...(fingerprints.get(key) ?? []), c.sourceLine]);
  }
  for (const sourceLines of fingerprints.values()) if (sourceLines.length > 1) {
    duplicates.push({ file: calls.get(sourceLines[0])!.rec.slice(0, 9), sourceLines });
    sourceLines.forEach(l => ambiguous.add(l));
  }
  const spans = new Map<number, string>();
  const exclusions: { currentRow: number; nextFocalRow: number | null; reason: string }[] = [];
  const examples: ({ id: string; currentRow: number; targetRow: number; targetDuration: number; rec: string; parentGroup: string; continuityId: string } & ReturnType<typeof prefixFeatures>)[] = [];
  const recAudit: { rec: string; callers: string[]; rows: number; status: string; spans: number; eligible: number }[] = [];
  const gaps: { rec: string; from: number; to: number; seconds: number; barrier: boolean }[] = [];
  let beforeLagRequirement = 0;
  for (const rec of Object.keys(parsed.audit.groups).sort()) {
    const group = rows.filter(r => r.rec === rec).sort((a, b) => a.onset - b.onset || a.sourceLine - b.sourceLine);
    const callers = [...new Set(group.map(r => r.raw.Whale))].sort();
    const unknown = group.some(r => !Number.isFinite(r.onset) || r.reasons.includes("UNKNOWN_CALLER") || r.reasons.includes("INVALID_REC"));
    const status = unknown ? "UNKNOWN_ONSET_CALLER_OR_REC" : callers.length !== 2 ? "NOT_TWO_LOCAL_CALLERS" : "audited";
    if (status !== "audited") {
      group.filter(r => r.valid).forEach(r => exclusions.push({ currentRow: r.sourceLine, nextFocalRow: null, reason: status }));
      recAudit.push({ rec, callers, rows: group.length, status, spans: 0, eligible: 0 });
      continue;
    }
    // Ambiguous onsets or overlapping codas by the same local caller are barriers.
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      const a = calls.get(group[i].sourceLine), b = calls.get(group[j].sourceLine);
      if (a && b && a.caller === b.caller && b.onset - onsetError(b) <= end(a) + endError(a) + 1e-12) {
        ambiguous.add(a.sourceLine); ambiguous.add(b.sourceLine);
      }
    }
    const bad = (r: Row) => !r.valid || ambiguous.has(r.sourceLine);
    let spanStart: number | null = null, previous: Row | undefined;
    for (const r of group) {
      let gapBreak = false;
      if (previous) {
        const gap = r.onset - previous.onset;
        gapBreak = gap + halfUnit(r.raw.TsTo) + halfUnit(previous.raw.TsTo) > config.maxGapSeconds;
        gaps.push({ rec, from: previous.sourceLine, to: r.sourceLine, seconds: gap, barrier: gapBreak });
      }
      if (bad(r)) {
        barriers.push({ rec, sourceLines: [r.sourceLine], reason: r.valid ? "AMBIGUOUS_OR_REPEATED_EVENT" : r.reasons.join("|") });
        spanStart = null;
      } else {
        if (gapBreak || spanStart === null) spanStart = r.sourceLine;
        spans.set(r.sourceLine, `${rec}:row-${spanStart}`);
      }
      previous = r;
    }
    // A coda extending across a later barrier cannot join either side. This is
    // retrospective eligibility; prefixFeatures itself never consults this target layer.
    for (const r of group) {
      const c = calls.get(r.sourceLine);
      if (c && group.some(b => bad(b) && b.onset + halfUnit(b.raw.TsTo) >= c.onset - onsetError(c) && b.onset - halfUnit(b.raw.TsTo) <= end(c) + endError(c))) spans.delete(r.sourceLine);
    }
    const initialCount = examples.length;
    for (let i = 0; i < group.length; i++) {
      const r = group[i], current = calls.get(r.sourceLine);
      if (!current) continue;
      const continuityId = spans.get(r.sourceLine);
      const next = group.slice(i + 1).find(n => n.raw.Whale === r.raw.Whale);
      const reject = (reason: string) => exclusions.push({ currentRow: r.sourceLine, nextFocalRow: next?.sourceLine ?? null, reason });
      if (!continuityId) { reject("CURRENT_AT_BARRIER"); continue; }
      // Construct from prefix before examining next target contents or eligibility.
      const prefix = parsed.calls.filter(c => spans.get(c.sourceLine) === continuityId && beforeCutoff(c, current));
      const built = prefixFeatures(current, prefix);
      if (!next) { reject("NO_NEXT_FOCAL"); continue; }
      const target = calls.get(next.sourceLine);
      if (!target) { reject("NEXT_FOCAL_REJECTED"); continue; }
      if (spans.get(next.sourceLine) !== continuityId) { reject("NEXT_FOCAL_ACROSS_BARRIER"); continue; }
      if (!afterCutoff(target, current)) { reject("TARGET_OVERLAP_OR_PRECISION"); continue; }
      beforeLagRequirement++;
      if (built.completedPartnerRows.length < 4) { reject("FEWER_THAN_FOUR_COMPLETED_PARTNER_CODAS"); continue; }
      examples.push({ id: `current-${r.sourceLine}-target-${next.sourceLine}`, currentRow: r.sourceLine, targetRow: next.sourceLine, targetDuration: target.duration, rec, parentGroup: rec.slice(0, config.parentPrefixLength), continuityId, ...built });
    }
    recAudit.push({ rec, callers, rows: group.length, status, spans: new Set(group.flatMap(r => spans.has(r.sourceLine) ? [spans.get(r.sourceLine)] : [])).size, eligible: examples.length - initialCount });
  }
  examples.sort((a, b) => a.currentRow - b.currentRow);
  const crossFragmentOverlaps: { file: string; rows: number[]; samePattern: boolean }[] = [];
  for (let i = 0; i < parsed.calls.length; i++) for (let j = i + 1; j < parsed.calls.length; j++) {
    const a = parsed.calls[i], b = parsed.calls[j];
    if (a.rec !== b.rec && a.rec.slice(0, 9) === b.rec.slice(0, 9) && Math.max(a.onset, b.onset) <= Math.min(end(a), end(b))) crossFragmentOverlaps.push({ file: a.rec.slice(0, 9), rows: [a.sourceLine, b.sourceLine], samePattern: JSON.stringify(a.clicks) === JSON.stringify(b.clicks) });
  }
  return {
    validated: { ...parsed, rawRows: rows.map(r => ({ sourceLine: r.sourceLine, raw: r.raw })), precision: "Raw decimal strings retained; ICI sums from parseAnnotations, no Python revalidation." },
    examples,
    audit: { ...parsed.audit, exactRecGroups: Object.keys(parsed.audit.groups).length, sixCharacterRoots: new Set(rows.map(r => r.rec.slice(0, 6))).size, longValidCodas: parsed.calls.filter(c => c.clicks.length > 12).length, beforeLagRequirement, lagRequirementCost: beforeLagRequirement - examples.length, eligibleExamples: examples.length, eligibleRecGroups: new Set(examples.map(e => e.rec)).size, eligibleParentGroups: new Set(examples.map(e => e.parentGroup)).size, recAudit, barriers, gaps, duplicateEvents: duplicates, crossFragmentOverlaps, exclusions, exclusionCounts: Object.fromEntries([...new Set(exclusions.map(e => e.reason))].sort().map(k => [k, exclusions.filter(e => e.reason === k).length])), continuity: Object.fromEntries(spans) },
  };
}
export function splitManifest(examples: ReturnType<typeof buildCohort>["examples"]) {
  const groups = [...new Set(examples.map(e => e.parentGroup))].sort();
  const folds = groups.length >= 3 ? Math.min(5, groups.length) : 0;
  const assignments = Object.fromEntries(groups.map((g, i) => [g, folds ? i % folds : null]));
  return { version: "split-v1", folds, status: folds ? groups.length < 5 ? "exploratory" : "eligible" : "insufficient-data", assignments, examples: examples.map(e => ({ id: e.id, currentRow: e.currentRow, targetRow: e.targetRow, rec: e.rec, parentGroup: e.parentGroup, fold: assignments[e.parentGroup] })), selectedExamples: groups.slice(0, 5).map(g => examples.find(e => e.parentGroup === g)!.id) };
}
