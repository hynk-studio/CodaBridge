export const LAB_METHOD = "paired-duration-gap-v1";
export const LAB_LIMITS = Object.freeze({
  calls: 60,
  markers: 29,
  segmentSeconds: 120,
  windowSeconds: 30,
  events: 1740,
  packetBytes: 131072,
});
export interface Coda {
  id: string;
  sourceLine: number;
  rec: string;
  caller: string;
  onset: number;
  duration: number;
  declaredDuration: number;
  durationTolerance: number;
  clicks: number[];
  raw: Record<string, string>;
}
export interface Segment {
  id: string;
  rec: string;
  start: number;
  end: number;
  callers: [string, string];
  calls: Coda[];
  boundaryExcludedLines: number[];
}
export const LAB_LIMITATIONS = [
  "Timing reconstruction from research annotations — not the original recording. No mapping to the four field clips or your creation is established.",
  "A and B are annotation-local caller labels, not verified identities across recordings or REC groups. Annotation precision is not accuracy.",
  "Fixed positive-overlap pairs may reuse calls. This is a selected segment, not independent population samples.",
  "Circular reassignment preserves B's duration inventory and circular order, but introduces a seam and may mix coda types or shared settings.",
  "This descriptive sensitivity control is not the paper's type-conditioned permutation test or the planned predictive Dialogue Transfer experiment. It establishes no causality, independence, whale meaning or semantic confidence.",
];
export function validateSegment(segment: Segment) {
  if (
    !segment.id ||
    !Number.isFinite(segment.start) ||
    segment.start < 0 ||
    !Number.isFinite(segment.end) ||
    segment.calls.length > LAB_LIMITS.calls ||
    segment.end <= segment.start ||
    segment.end - segment.start > LAB_LIMITS.segmentSeconds ||
    segment.callers.length !== 2 ||
    segment.callers.some((c) => !/^[1-9]\d*$/.test(c)) ||
    segment.callers[0] === segment.callers[1]
  )
    throw new Error("Invalid segment bounds.");
  const ids = new Set<string>();
  for (const c of segment.calls) {
    if (
      ids.has(c.id) ||
      c.rec !== segment.rec ||
      !segment.callers.includes(c.caller) ||
      !Number.isFinite(c.onset) ||
      c.onset < segment.start ||
      !Number.isFinite(c.duration) ||
      c.duration <= 0 ||
      c.onset + c.duration > segment.end + 1e-9 ||
      c.clicks.length < 2 ||
      c.clicks.length > LAB_LIMITS.markers ||
      c.clicks[0] !== 0 ||
      c.clicks.some(
        (v, i) => !Number.isFinite(v) || (i > 0 && v <= c.clicks[i - 1]),
      ) ||
      Math.abs(c.clicks.at(-1)! - c.duration) > 1e-9
    )
      throw new Error("Invalid source coda.");
    ids.add(c.id);
  }
  return segment;
}
export function ordered(calls: Coda[]) {
  return [...calls].sort(
    (a, b) =>
      a.onset - b.onset ||
      a.sourceLine - b.sourceLine ||
      a.id.localeCompare(b.id),
  );
}
export function overlapPairs(segment: Segment) {
  validateSegment(segment);
  const a = ordered(
    segment.calls.filter((c) => c.caller === segment.callers[0]),
  );
  const b = ordered(
    segment.calls.filter((c) => c.caller === segment.callers[1]),
  );
  return a.flatMap((left) =>
    b
      .filter(
        (right) =>
          Math.min(left.onset + left.duration, right.onset + right.duration) >
          Math.max(left.onset, right.onset),
      )
      .map((right) => ({
        aId: left.id,
        bId: right.id,
        overlapSeconds:
          Math.min(left.onset + left.duration, right.onset + right.duration) -
          Math.max(left.onset, right.onset),
      })),
  );
}
export function comparePairing(segment: Segment, offset: number) {
  const pairs = overlapPairs(segment);
  const b = ordered(
    segment.calls.filter((c) => c.caller === segment.callers[1]),
  );
  if (
    !Number.isInteger(offset) ||
    offset < 0 ||
    offset >= Math.max(1, b.length)
  )
    throw new Error("Invalid control offset.");
  const calls = new Map(segment.calls.map((c) => [c.id, c]));
  function rotation(k: number) {
    const assignments = b.map((slot, i) => ({
      slotRowId: slot.id,
      durationFromRowId: b[(i + k) % b.length].id,
      durationSeconds: b[(i + k) % b.length].duration,
    }));
    const mapping = new Map(assignments.map((a) => [a.slotRowId, a]));
    const rows = pairs.map((pair) => {
      const left = calls.get(pair.aId)!,
        right = calls.get(pair.bId)!,
        reassigned = mapping.get(pair.bId)!;
      return {
        ...pair,
        aSourceLine: left.sourceLine,
        bSlotSourceLine: right.sourceLine,
        durationFromRowId: reassigned.durationFromRowId,
        durationFromSourceLine: calls.get(reassigned.durationFromRowId)!
          .sourceLine,
        aDurationSeconds: left.duration,
        originalBDurationSeconds: right.duration,
        assignedBDurationSeconds: reassigned.durationSeconds,
        absoluteDifferenceSeconds: Math.abs(
          left.duration - reassigned.durationSeconds,
        ),
      };
    });
    return {
      offset: k,
      assignments,
      pairs: rows,
      valueSeconds: rows.length
        ? rows.reduce((sum, p) => sum + p.absoluteDifferenceSeconds, 0) /
          rows.length
        : null,
    };
  }
  const observed = rotation(0),
    selected = rotation(offset);
  // Distinctness is the full ordered B value assignment, not the scalar score.
  // Row mappings are retained even when repeated values produce equivalents.
  const signature = (r: ReturnType<typeof rotation>) =>
    JSON.stringify(r.assignments.map((a) => a.durationSeconds));
  const seen = new Map<string, number>([[signature(observed), 0]]);
  const controls: {
    offset: number;
    valueSeconds: number | null;
    equivalentToOffset: number | null;
  }[] = [];
  for (let k = 1; k < b.length; k++) {
    const r = rotation(k),
      key = signature(r),
      equivalent = seen.get(key);
    controls.push({
      offset: k,
      valueSeconds: r.valueSeconds,
      equivalentToOffset: equivalent ?? null,
    });
    if (equivalent === undefined) seen.set(key, k);
  }
  const distinct = controls.filter((c) => c.equivalentToOffset === null);
  const values = distinct
    .flatMap((c) => (c.valueSeconds === null ? [] : [c.valueSeconds]))
    .sort((a, b) => a - b);
  const reason = !pairs.length
    ? "NO_OVERLAP_PAIRS"
    : b.length < 2
      ? "TOO_FEW_B_CALLS"
      : !distinct.length
        ? "NO_DISTINCT_CONTROLS"
        : null;
  return {
    method: LAB_METHOD,
    unit: "seconds",
    status: reason ? ("insufficient-data" as const) : ("available" as const),
    reason,
    pairCount: pairs.length,
    uniqueCallCount: new Set(pairs.flatMap((p) => [p.aId, p.bId])).size,
    aCallCount: segment.calls.filter((c) => c.caller === segment.callers[0])
      .length,
    bCallCount: b.length,
    observed,
    selected,
    controls,
    distinctControlCount: distinct.length,
    equivalentControlCount: controls.length - distinct.length,
    controlSummary: values.length
      ? {
          minSeconds: values[0],
          maxSeconds: values.at(-1)!,
          medianSeconds:
            (values[Math.floor((values.length - 1) / 2)] +
              values[Math.floor(values.length / 2)]) /
            2,
        }
      : null,
    limitations: LAB_LIMITATIONS,
  };
}
