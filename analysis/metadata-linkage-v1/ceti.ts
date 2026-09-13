import { indexBy, type CsvRow } from "./csv.ts";
import { agrees, civilTime, compare, difference, format, measure, sumIcis, type Measure } from "./precision.ts";
export interface Timing {
  line: number; role: "previous" | "current"; whale: string; tagOn: string; onset: string; end: string;
  lastClickPosition: number | null; relative: Measure | null; duration: Measure | null;
}
export function joinCeti(md: CsvRow[], sp: CsvRow[], coart: CsvRow[]) {
  const mdi = indexBy(md, "codanum"), spi = indexBy(sp, "codanum"), times = new Map<string, Timing[]>();
  const pairChecks = coart.map(r => {
    for (const p of ["prev", ""] as const) {
      const id = r.raw[p + "codanum"], tagOn = r.raw[p + "tagondt"], onset = r.raw[p + "codadt"], end = r.raw[p + "codaenddt"];
      const tag = civilTime(tagOn);
      // Tag-on is the supplied coordinate origin, not a measured timestamp to
      // which we add a made-up +/-0.5 second uncertainty.
      const t: Timing = { line: r.line, role: p ? "previous" : "current", whale: r.raw.whale, tagOn, onset, end,
        lastClickPosition: p && /^[1-9]\d*$/.test(r.raw.prevclicknum) ? Number(r.raw.prevclicknum) : null,
        relative: difference(civilTime(onset), tag && { value: tag.value, error: 0n }), duration: difference(civilTime(end), civilTime(onset)) };
      times.set(id, [...(times.get(id) ?? []), t]);
    }
    return { line: r.line, previous: r.raw.prevcodanum, current: r.raw.codanum, sameTagOn: r.raw.prevtagondt === r.raw.tagondt,
      firstClickIsOne: r.raw.clicknum === "1", gap: compare(measure(r.raw.deltasec), difference(civilTime(r.raw.codadt), civilTime(r.raw.prevcodaenddt))) };
  });
  const ids = [...new Set([...mdi.keys(), ...spi.keys(), ...times.keys()])].sort((a, b) => Number(a) - Number(b));
  const events = ids.map(id => {
    const meta = mdi.get(id) ?? [], spectral = spi.get(id) ?? [], observations = times.get(id) ?? [];
    const variants = [...new Set(observations.map(t => JSON.stringify([t.whale, t.tagOn, t.onset, t.end])))];
    const lastCounts = [...new Set(observations.map(t => t.lastClickPosition).filter(v => v !== null))];
    const spectralCounts = [...new Set(spectral.map(r => /^[ai]+$/.test(r.raw.autovpkcodastr) ? r.raw.autovpkcodastr.length : null).filter(v => v !== null))];
    const names = [...new Set([...meta.map(r => r.raw.whale), ...spectral.map(r => r.raw.whale), ...observations.map(t => t.whale)])];
    const conflicts: string[] = [];
    if (meta.length > 1) conflicts.push("duplicate-codamd-ID");
    if (spectral.length > 1) conflicts.push("duplicate-codasp-ID");
    if (variants.length > 1) conflicts.push("conflicting-timing-observations");
    if (names.length > 1) conflicts.push("whale-metadata-disagreement");
    if (lastCounts.length > 1 || spectralCounts.length > 1 || lastCounts.length && spectralCounts.length && lastCounts[0] !== spectralCounts[0]) conflicts.push("count-metadata-disagreement");
    for (const key of ["focal", "codatype", "handv"]) if (new Set([...meta, ...spectral].map(r => r.raw[key])).size > 1) conflicts.push(`${key}-metadata-disagreement`);
    const timing = variants.length === 1 ? observations[0] : null;
    const durationChecks = meta.map(r => ({ line: r.line, ...compare(measure(r.raw.Duration), timing?.duration ?? null) }));
    if (durationChecks.some(x => x.status === "conflict")) conflicts.push("duration-metadata-disagreement");
    return { id, meta, spectral, observations, timing, lastCount: lastCounts.length === 1 ? lastCounts[0] : null,
      spectralCount: spectralCounts.length === 1 ? spectralCounts[0] : null, conflicts, durationChecks,
      whale: names.length === 1 && names[0] !== "" ? names[0] : null };
  });
  return { events, pairChecks };
}
export type CetiEvent = ReturnType<typeof joinCeti>["events"][number];
export function compareCeti(row: CsvRow, event: CetiEvent, timing: Timing) {
  const onset = compare(measure(row.raw.TsTo), timing.relative);
  const wholeDuration = compare(sumIcis(row.raw, 28), timing.duration);
  const declaredDuration = compare(measure(row.raw.Duration), timing.duration);
  const countEqual = event.lastCount === null ? null : event.lastCount === Number(row.raw.nClicks);
  const spectralCountEqual = event.spectralCount === null ? null : event.spectralCount === Number(row.raw.nClicks);
  return { codanum: event.id, coartLine: timing.line, role: timing.role, onset, wholeDuration, declaredDuration,
    lastClickPosition: event.lastCount, countEqual, spectralClickLabels: event.spectralCount, spectralCountEqual,
    compatible: agrees(onset) && agrees(wholeDuration) && countEqual !== false && spectralCountEqual !== false && event.conflicts.length === 0,
    whale: event.whale, tagOn: timing.tagOn, relativeSeconds: timing.relative ? format(timing.relative.value) : null,
    durationSeconds: timing.duration ? format(timing.duration.value) : null,
    sequenceLines: [] as number[] };
}
export function linkCeti(originals: CsvRow[], joined: ReturnType<typeof joinCeti>) {
  // Enumerate each distinct timing variant even when conflicting; never pick one.
  const timed = joined.events.flatMap(e => {
    const seen = new Set<string>();
    return e.observations.filter(t => { const k = JSON.stringify([t.whale, t.tagOn, t.onset, t.end]); if (seen.has(k)) return false; seen.add(k); return true; }).map(t => ({ event: e, timing: t }));
  });
  const links = originals.map(r => ({ sourceLine: r.line, candidates: timed.filter(t => agrees(compare(measure(r.raw.TsTo), t.timing.relative))).map(t => compareCeti(r, t.event, t.timing)) }));
  const byId = new Map<string, { original: CsvRow; candidate: ReturnType<typeof compareCeti> }[]>();
  links.forEach((l, i) => l.candidates.filter(c => c.compatible).forEach(candidate => byId.set(candidate.codanum, [...(byId.get(candidate.codanum) ?? []), { original: originals[i], candidate }])));
  const sequenceChecks = joined.pairChecks.map(pair => {
    const a = byId.get(pair.previous) ?? [], b = byId.get(pair.current) ?? [];
    const combinations = a.flatMap(x => b.map(y => {
      const sameLocalCaller = x.original.raw.REC === y.original.raw.REC && x.original.raw.Whale === y.original.raw.Whale;
      const ordered = Number(x.original.raw.TsTo) < Number(y.original.raw.TsTo);
      const unique = a.length === 1 && b.length === 1;
      const supported = unique && sameLocalCaller && ordered && pair.sameTagOn && pair.firstClickIsOne && agrees(pair.gap);
      if (supported) { x.candidate.sequenceLines.push(pair.line); y.candidate.sequenceLines.push(pair.line); }
      return { previousRow: x.original.line, currentRow: y.original.line, sameLocalCaller, ordered, unique, supported };
    }));
    return { ...pair, combinations };
  });
  return { links, sequenceChecks };
}
