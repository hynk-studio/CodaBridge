import assert from "node:assert/strict";
import { parseAnnotations } from "../../src/lab/parse.ts";
import { parseCsv } from "./csv.ts";
import { compare, agrees, measure } from "./precision.ts";
import { joinCeti, linkCeti } from "./ceti.ts";
import { linkMaor, uniqueCompatible } from "./maor.ts";
import { dateCandidates } from "./dates.ts";

export const tally = (values: (string | number)[]) => Object.fromEntries([...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), "en")).map(k => [k, values.filter(v => v === k).length]));
const unique = (rows: number[]) => [...new Set(rows)].sort((a, b) => a - b);
const statuses = (values: string[]) => Object.fromEntries(["fully-identified-candidate", "partly-identified-candidate", "unidentified"].map(k => [k, values.filter(v => v === k).length]));
export interface CohortExample { id: string; currentRow: number; targetRow: number; rec: string; parentGroup: string; selfRows: number[]; recentRows: number[]; laggedRows: number[]; completedPartnerRows: number[] }

export function audit(originalCsv: string, external: Record<string, string>, cohorts: Record<string, CohortExample[]>, assignments: Record<string, number>) {
  const original = parseAnnotations(originalCsv), raw = parseCsv(originalCsv);
  assert.equal(raw.length, original.audit.sourceRows);
  const excluded = new Map(original.excluded.map(r => [r.sourceLine, r.reasons]));
  const maor = parseCsv(external["maor/dataset/dswp-2014-2016-retagged-maor-2025.csv"]);
  const md = parseCsv(external["ceti/codamd.csv"]), sp = parseCsv(external["ceti/codasp.csv"]), co = parseCsv(external["ceti/focal-coarticulation-metadata.csv"]);
  const ml = linkMaor(raw, maor), joined = joinCeti(md, sp, co), cl = linkCeti(raw, joined);
  const maorReverse = new Map<number, number[]>(), cetiReverse = new Map<string, number[]>();
  ml.forEach(r => r.candidates.filter(c => c.compatible).forEach(c => maorReverse.set(c.maorLine, [...(maorReverse.get(c.maorLine) ?? []), r.sourceLine])));
  cl.links.forEach(r => r.candidates.filter(c => c.compatible).forEach(c => cetiReverse.set(c.codanum, [...(cetiReverse.get(c.codanum) ?? []), r.sourceLine])));
  const cetiById = new Map(joined.events.map(e => [e.id, e]));
  const bridges = maor.filter(r => cetiById.has(r.raw.codaNUM2018)).map(r => {
    const e = cetiById.get(r.raw.codaNUM2018)!;
    return { maorLine: r.line, codanum: e.id, metadataLines: e.meta.map(r => r.line), duration: e.meta.map(m => compare(measure(r.raw.Duration), measure(m.raw.Duration))),
      countEqual: e.spectralCount === null ? null : Number(r.raw.nClicks) === e.spectralCount,
      nameEqual: e.whale === null ? null : r.raw.Name === e.whale,
      focalEqual: e.meta.length === 1 ? (r.raw.Focal === "1.0" || r.raw.Focal === "1") === (e.meta[0].raw.focal === "True") : null,
      onset: compare(measure(r.raw.TsTo), e.timing?.relative ?? null),
        maorDateAsWritten: r.raw.Date, maorDateCandidates: dateCandidates(r.raw.Date), cetiTagOnAsWritten: e.timing?.tagOn ?? null,
        dateStatus: !e.timing ? "missing-CETI-date" : dateCandidates(r.raw.Date).length === 0 ? "unparsed-Maor-date" : !dateCandidates(r.raw.Date).includes(e.timing.tagOn.slice(0, 10)) ? "conflict-under-both-numeric-date-orders" : dateCandidates(r.raw.Date).length > 1 ? "one-ambiguous-date-order-agrees" : "unambiguous-written-date-agrees" };
  });
  const rows = raw.map((r, i) => {
    assert.equal(ml[i].sourceLine, r.line); assert.equal(cl.links[i].sourceLine, r.line);
    const m = uniqueCompatible(ml[i].candidates), c = uniqueCompatible(cl.links[i].candidates);
    const um = m && maorReverse.get(m.maorLine)!.length === 1 ? m : null;
    const uc = c && cetiReverse.get(c.codanum)!.length === 1 ? c : null;
    const strongCeti = uc && uc.sequenceLines.length > 0 ? uc : null;
    const names = [...new Set([um?.metadata.producerCandidate, strongCeti?.whale].filter((n): n is string => !!n))];
    const bridge = um ? bridges.find(b => b.maorLine === um.maorLine) : null;
    return { sourceLine: r.line, rec: r.raw.REC, originalCaller: r.raw.Whale, validated: !excluded.has(r.line), exclusions: excluded.get(r.line) ?? [],
      maor: ml[i].candidates, ceti: cl.links[i].candidates,
      maorUniqueCompatibleLine: um?.maorLine ?? null, cetiUniqueCompatibleId: uc?.codanum ?? null,
      cetiSequenceIdentity: strongCeti?.whale ?? null, maorFocalIdentityCandidate: um?.metadata.producerCandidate ?? null,
      producerCandidate: names.length === 1 ? names[0] : null, identityConflict: names.length > 1,
      unitCandidate: names.length === 1 ? um?.metadata.unitCandidate ?? null : null,
      inferredNamespaceBridge: bridge ? { codanum: bridge.codanum, directTimedCandidate: !!uc, compatible: bridge.duration.every(agrees) && bridge.countEqual !== false && bridge.nameEqual !== false && bridge.focalEqual !== false && bridge.onset.status !== "conflict" } : null };
  });
  const byLine = new Map(rows.map(r => [r.sourceLine, r]));
  const coverageFor = (lines: number[]) => {
    const items = lines.map(l => { const r = byLine.get(l); assert.ok(r, `Unknown source binding ${l}`); return r; });
    return { rows: items.length, maorEventCandidates: items.filter(r => r.maor.length).length, maorUniqueCompatible: items.filter(r => r.maorUniqueCompatibleLine !== null).length,
      cetiTimedCompatible: items.filter(r => r.cetiUniqueCompatibleId !== null).length, cetiSequenceIdentified: items.filter(r => r.cetiSequenceIdentity !== null).length,
      maorFocalNamedCandidates: items.filter(r => r.maorFocalIdentityCandidate !== null).length, namedProducerCandidates: items.filter(r => r.producerCandidate !== null).length,
      unitCandidates: items.filter(r => r.unitCandidate !== null).length, identityConflicts: items.filter(r => r.identityConflict).length };
  };
  const cohortCoverage = Object.fromEntries(Object.entries(cohorts).map(([key, examples]) => {
    const records = examples.map(e => {
      const previous = e.selfRows.filter(l => l !== e.currentRow), lagged = key === "core" ? e.laggedRows : [];
      const roles = { current: [e.currentRow], target: [e.targetRow], previousFocal: previous, recentPartner: e.recentRows, laggedPartner: lagged,
        featureHistory: unique([...previous, ...e.recentRows, ...lagged]), allCompletedPartnerHistory: unique(e.completedPartnerRows) };
      const used = unique([e.currentRow, e.targetRow, ...roles.featureHistory]);
      const allAvailable = unique([...used, ...e.completedPartnerRows]);
      const counts = coverageFor(used), n = counts.namedProducerCandidates, strict = counts.cetiSequenceIdentified;
      const availableCounts = coverageFor(allAvailable);
      return { id: e.id, root: e.parentGroup, fold: assignments[e.parentGroup], roles, usedRows: used,
        namedCandidateRows: used.filter(l => byLine.get(l)!.producerCandidate !== null), strictCetiRows: used.filter(l => byLine.get(l)!.cetiSequenceIdentity !== null),
        status: n === used.length ? "fully-identified-candidate" : n ? "partly-identified-candidate" : "unidentified",
        strictCetiStatus: strict === used.length ? "fully-identified-candidate" : strict ? "partly-identified-candidate" : "unidentified",
        allAvailableStatus: availableCounts.namedProducerCandidates === allAvailable.length ? "fully-identified-candidate" : availableCounts.namedProducerCandidates ? "partly-identified-candidate" : "unidentified" };
    });
    const roles = Object.fromEntries(Object.keys(records[0].roles).map(role => {
      const occurrences = records.flatMap(r => r.roles[role as keyof typeof r.roles]);
      return [role, { occurrences: coverageFor(occurrences), distinctRows: coverageFor(unique(occurrences)) }];
    }));
    return [key, { examples: records.length, roles, usedDistinctRows: coverageFor(unique(records.flatMap(r => r.usedRows))),
      exampleStatus: statuses(records.map(r => r.status)), strictCetiStatus: statuses(records.map(r => r.strictCetiStatus)), allAvailableStatus: statuses(records.map(r => r.allAvailableStatus)), records }];
  }));
  const rootReports = [...new Set(rows.map(r => r.rec.slice(0, 6)))].sort().map(root => {
    const rr = rows.filter(r => r.rec.slice(0, 6) === root), mm = maor.filter(r => r.raw.Tag === root);
    const cc = rr.flatMap(r => r.ceti.filter(c => c.compatible));
    return { root, fold: assignments[root] ?? null, coverage: coverageFor(rr.map(r => r.sourceLine)),
      namedProducerCandidates: [...new Set(rr.map(r => r.producerCandidate).filter(x => x !== null))].sort(),
      maorTagNames: [...new Set(mm.map(r => r.raw.Name))].sort(), maorUnitsAsWritten: [...new Set(mm.map(r => r.raw.Unit))].sort(),
      maorDatesAsWritten: [...new Set(mm.map(r => r.raw.Date))].sort(), maorTagOnTimesAsWritten: [...new Set(mm.map(r => r.raw.TagOnTime))].sort(),
      maorDateCandidates: [...new Set(mm.flatMap(r => dateCandidates(r.raw.Date)))].sort(),
      cetiTagOnAsWritten: [...new Set(cc.map(c => c.tagOn))].sort(),
      dateContextChecks: [...new Set(mm.map(r => r.raw.Date))].sort().map(value => ({ maorDateAsWritten: value, candidateDates: dateCandidates(value),
        cetiDatesAsWritten: [...new Set(cc.map(c => c.tagOn.slice(0, 10)))].sort(),
        anyDateOrderAgrees: cc.length ? cc.some(c => dateCandidates(value).includes(c.tagOn.slice(0, 10))) : null })),
      localCallerNames: [...new Set(rr.map(r => r.originalCaller))].sort().map(caller => ({ caller, candidates: tally(rr.filter(r => r.originalCaller === caller && r.producerCandidate).map(r => r.producerCandidate!)) })) };
  });
  const dependence = [...new Set(rows.map(r => r.producerCandidate).filter((x): x is string => x !== null))].sort().map(name => {
    const roots = rootReports.filter(r => r.namedProducerCandidates.includes(name)).map(r => r.root);
    return { name, roots, folds: [...new Set(roots.map(r => assignments[r]).filter(f => f !== undefined))].sort(), kind: "Repeated candidate individual across recordings; not same-event or same-encounter proof" };
  }).filter(r => r.roots.length > 1);
  const repeatedTagNames = [...new Set(rootReports.flatMap(r => r.maorTagNames))].sort().filter(name => name && name !== "UNID").map(name => {
    const roots = rootReports.filter(r => r.maorTagNames.includes(name));
    return { tagNameAsWritten: name, roots: roots.map(r => r.root), folds: [...new Set(roots.map(r => r.fold).filter(f => f !== null))].sort(),
      kind: "Repeated Maor tag Name context, including roots without linked focal events; not producer propagation or a verified encounter group" };
  }).filter(r => r.roots.length > 1);
  const dateGroups = [...new Set(rootReports.flatMap(r => r.maorDateCandidates))].sort().map(date => {
    const roots = rootReports.filter(r => r.maorDateCandidates.includes(date));
    return { dateCandidate: date, roots: roots.map(r => r.root), folds: [...new Set(roots.map(r => r.fold).filter(f => f !== null))].sort(), unitsAsWritten: [...new Set(roots.flatMap(r => r.maorUnitsAsWritten))].sort(),
      kind: "Possible same-day recordings; ambiguous dates retained, shared encounter and timezone unresolved" };
  }).filter(r => r.roots.length > 1);
  const maorSequences = [...new Set(rows.map(r => `${r.rec}/${r.originalCaller}`))].sort().map(local => {
    const rr = rows.filter(r => `${r.rec}/${r.originalCaller}` === local && r.maorUniqueCompatibleLine !== null);
    const mm = rr.map(r => maor.find(m => m.line === r.maorUniqueCompatibleLine)!);
    return { local, sourceRows: rr.map(r => r.sourceLine), maorLines: mm.map(m => m.line), maorRECs: [...new Set(mm.map(m => m.raw.REC))].sort(), maorCallers: [...new Set(mm.map(m => m.raw.Whale))].sort(),
      strictlyOrdered: mm.every((m, i) => i === 0 || Number(m.raw.TsTo) > Number(mm[i - 1].raw.TsTo)) };
  });
  const seed = rows.flatMap(r => r.ceti.filter(c => [[4985, 4999], [5012, 5015], [5063, 5068]].some(([a, b]) => Number(c.codanum) >= a && Number(c.codanum) <= b)).map(c => {
    const e = cetiById.get(c.codanum)!;
    return { sourceLine: r.sourceLine, rec: r.rec, caller: r.originalCaller, codanum: c.codanum, compatible: c.compatible, sequenceSupported: c.sequenceLines.length > 0, whale: c.whale, tagOn: c.tagOn,
      onset: c.relativeSeconds, duration: c.durationSeconds, lastClickPosition: c.lastClickPosition, countEqual: c.countEqual,
      lastClickEvidence: e.observations.filter(t => t.lastClickPosition !== null).map(t => ({ coartLine: t.line, role: t.role, position: t.lastClickPosition })) };
  }));
  const unmatchedMaor = maor.filter(r => !maorReverse.has(r.line)).map(r => ({ line: r.line, codaNUM2018: r.raw.codaNUM2018, onsetCandidateSourceRows: ml.filter(l => l.candidates.some(c => c.maorLine === r.line)).map(l => l.sourceLine) }));
  const eventSummaries = joined.events.map(e => ({ codanum: e.id, metadataLines: e.meta.map(r => r.line), spectralLines: e.spectral.map(r => r.line),
    coartLines: unique(e.observations.map(o => o.line)), timingVariants: new Set(e.observations.map(t => JSON.stringify([t.whale, t.tagOn, t.onset, t.end]))).size,
    lastClickPosition: e.lastCount, spectralClickLabels: e.spectralCount, conflicts: e.conflicts, durationChecks: e.durationChecks,
    compatibleOriginalRows: cetiReverse.get(e.id) ?? [] }));
  const maorCandidates = rows.flatMap(r => r.maor), cetiCandidates = rows.flatMap(r => r.ceti);
  return {
    mapping: { version: "metadata-linkage-candidates-v1", interpretation: "Inferred event links and candidate producer metadata, never an official crosswalk", rows, namespaceBridges: bridges, cetiEvents: eventSummaries, sequenceChecks: cl.sequenceChecks, maorSequences, unmatchedMaor, seedReproduction: seed },
    coverage: { version: "metadata-linkage-coverage-v1", raw: coverageFor(rows.map(r => r.sourceLine)), validated: coverageFor(rows.filter(r => r.validated).map(r => r.sourceLine)), cohorts: cohortCoverage, roots: rootReports, crossRootCandidateIndividuals: dependence, crossRootTagMetadata: repeatedTagNames, crossRootDateCandidates: dateGroups },
    summary: { status: "completed-read-only-audit", original: original.audit,
      external: { maorRows: maor.length, codamdRows: md.length, codaspRows: sp.length, coarticulationRows: co.length, cetiUnionIds: joined.events.length, cetiTimedIds: joined.events.filter(e => e.observations.length).length,
        maorColumnIndividualPresent: "Individual" in maor[0].raw, maorNames: tally(maor.map(r => r.raw.Name)), maorUnits: tally(maor.map(r => r.raw.Unit)), maorIdns: tally(maor.map(r => r.raw.IDN)), maorFocal: tally(maor.map(r => r.raw.Focal)), cetiWhales: tally(md.map(r => r.raw.whale)), cetiFocal: tally(md.map(r => r.raw.focal)),
        maorRootsAbsentFromOriginal: tally(maor.filter(m => !raw.some(r => r.raw.REC.slice(0, 6) === m.raw.REC.slice(0, 6))).map(r => r.raw.REC.slice(0, 6))),
        maorTagRecPrefixMismatches: maor.filter(r => r.raw.Tag !== r.raw.REC.slice(0, 6)).map(r => r.line), maorFocalWhaleMismatches: maor.filter(r => r.raw.Focal !== "" && ((r.raw.Focal === "1.0") !== (r.raw.Whale === "1"))).map(r => r.line),
        maorDuplicateCodaIds: Object.entries(tally(maor.map(r => r.raw.codaNUM2018))).filter(([, n]) => n > 1), cetiConflictedIds: eventSummaries.filter(e => e.conflicts.length).map(e => e.codanum),
        cetiMissingLastClickPositionIds: eventSummaries.filter(e => e.lastClickPosition === null).map(e => e.codanum), cetiMissingTimingIds: eventSummaries.filter(e => e.timingVariants === 0).map(e => e.codanum) },
      maor: { candidates: maorCandidates.length, keyScopes: tally(maorCandidates.map(c => c.key.rec)), compatibleKeyScopes: tally(maorCandidates.filter(c => c.compatible).map(c => c.key.rec)), onsetAgreement: tally(maorCandidates.map(c => c.key.onset.status)), callerDisagreements: maorCandidates.filter(c => !c.key.whaleEqual).length, compatibleCallerDisagreements: maorCandidates.filter(c => c.compatible && !c.key.whaleEqual).length,
        compatible: maorCandidates.filter(c => c.compatible).length, countConflicts: maorCandidates.filter(c => !c.countEqual).length, iciConflictPairs: maorCandidates.filter(c => c.iciConflicts.length).length, declaredDurationConflicts: maorCandidates.filter(c => c.reportedDuration.status === "conflict").length,
        multiCandidateOriginals: rows.filter(r => r.maor.length > 1).map(r => r.sourceLine), inverseCollisions: [...maorReverse.entries()].filter(([, v]) => v.length > 1), unmatchedOriginalRows: rows.filter(r => !r.maor.length).map(r => r.sourceLine), unmatchedCompatibleOriginalRows: rows.filter(r => r.maorUniqueCompatibleLine === null).map(r => r.sourceLine), externalWithoutCompatibleLink: unmatchedMaor.length },
      ceti: { onsetCandidates: cetiCandidates.length, compatible: cetiCandidates.filter(c => c.compatible).length, sequenceSupportedCandidates: cetiCandidates.filter(c => c.compatible && c.sequenceLines.length).length,
        candidateConflicts: cetiCandidates.filter(c => !c.compatible).map(c => ({ codanum: c.codanum, onset: c.onset.status, duration: c.wholeDuration.status, count: c.countEqual, spectralCount: c.spectralCountEqual })),
        multiCandidateOriginals: rows.filter(r => r.ceti.length > 1).map(r => r.sourceLine), inverseCollisions: [...cetiReverse.entries()].filter(([, v]) => v.length > 1),
        supportedSequencePairs: cl.sequenceChecks.filter(p => p.combinations.some(c => c.supported)).length, sequenceGapConflicts: cl.sequenceChecks.filter(p => !agrees(p.gap)).map(p => p.line), namespaceBridges: bridges.length,
        namespaceCountConflicts: bridges.filter(b => b.countEqual === false).map(b => b.codanum), namespaceDateStatus: tally(bridges.map(b => b.dateStatus)), seedReproduction: seed },
      rawCoverage: coverageFor(rows.map(r => r.sourceLine)), validatedCoverage: coverageFor(rows.filter(r => r.validated).map(r => r.sourceLine)),
      cohorts: Object.fromEntries(Object.entries(cohortCoverage).map(([k, v]) => [k, { examples: v.examples, exampleStatus: v.exampleStatus, strictCetiStatus: v.strictCetiStatus, usedDistinctRows: v.usedDistinctRows, roles: v.roles }])),
      sameEventsVersusNewSamples: { maorCompatibleOriginalEvents: maorReverse.size, maorWithoutCompatibleOriginal: unmatchedMaor.length, maorOnsetCandidateButAnnotationConflict: unmatchedMaor.filter(r => r.onsetCandidateSourceRows.length).length, maorNoOriginalOnsetCandidate: unmatchedMaor.filter(r => !r.onsetCandidateSourceRows.length).length,
        cetiCompatibleOriginalEvents: cetiReverse.size, cetiWithoutCompatibleOriginal: eventSummaries.filter(e => !e.compatibleOriginalRows.length).length, additionalIndependentSamplesEstablished: 0,
        interpretation: "Matched records describe reused events. Unmatched records may be new, omitted, retimed or revised annotations; they are not established independent samples." },
      calendarAmbiguities: rootReports.filter(r => new Set(r.cetiTagOnAsWritten.map(s => s.slice(0, 10))).size > 1).map(r => ({ root: r.root, maorDatesAsWritten: r.maorDatesAsWritten, cetiTagOnAsWritten: r.cetiTagOnAsWritten, interpretation: "Multiple written calendar origins within one source root; preserve each, do not normalize to a chosen date" })),
      crossRootCandidateIndividuals: dependence, crossRootTagMetadata: repeatedTagNames, crossRootDateCandidates: dateGroups },
  };
}
