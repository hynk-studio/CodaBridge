import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  comparePairing,
  overlapPairs,
  validateSegment,
  type Coda,
  type Segment,
} from "../src/lab/model.ts";
import { parseAnnotations, selectSegment } from "../src/lab/parse.ts";
import {
  contextSegment,
  contextSource,
  labBinding,
} from "../src/lab/catalog.ts";
import {
  exchangeSchedule,
  renderExchange,
  exchangeWav,
} from "../src/lab/sound.ts";
import { investigationPacket } from "../src/lab/export.ts";
import { createDraft } from "../src/composer/model.ts";
import { renderSamples, RENDERER } from "../src/composer/sound.ts";

function coda(
  line: number,
  caller: string,
  onset: number,
  duration: number,
  clicks = [0, duration],
): Coda {
  return {
    id: `row-${line}`,
    sourceLine: line,
    rec: "fixture",
    caller,
    onset,
    duration,
    declaredDuration: duration,
    durationTolerance: 1e-12,
    clicks,
    raw: {},
  };
}
function segment(calls: Coda[]): Segment {
  return {
    id: "TEST_ONLY",
    rec: "fixture",
    start: 0,
    end: 60,
    callers: ["1", "2"],
    calls,
    boundaryExcludedLines: [],
  };
}
const hand = () =>
  segment([
    coda(2, "1", 0, 2),
    coda(3, "2", 1, 1),
    coda(4, "1", 5, 4, [0, 1, 4]),
    coda(5, "2", 6, 3),
    coda(6, "2", 12, 5),
  ]);
const near = (a: number | null, b: number) =>
  assert.ok(a !== null && Math.abs(a - b) < 1e-12, `${a} != ${b}`);

it("hand-computable fixed pairs: observed 1, controls 1 and 3, median 2; reset and B inventory", () => {
  const s = hand(),
    before = structuredClone(s),
    zero = comparePairing(s, 0);
  near(zero.observed.valueSeconds, 1);
  assert.deepEqual(zero.selected, zero.observed);
  assert.equal(zero.pairCount, 2);
  assert.equal(zero.uniqueCallCount, 4);
  assert.deepEqual(
    zero.observed.pairs.map((p) => [p.aId, p.bId]),
    [
      ["row-2", "row-3"],
      ["row-4", "row-5"],
    ],
  );
  assert.deepEqual(
    zero.controls.map((c) => c.valueSeconds),
    [1, 3],
  );
  assert.deepEqual(zero.controlSummary, {
    minSeconds: 1,
    maxSeconds: 3,
    medianSeconds: 2,
  });
  for (let k = 0; k < 3; k++) {
    const result = comparePairing(s, k);
    assert.deepEqual(
      result.selected.pairs.map((p) => [p.aId, p.bId, p.overlapSeconds]),
      zero.observed.pairs.map((p) => [p.aId, p.bId, p.overlapSeconds]),
    );
    assert.deepEqual(
      result.selected.assignments
        .map((a) => a.durationSeconds)
        .sort((a, b) => a - b),
      [1, 3, 5],
    );
    assert.deepEqual(s, before);
  }
  assert.equal(
    comparePairing(s, 1).selected.pairs[0].durationFromRowId,
    "row-5",
  );
  assert.throws(() => comparePairing(s, -1));
  assert.throws(() => comparePairing(s, 3));
  assert.throws(() => comparePairing(s, 0.5));
});

it("positive overlaps include simultaneous/nested spans and pair reuse; touching endpoints do not pair", () => {
  const s = segment([
    coda(2, "1", 1, 5),
    coda(3, "1", 3, 1),
    coda(4, "2", 1, 2),
    coda(5, "2", 3, 2),
    coda(6, "2", 6, 1),
  ]);
  assert.deepEqual(
    overlapPairs(s).map((p) => [p.aId, p.bId]),
    [
      ["row-2", "row-4"],
      ["row-2", "row-5"],
      ["row-3", "row-5"],
    ],
  );
  assert.equal(comparePairing(s, 1).uniqueCallCount, 4);
  assert.deepEqual(
    overlapPairs(s),
    overlapPairs({ ...s, calls: [...s.calls].reverse() }),
  );
});

it("equivalent rotations retain source mappings, but are not counted as new controls", () => {
  const s = segment([
    coda(2, "1", 0, 3),
    ...[1, 2, 1, 2].map((d, i) => coda(i + 3, "2", i * 5 + 1, d)),
  ]);
  const r = comparePairing(s, 3);
  assert.equal(r.distinctControlCount, 1);
  assert.equal(r.equivalentControlCount, 2);
  assert.deepEqual(
    r.controls.map((c) => c.equivalentToOffset),
    [null, 0, 1],
  );
  assert.notDeepEqual(
    r.selected.assignments,
    comparePairing(s, 1).selected.assignments,
  );
  assert.equal(
    r.selected.valueSeconds,
    comparePairing(s, 1).selected.valueSeconds,
  );
});

