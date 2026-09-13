import { agrees, compare, decimal, measure, sumIcis } from "./precision.ts";
import type { CsvRow } from "./csv.ts";

// Conservative audit semantics, not an upstream data dictionary. U is a real
// observed unit label (FORK); numeric 0/9999 and UNID/ZZZ never become identities.
export function maorMetadata(raw: Record<string, string>) {
  const focal = raw.Focal === "1.0" || raw.Focal === "1";
  const name = raw.Name?.trim() ?? "", idn = raw.IDN?.trim() ?? "", unit = raw.Unit?.trim() ?? "";
  const unknownName = ["", "UNID", "UNKNOWN", "NA", "N/A"].includes(name.toUpperCase());
  const unknownId = ["", "0", "9999", "NA", "N/A"].includes(idn.toUpperCase());
  return {
    focal: raw.Focal, tagName: raw.Name, idn: raw.IDN, unit: raw.Unit, unitNum: raw.UnitNum,
    date: raw.Date, tagOnTime: raw.TagOnTime, tag: raw.Tag,
    producerCandidate: focal && !unknownName && !unknownId ? name : null,
    unitCandidate: focal && !unknownName && !unknownId && !["", "ZZZ", "UNKNOWN", "NA", "N/A"].includes(unit.toUpperCase()) ? unit : null,
    reason: !focal ? "Nonfocal or unspecified focal status; tag Name/Unit do not identify producer" : unknownName || unknownId ? "Unknown or undocumented placeholder; not a resolved individual" : "Inferred focal Name/IDN association; Maor dictionary unavailable",
  };
}

export function compareMaor(original: CsvRow, candidate: CsvRow) {
  const a = original.raw, b = candidate.raw;
  const onset = compare(measure(a.TsTo), measure(b.TsTo));
  const count = decimal(a.nClicks) !== null && decimal(a.nClicks) === decimal(b.nClicks);
  const ici = Array.from({ length: 28 }, (_, i) => {
    const key = `ICI${i + 1}`, av = decimal(a[key]), bv = decimal(b[key]);
    // Padding is structural, not a rounded measured zero.
    const check = av === 0n || bv === 0n ? compare(av === null ? null : { value: av, error: 0n }, bv === null ? null : { value: bv, error: 0n }) : compare(measure(a[key]), measure(b[key]));
    return { index: i + 1, ...check };
  });
  const extraNonzeroIcis = Array.from({ length: 12 }, (_, i) => i + 29).filter(i => decimal(b[`ICI${i}`]) !== 0n);
  const reportedDuration = compare(measure(a.Duration), measure(b.Duration));
  const iciDuration = compare(sumIcis(a, 28), sumIcis(b, 40));
  return {
    maorLine: candidate.line, codaNUM2018: b.codaNUM2018,
    key: { rec: a.REC === b.REC ? "exact-REC" : a.REC.slice(0, 9) === b.REC.slice(0, 9) ? "same-nine-character-file" : "same-six-character-root", maorREC: b.REC, originalWhale: a.Whale, maorWhale: b.Whale, whaleEqual: a.Whale === b.Whale, onset },
    countEqual: count, iciCompared: 28, commonTrueIcis: Math.min(Number(a.nClicks), Number(b.nClicks)) - 1,
    iciExact: ici.filter(x => x.status === "exact").length,
    iciRounded: ici.filter(x => x.status === "rounding-compatible").length,
    iciConflicts: ici.filter(x => !agrees(x)), extraNonzeroIcis, reportedDuration, iciDuration,
    compatible: agrees(onset) && count && ici.every(agrees) && extraNonzeroIcis.length === 0,
    metadata: maorMetadata(b),
  };
}

export function linkMaor(originals: CsvRow[], rows: CsvRow[]) {
  const roots = new Map<string, CsvRow[]>();
  for (const r of rows) roots.set(r.raw.REC.slice(0, 6), [...(roots.get(r.raw.REC.slice(0, 6)) ?? []), r]);
  const onset = new Map(rows.map(r => [r.line, measure(r.raw.TsTo)]));
  return originals.map(r => ({ sourceLine: r.line, candidates: (roots.get(r.raw.REC.slice(0, 6)) ?? [])
    .filter(m => agrees(compare(measure(r.raw.TsTo), onset.get(m.line)!)))
    .map(m => compareMaor(r, m)) }));
}

export function uniqueCompatible<T extends { compatible: boolean }>(candidates: T[]): T | null {
  const matches = candidates.filter(c => c.compatible);
  return matches.length === 1 ? matches[0] : null;
}
