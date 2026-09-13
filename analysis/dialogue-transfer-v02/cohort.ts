import assert from "node:assert/strict";
import { afterCutoff, beforeCutoff, buildCohort, end, endError, featureDefinitions, onsetError, prefixFeatures, splitManifest } from "../dialogue-transfer/cohort.ts";
import type { Coda } from "../../src/lab/model.ts";
export { featureDefinitions };
const config = { maxGapSeconds: 60, parentPrefixLength: 6 };
export const binding = (c: Coda) => ({ sourceLine: c.sourceLine, rec: c.rec, caller: c.caller, onset: c.onset, end: end(c), duration: c.duration, clickCount: c.clicks.length });
type Original = ReturnType<typeof buildCohort>["examples"][number];
export function buildResearchCohorts(csv: string) {
  // The v0.1 owner still decides all validation, continuity and immediate-next eligibility.
  const original = buildCohort(csv, config), calls = new Map(original.validated.calls.map(c => [c.sourceLine, c]));
  const coreSplit = splitManifest(original.examples);
  const recovered: Original[] = [];
  for (const e of original.audit.exclusions) {
    if (e.reason !== "FEWER_THAN_FOUR_COMPLETED_PARTNER_CODAS") continue;
    const current = calls.get(e.currentRow)!, target = calls.get(e.nextFocalRow!)!;
    const continuityId = original.audit.continuity[current.sourceLine];
    assert.ok(continuityId && original.audit.continuity[target.sourceLine] === continuityId && afterCutoff(target, current));
    const prefix = original.validated.calls.filter(c => original.audit.continuity[c.sourceLine] === continuityId && beforeCutoff(c, current));
    const built = prefixFeatures(current, prefix);
    if (built.completedPartnerRows.length < 2) continue;
    recovered.push({ id: `current-${current.sourceLine}-target-${target.sourceLine}`, currentRow: current.sourceLine, targetRow: target.sourceLine, targetDuration: target.duration, rec: current.rec, parentGroup: current.rec.slice(0, 6), continuityId, ...built });
  }
  const expanded = [...original.examples, ...recovered].sort((a, b) => a.currentRow - b.currentRow);
  const decorate = (e: Original, coverage: boolean) => {
    const current = calls.get(e.currentRow)!, target = calls.get(e.targetRow)!;
    const recent = e.recentRows.map(row => calls.get(row)!);
    const gap = target.onset - e.cutoff;
    assert.ok(afterCutoff(target, current) && Number.isFinite(gap) && gap > 0 && target.duration > 0 && target.clicks.length >= 2);
    const { features, ...record } = e;
    return { ...record, features: coverage ? { M1: features.M1, M2: features.M2 } : features,
      targets: { duration: Math.log(target.duration), count: target.clicks.length, gap: Math.log(gap) },
      targetGapSeconds: gap,
      prefix: { previousPresent: e.selfRows.length === 2, recentOverlap: recent.some(c => Math.min(end(c) - endError(c), end(current) - endError(current)) > Math.max(c.onset + onsetError(c), current.onset + onsetError(current)) + 1e-12), latestPartnerEndAge: e.recentAges[0] },
      sourceBindings: { current: binding(current), target: binding(target), self: e.selfRows.map(row => binding(calls.get(row)!)), recent: recent.map(binding), ...(coverage ? {} : { lagged: e.laggedRows.map(row => binding(calls.get(row)!)) }) },
    };
  };
  const groups = Object.keys(coreSplit.assignments);
  const extraGroups = [...new Set(expanded.map(e => e.parentGroup))].filter(g => !groups.includes(g)).sort();
  const assignments = { ...coreSplit.assignments, ...Object.fromEntries(extraGroups.map((g, i) => [g, (groups.length + i) % 5])) };
  const coverageSplit = { ...splitManifest(expanded), assignments,
    examples: expanded.map(e => ({ id: e.id, currentRow: e.currentRow, targetRow: e.targetRow, rec: e.rec, parentGroup: e.parentGroup, fold: assignments[e.parentGroup] })),
    inheritedGroups: groups, appendedGroups: extraGroups };
  const describe = (rows: Original[]) => ({ examples: rows.length, recGroups: new Set(rows.map(e => e.rec)).size, parentGroups: new Set(rows.map(e => e.parentGroup)).size,
    targetAvailability: { duration: rows.length, count: rows.length, gap: rows.length, invalid: 0 },
    targetRanges: { durationSeconds: [Math.min(...rows.map(e => e.targetDuration)), Math.max(...rows.map(e => e.targetDuration))], count: [Math.min(...rows.map(e => calls.get(e.targetRow)!.clicks.length)), Math.max(...rows.map(e => calls.get(e.targetRow)!.clicks.length))], gapSeconds: [Math.min(...rows.map(e => calls.get(e.targetRow)!.onset - e.cutoff)), Math.max(...rows.map(e => calls.get(e.targetRow)!.onset - e.cutoff))] },
    longTargets: rows.filter(e => calls.get(e.targetRow)!.clicks.length > 12).length });
  return { original, core: original.examples.map(e => decorate(e, false)), coverage: expanded.map(e => decorate(e, true)), coreSplit, coverageSplit,
    audit: { version: "dialogue-transfer-v02-audit", source: { rows: original.audit.sourceRows, valid: original.audit.validRows, excluded: original.audit.excludedRows }, core: describe(original.examples), coverage: describe(expanded), addedIds: recovered.map(e => e.id), originalFourHistoryCost: original.audit.lagRequirementCost,
      beforeHistoryRequirement: original.audit.beforeLagRequirement, fewerThanTwoCost: original.audit.beforeLagRequirement - expanded.length, continuityOwner: "analysis/dialogue-transfer/cohort.ts", exclusions: original.audit.exclusions.filter(e => e.reason !== "FEWER_THAN_FOUR_COMPLETED_PARTNER_CODAS" || !recovered.some(r => r.currentRow === e.currentRow)), coreParity: "Exact v0.1 IDs, features, split and source validation asserted by prepare script; no grouping change supported by metadata." } };
}