it("insufficient data has explicit reasons and unavailable values, never a manufactured zero effect", () => {
  const no = comparePairing(
    segment([coda(2, "1", 0, 1), coda(3, "2", 2, 1), coda(4, "2", 4, 2)]),
    1,
  );
  assert.equal(no.reason, "NO_OVERLAP_PAIRS");
  assert.equal(no.observed.valueSeconds, null);
  assert.equal(no.controlSummary, null);
  const one = comparePairing(
    segment([coda(2, "1", 0, 2), coda(3, "2", 1, 1)]),
    0,
  );
  assert.equal(one.reason, "TOO_FEW_B_CALLS");
  assert.equal(one.controlSummary, null);
  const same = comparePairing(
    segment([coda(2, "1", 0, 2), coda(3, "2", 1, 1), coda(4, "2", 5, 1)]),
    1,
  );
  assert.equal(same.reason, "NO_DISTINCT_CONTROLS");
  assert.equal(same.distinctControlCount, 0);
  assert.equal(same.controlSummary, null);
  assert.throws(() => validateSegment({ ...hand(), start: NaN }));
  assert.throws(() => validateSegment({ ...hand(), callers: ["0", "2"] }));
});

const header = [
  "REC",
  "nClicks",
  "Duration",
  ...Array.from({ length: 28 }, (_, i) => `ICI${i + 1}`),
  "Whale",
  "TsTo",
];
function csvRow(changes: Record<string, string> = {}) {
  const row: Record<string, string> = {
    REC: "test_rec",
    nClicks: "3",
    Duration: "0.300000",
    Whale: "1",
    TsTo: "10.0000",
    ...Object.fromEntries(
      Array.from({ length: 28 }, (_, i) => [
        `ICI${i + 1}`,
        i === 0 ? "0.100000" : i === 1 ? "0.200000" : "0",
      ]),
    ),
    ...changes,
  };
  return header.map((k) => row[k]).join(",");
}
function parseRows(rows: string[]) {
  return parseAnnotations([header.join(","), ...rows].join("\n"));
}

it("annotation parser preserves exact rows, true ICIs and long codas; rejects unknowns, padding, precision failures and duplicates", () => {
  const long = csvRow({
    nClicks: "29",
    Duration: "2.800000",
    ...Object.fromEntries(
      Array.from({ length: 28 }, (_, i) => [`ICI${i + 1}`, "0.100000"]),
    ),
  });
  const p = parseRows([
    csvRow(),
    long,
    csvRow(),
    csvRow({ Whale: "0" }),
    csvRow({ ICI3: "0.01" }),
    csvRow({ Duration: "0.310000" }),
    csvRow({ ICI1: "0.0001" }),
    csvRow({ TsTo: "NaN" }),
    csvRow({ nClicks: "1" }),
  ]);
  assert.equal(p.calls.length, 2);
  assert.equal(p.calls[1].clicks.length, 29);
  assert.deepEqual(p.calls[0].clicks, [0, 0.1, 0.30000000000000004]);
  assert.equal(p.calls[0].raw.ICI28, "0");
  assert.equal(p.calls[0].raw.Duration, "0.300000");
  for (const reason of [
    "UNKNOWN_CALLER",
    "EXACT_DUPLICATE",
    "NONZERO_PADDING",
    "DURATION_DISAGREEMENT",
    "AUTHOR_FLAGGED_SHORT_ICI",
    "INVALID_ONSET",
    "INVALID_CLICK_COUNT",
  ])
    assert.ok(
      p.excluded.some((e) => e.reasons.includes(reason)),
      reason,
    );
  assert.throws(() => parseAnnotations("REC,other\n1,2"));
  assert.throws(() => parseRows(["wrong"]));
  assert.equal(parseRows([csvRow({ Duration: "0.300001" })]).calls.length, 1);
  assert.equal(parseRows([csvRow({ Duration: "0.300002" })]).calls.length, 0);
  assert.equal(
    parseRows([csvRow({ TsTo: "11" }), csvRow({ TsTo: "10" })]).audit
      .outOfOrderWithinRec,
    1,
  );
});

