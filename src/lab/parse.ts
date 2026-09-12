import { ordered, overlapPairs, type Coda, type Segment } from "./model.ts";
const HEADER = [
  "REC",
  "nClicks",
  "Duration",
  ...Array.from({ length: 28 }, (_, i) => `ICI${i + 1}`),
  "Whale",
  "TsTo",
];
const numeric = (s: string) =>
  /^[-+]?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?$/.test(s) ? Number(s) : NaN;
const halfUnit = (s: string) => {
  const [base, exponent = "0"] = s.toLowerCase().split("e");
  return 0.5 * 10 ** (Number(exponent) - (base.split(".")[1]?.length ?? 0));
};
export function parseAnnotations(csv: string) {
  const lines = csv.replace(/\r\n/g, "\n").trimEnd().split("\n");
  if (lines.shift() !== HEADER.join(","))
    throw new Error("Unexpected annotation CSV schema.");
  const calls: Coda[] = [],
    excluded: {
      sourceLine: number;
      rec: string;
      onset: number | null;
      declaredDuration: number | null;
      reasons: string[];
    }[] = [];
  const seen = new Set<string>(),
    groups = new Map<string, number>();
  let unordered = 0,
    previous: Record<string, number> = {},
    maxDurationDelta = 0;
  const summaries = lines.map((line, i) => {
    const sourceLine = i + 2,
      fields = line.split(",");
    if (fields.length !== HEADER.length || fields.some((v) => v.includes('"')))
      throw new Error(`Malformed CSV line ${sourceLine}.`);
    const raw = Object.fromEntries(HEADER.map((key, j) => [key, fields[j]]));
    const n = numeric(raw.nClicks),
      onset = numeric(raw.TsTo),
      declared = numeric(raw.Duration),
      icis = HEADER.slice(3, 31).map((k) => numeric(raw[k]));
    const reasons: string[] = [];
    if (!/^[a-zA-Z0-9_]+$/.test(raw.REC)) reasons.push("INVALID_REC");
    if (!Number.isInteger(n) || n < 2 || n > 29)
      reasons.push("INVALID_CLICK_COUNT");
    if (!/^[1-9]\d*$/.test(raw.Whale)) reasons.push("UNKNOWN_CALLER");
    if (!Number.isFinite(onset) || onset < 0) reasons.push("INVALID_ONSET");
    if (!Number.isFinite(declared) || declared <= 0)
      reasons.push("INVALID_DURATION");
    const validCount = Number.isInteger(n) && n >= 1 && n <= 29;
    const intervals = validCount ? icis.slice(0, n - 1) : [];
    if (icis.some((v) => !Number.isFinite(v)) || intervals.some((v) => v <= 0))
      reasons.push("INVALID_ICI");
    if (intervals.some((v) => v > 0 && v <= 0.0002))
      reasons.push("AUTHOR_FLAGGED_SHORT_ICI");
    if (validCount && icis.slice(n - 1).some((v) => v !== 0))
      reasons.push("NONZERO_PADDING");
    const duration = intervals.reduce((sum, v) => sum + v, 0);
    const tolerance =
      halfUnit(raw.Duration) +
      intervals.reduce((sum, _, j) => sum + halfUnit(raw[`ICI${j + 1}`]), 0) +
      1e-12;
    if (Number.isFinite(duration) && Number.isFinite(declared))
      maxDurationDelta = Math.max(
        maxDurationDelta,
        Math.abs(duration - declared),
      );
    if (Math.abs(duration - declared) > tolerance)
      reasons.push("DURATION_DISAGREEMENT");
    if (seen.has(line)) reasons.push("EXACT_DUPLICATE");
    seen.add(line);
    groups.set(raw.REC, (groups.get(raw.REC) ?? 0) + 1);
    if (Number.isFinite(onset)) {
      if (onset < previous[raw.REC]) unordered++;
      previous[raw.REC] = onset;
    }
    if (reasons.length)
      excluded.push({
        sourceLine,
        rec: raw.REC,
        onset: Number.isFinite(onset) ? onset : null,
        declaredDuration: Number.isFinite(declared) ? declared : null,
        reasons,
      });
    else {
      const clicks = [0];
      for (const ici of intervals) clicks.push(clicks.at(-1)! + ici);
      calls.push({
        id: `row-${sourceLine}`,
        sourceLine,
        rec: raw.REC,
        caller: raw.Whale,
        onset,
        duration,
        declaredDuration: declared,
        durationTolerance: tolerance,
        clicks,
        raw,
      });
    }
    return {
      rec: raw.REC,
      onset,
      end: onset + Math.max(duration, declared),
      sourceLine,
      valid: reasons.length === 0,
    };
  });
  return {
    calls,
    excluded,
    summaries,
    audit: {
      sourceRows: lines.length,
      validRows: calls.length,
      excludedRows: excluded.length,
      groups: Object.fromEntries(groups),
      recordingPrefixes: new Set([...groups.keys()].map((r) => r.slice(0, 9)))
        .size,
      outOfOrderWithinRec: unordered,
      maxDeclaredDurationDeltaSeconds: maxDurationDelta,
      exclusionCounts: Object.fromEntries(
        [...new Set(excluded.flatMap((e) => e.reasons))]
          .sort()
          .map((reason) => [
            reason,
            excluded.filter((e) => e.reasons.includes(reason)).length,
          ]),
      ),
    },
  };
}
export function selectSegment(
  parsed: ReturnType<typeof parseAnnotations>,
): Segment {
  for (const rec of Object.keys(parsed.audit.groups).sort()) {
    const rows = parsed.summaries.filter((r) => r.rec === rec),
      group = ordered(parsed.calls.filter((c) => c.rec === rec));
    const last = Math.max(...rows.map((r) => r.end).filter(Number.isFinite));
    for (const first of group) {
      const start = first.onset,
        end = start + 60;
      if (
        end > last ||
        rows.some(
          (r) =>
            !r.valid &&
            (!Number.isFinite(r.onset) ||
              (r.onset < end &&
                (r.onset >= start ||
                  !Number.isFinite(r.end) ||
                  r.end > start))),
        )
      )
        continue;
      const calls = group.filter(
        (c) => c.onset >= start && c.onset + c.duration <= end,
      );
      const callers = [...new Set(calls.map((c) => c.caller))].sort(
        (a, b) => Number(a) - Number(b),
      );
      if (
        calls.length < 12 ||
        calls.length > 60 ||
        callers.length !== 2 ||
        callers.some(
          (caller) => calls.filter((c) => c.caller === caller).length < 4,
        )
      )
        continue;
      const segment: Segment = {
        id: `${rec}-from-row-${first.sourceLine}-60s-v1`,
        rec,
        start,
        end,
        callers: callers as [string, string],
        calls,
        boundaryExcludedLines: rows
          .filter(
            (r) =>
              r.valid &&
              r.onset < end &&
              r.end > start &&
              (r.onset < start || r.end > end),
          )
          .map((r) => r.sourceLine),
      };
      if (overlapPairs(segment).length >= 4) return segment;
    }
  }
  throw new Error("No segment satisfies the frozen coverage rule.");
}
