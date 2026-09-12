import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Recording } from "../src/domain/types.ts";
import { buildEvidence, evidenceJson } from "../src/domain/evidence.ts";
import { registerEvidenceTool } from "../src/webmcp.ts";
import { readWav, estimateClicks } from "../scripts/wav.ts";
import { waveformBins } from "../src/audio.ts";

const recordings = JSON.parse(
  readFileSync(new URL("../src/data/recordings.json", import.meta.url), "utf8"),
) as Recording[];
const [a, b] = recordings;

it("exports reflect changed selections and view, preserving original measurements", () => {
  const initial = buildEvidence(a, b, "absolute", "2026-09-12T00:00:00.000Z");
  const changed = buildEvidence(b, b, "normalized", "2026-09-12T00:00:01.000Z");
  assert.equal(initial.selection[0].sourceId, "dswp-1");
  assert.equal(changed.selection[0].sourceId, "dswp-2");
  assert.notDeepEqual(
    initial.selection[0].originalTiming,
    changed.selection[0].originalTiming,
  );
  assert.equal(changed.view, "normalized");
  assert.equal(changed.comparison.status, "comparable");
  assert.equal(changed.comparison.value, 0);
  assert.deepEqual(
    changed.selection[0].originalTiming.clickTimesSeconds,
    b.annotation.clickTimesSeconds,
  );
  assert.deepEqual(JSON.parse(evidenceJson(changed)), changed);
  const swapped = buildEvidence(b, a, "absolute");
  assert.deepEqual(
    swapped.selection.map((item) => item.sourceId),
    [b.id, a.id],
  );
});

it("evidence is a snapshot and includes provenance, metric version and limitations", () => {
  const copy = structuredClone(a);
  const packet = buildEvidence(copy, b, "absolute");
  copy.annotation.clickTimesSeconds[0] = 0;
  assert.notEqual(packet.selection[0].annotation.clickTimesSeconds[0], 0);
  assert.equal(packet.selection[0].source.revision.length, 40);
  assert.equal(packet.selection[0].annotation.humanReview, "not-performed");
  assert.ok(packet.limitations.length);
  assert.equal(packet.comparison.metric.id, "normalized-interval-mad");
  assert.equal("modelRunId" in packet, false);
});

it("invalid synthetic timestamps cannot silently become JSON nulls", () => {
  const malformed = structuredClone(a);
  malformed.annotation.clickTimesSeconds = [0, NaN];
  const packet = buildEvidence(malformed, b, "absolute");
  assert.equal(packet.comparison.status, "not-comparable");
  assert.throws(() => evidenceJson(packet), /non-finite/);
});

it("an incompatible synthetic selection exports its explicit rejection", () => {
  const changed = structuredClone(b);
  changed.annotation.clickTimesSeconds = [0, 1];
  const packet = JSON.parse(
    evidenceJson(buildEvidence(a, changed, "absolute")),
  );
  assert.equal(packet.comparison.status, "not-comparable");
  assert.equal(packet.comparison.code, "UNEQUAL_CLICK_COUNTS");
  assert.equal("value" in packet.comparison, false);
});

it("both curated files match their byte hashes, PCM metadata and derived markers", () => {
  for (const recording of recordings) {
    const bytes = readFileSync(
      new URL(`../public${recording.audio.path}`, import.meta.url),
    );
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      recording.audio.sha256,
    );
    assert.equal(bytes.length, recording.audio.bytes);
    const wav = readWav(bytes);
    assert.equal(wav.sampleRate, recording.audio.sampleRateHz);
    assert.equal(wav.channels, recording.audio.channels);
    assert.equal(wav.duration, recording.audio.durationSeconds);
    assert.equal(wav.frames, recording.audio.frames);
    assert.deepEqual(
      estimateClicks(wav.pcm, wav.sampleRate),
      recording.annotation.clickSampleIndices,
    );
    assert.deepEqual(
      recording.annotation.clickSampleIndices.map((i) => i / wav.sampleRate),
      recording.annotation.clickTimesSeconds,
    );
    assert.ok(waveformBins(wav.pcm).some((bin) => bin.max > 0.05));
    assert.match(
      recording.source.url,
      new RegExp(`/${recording.source.revision}/${recording.source.filename}$`),
    );
    assert.equal(recording.source.license, "CC BY 4.0");
    assert.deepEqual(recording.audio.transformations, []);
  }
});

it("the optional WebMCP read contract follows the current packet and rejects arguments (mock registry)", () => {
  let current = buildEvidence(a, b, "absolute");
  let execute: (input: unknown) => typeof current = () => {
    throw new Error("Not registered");
  };
  let signal: AbortSignal | undefined;
  const dispose = registerEvidenceTool(
    {
      registerTool(tool, options) {
        assert.equal(tool.name, "read_current_comparison_evidence");
        assert.equal(tool.annotations.readOnlyHint, true);
        execute = tool.execute;
        signal = options?.signal;
      },
    },
    () => current,
  );
  assert.equal(execute({}).selection[0].sourceId, a.id);
  current = buildEvidence(b, a, "normalized");
  assert.equal(execute({}).selection[0].sourceId, b.id);
  assert.equal(execute({}).view, "normalized");
  assert.throws(() => execute({ sourceId: "invented" }), /empty object/);
  assert.throws(() => execute(null), /empty object/);
  dispose();
  assert.equal(signal?.aborted, true);
});