it("real archived source independently reproduces audited selection and duration control without source edits", () => {
  const csv = readFileSync("data/context/sperm-whale-dialogues.csv"),
    p = parseAnnotations(csv.toString()),
    selected = selectSegment(p);
  assert.equal(
    createHash("sha256").update(csv).digest("hex"),
    contextSource.csvSha256,
  );
  assert.equal(p.audit.sourceRows, 3840);
  assert.equal(p.calls.length, 3790);
  assert.equal(p.excluded.length, 50);
  assert.equal(Object.keys(p.audit.groups).length, 219);
  assert.equal(p.audit.outOfOrderWithinRec, 0);
  assert.deepEqual(selected, contextSegment);
  assert.deepEqual(selected.boundaryExcludedLines, [25]);
  assert.equal(Math.max(...selected.calls.map((c) => c.clicks.length)), 20);
  const before = JSON.stringify(selected),
    r = comparePairing(selected, 1);
  near(r.observed.valueSeconds, 0.13286695714285718);
  near(r.selected.valueSeconds, 0.1438996285714286);
  near(r.controlSummary!.minSeconds, 0.08378658571428575);
  near(r.controlSummary!.maxSeconds, 0.1940878);
  assert.equal(r.pairCount, 7);
  assert.equal(r.uniqueCallCount, 14);
  assert.equal(r.distinctControlCount, 8);
  // Independent original row arithmetic, not scores from the derived file.
  const rows = csv
    .toString()
    .trim()
    .split("\n")
    .map((line) => line.split(","));
  const span = (line: number) =>
    rows[line - 1]
      .slice(3, 3 + Number(rows[line - 1][1]) - 1)
      .reduce((s, v) => s + Number(v), 0);
  const independent =
    r.observed.pairs.reduce(
      (s, p) => s + Math.abs(span(p.aSourceLine) - span(p.bSlotSourceLine)),
      0,
    ) / r.pairCount;
  near(r.observed.valueSeconds, independent);
  for (let k = 0; k < 9; k++) comparePairing(selected, k);
  assert.equal(JSON.stringify(selected), before);
  const unknown = {
    ...p,
    summaries: p.summaries.map((r) =>
      r.sourceLine === 2 ? { ...r, valid: false } : r,
    ),
  };
  assert.notEqual(selectSegment(unknown).id, selected.id);
});

it("reconstruction schedules source clicks unchanged, supports mute/solo and limits combined gain without expanding Composer", () => {
  const s = hand(),
    schedule = exchangeSchedule(s, 0, 20, []);
  const expected = s.calls
    .flatMap((c) => c.clicks.map((t) => c.onset + t + RENDERER.leadSeconds))
    .sort((a, b) => a - b);
  assert.deepEqual(
    schedule.events.map((e) => e.seconds),
    expected,
  );
  const solo = exchangeSchedule(s, 0, 20, ["2"]);
  assert.equal(solo.events.length, 5);
  const rendered = renderExchange(s, 0, 20, []);
  let peak = 0;
  for (const v of rendered.samples) peak = Math.max(peak, Math.abs(v));
  assert.ok(peak > 0 && peak < RENDERER.gain);
  comparePairing(s, 2);
  assert.deepEqual(exchangeSchedule(s, 0, 20, []), schedule);
  assert.throws(() => exchangeSchedule(s, 0, 121, []));
  assert.throws(() => exchangeSchedule(s, 0, 20, ["99"]));
  const draft = createDraft("dswp-1"),
    before = structuredClone(draft);
  const old = renderSamples(draft).samples;
  const wav = Buffer.from(exchangeWav(contextSegment));
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(24), 48000);
  assert.match(wav.toString(), /research annotations/);
  assert.match(wav.toString(), /CC BY 4.0/);
  assert.deepEqual(renderSamples(draft).samples, old);
  assert.deepEqual(draft, before);
});

it("saved investigation recomputes deterministic fields, binds selection and labels saved interpretation historical", () => {
  const row = contextSegment.calls[0].id;
  const p = investigationPacket(
    "<script>untrusted question</script>",
    1,
    row,
    null,
  );
  assert.equal(p.question, "<script>untrusted question</script>");
  assert.equal(p.generated, null);
  assert.match(p.savedAnalysisStatus, /Historical/);
  assert.deepEqual(p.comparison, comparePairing(contextSegment, 1));
  assert.equal(p.selection.binding, labBinding(1, row));
  assert.ok(Buffer.byteLength(JSON.stringify(p, null, 2)) < 131072);
  assert.throws(() => investigationPacket("x".repeat(801), 1, row, null));
  assert.throws(() => investigationPacket("x", 1, "invented", null));
});
