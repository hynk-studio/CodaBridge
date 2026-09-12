import { it } from "node:test";
import assert from "node:assert/strict";
import { recordings } from "../src/domain/catalog.ts";
import { compareTiming, measureTiming } from "../src/domain/timing.ts";
import {
  applyOperations,
  binding,
  blockTiming,
  commitDraft,
  createDraft,
  parseDraft,
  seedBlock,
  span,
  travel,
  COMPOSER_LIMITS,
  type History,
  type Operation,
} from "../src/composer/model.ts";
import { compareBlock, beforeAfter } from "../src/composer/analysis.ts";
import {
  durationHint,
  operationLabels,
  timingChange,
} from "../src/composer/presentation.ts";
import {
  parseProject,
  projectJson,
  sourceCredits,
} from "../src/composer/project.ts";
import {
  eventSchedule,
  RENDERER,
  renderSamples,
  wavBytes,
} from "../src/composer/sound.ts";

it("coalesced text preserves the timing transaction and advances every revision", () => {
  const draft = createDraft("dswp-1");
  let history: History = { present: draft, past: [], future: [] };
  history = commitDraft(
    history,
    applyOperations(draft, [
      { op: "scale_duration", blockId: draft.blocks[0].id, factor: 1.25 },
    ]),
  );
  const timing = history.present;
  for (let i = 0; i < 70; i++) {
    const prior = history.present;
    history = commitDraft(
      history,
      { ...prior, intention: prior.intention + "a" },
      i > 0,
    );
    assert.equal(history.present.revision, prior.revision + 1);
    assert.notEqual(
      binding(history.present, draft.blocks[0].id),
      binding(prior, draft.blocks[0].id),
    );
  }
  assert.equal(COMPOSER_LIMITS.history, 40);
  assert.equal(history.past.length, 2);
  history = travel(history, "undo");
  assert.equal(history.present.intention, "");
  assert.deepEqual(history.present.blocks, timing.blocks);
  history = travel(history, "undo");
  assert.deepEqual(history.present.blocks, draft.blocks);
  history = travel(travel(history, "redo"), "redo");
  assert.equal(history.present.intention.length, 70);
  assert.deepEqual(history.present.blocks, timing.blocks);
});

it("proposal labels follow new, moved and removed identities in sequence", () => {
  const draft = createDraft("dswp-1"),
    id = draft.blocks[0].id;
  const labels = operationLabels(draft, [
    { op: "duplicate_block", blockId: id, newBlockId: "copy" },
    { op: "scale_duration", blockId: "copy", factor: 1.25 },
    { op: "move_block", blockId: "copy", toIndex: 0 },
    { op: "remove_block", blockId: id },
    { op: "add_seed", sourceId: "dswp-2", newBlockId: "other" },
    { op: "set_gap", blockId: "other", gapIndex: 0, seconds: 0.3 },
    { op: "remove_block", blockId: "other" },
  ]);
  assert.deepEqual(labels, [
    "Duplicate Block 1 (position 1) → New block 2 at position 2.",
    "Scale New block 2 (position 2) ×1.25.",
    "Move New block 2 from position 2 → 1.",
    "Remove Block 1 from position 2.",
    "Add New block 3 from dswp-2 at position 2.",
    "Set New block 3 (position 2), gap 1 → 2, to 0.3 s.",
    "Remove New block 3 from position 2.",
  ]);
  assert.equal(draft.blocks.length, 1);
  assert.throws(() =>
    operationLabels(draft, [{ op: "remove_block", blockId: "absent" }]),
  );
});

it("timing descriptions distinguish duration from normalized spacing and use the actual factor", () => {
  const draft = createDraft("dswp-1"),
    block = draft.blocks[0];
  const scaled = applyOperations(draft, [
    { op: "scale_duration", blockId: block.id, factor: 1.5 },
  ]);
  assert.match(
    timingChange(block, scaled.blocks[0]),
    /×1.5.*longer; relative spacing is unchanged/,
  );
  assert.equal(timingChange(block, block), "The timing is unchanged.");
  const changed = applyOperations(draft, [
    {
      op: "set_gap",
      blockId: block.id,
      gapIndex: 0,
      seconds: block.times[1] + 0.05,
    },
  ]);
  assert.match(timingChange(block, changed.blocks[0]), /different proportions/);
  assert.match(
    timingChange(block, seedBlock("dswp-7")),
    /Different marker counts/,
  );
  assert.match(durationHint(0.8), /×0.8 multiplies every gap by 0.8/);
  assert.match(durationHint(1), /leave timing unchanged/);
  assert.match(durationHint(NaN), /Choose a duration multiplier/);
});

it("copies seed timing with stable source/offset and independent duplicated blocks", () => {
  const original = JSON.stringify(recordings),
    draft = createDraft("dswp-1"),
    block = draft.blocks[0];
  assert.equal(block.times[0], 0);
  assert.equal(
    block.seed.originalOffsetSeconds,
    recordings[0].annotation.clickTimesSeconds[0],
  );
  block.times.forEach((t, i) =>
    assert.ok(
      Math.abs(
        t +
          block.seed.originalOffsetSeconds -
          recordings[0].annotation.clickTimesSeconds[i],
      ) < 1e-12,
    ),
  );
  const copy = applyOperations(draft, [
    { op: "duplicate_block", blockId: block.id, newBlockId: "copy" },
  ]);
  const edited = applyOperations(copy, [
    { op: "scale_duration", blockId: "copy", factor: 1.25 },
  ]);
  assert.equal(span(edited.blocks[0]), span(block));
  assert.equal(span(edited.blocks[1]), span(block) * 1.25);
  assert.equal(JSON.stringify(recordings), original);
  assert.equal(JSON.stringify(draft.blocks[0]), JSON.stringify(block));
});
it("uniform scaling preserves normalized spacing while one gap moves only its suffix", () => {
  const draft = createDraft("dswp-1"),
    b = draft.blocks[0];
  const scaled = applyOperations(draft, [
    { op: "scale_duration", blockId: b.id, factor: 1.25 },
  ]);
  const result = compareTiming(blockTiming(b), blockTiming(scaled.blocks[0]));
  assert.equal(result.status, "comparable");
  if (result.status === "comparable") assert.ok(result.value < 1e-15);
  const changed = applyOperations(scaled, [
    { op: "set_gap", blockId: b.id, gapIndex: 1, seconds: 0.7 },
  ]);
  const before = measureTiming(blockTiming(scaled.blocks[0])),
    after = measureTiming(blockTiming(changed.blocks[0]));
  if (before.status !== "valid" || after.status !== "valid") assert.fail();
  after.measurements.intervalsSeconds.forEach((gap, i) =>
    assert.ok(
      Math.abs(
        gap - (i === 1 ? 0.7 : before.measurements.intervalsSeconds[i]),
      ) < 1e-12,
    ),
  );
  assert.deepEqual(
    changed.blocks[0].times.slice(0, 2),
    scaled.blocks[0].times.slice(0, 2),
  );
  const score = compareBlock(changed, b.id, scaled.blocks[0]);
  assert.ok(
    score.seed.comparison.status === "comparable" &&
      score.seed.comparison.value > 0,
  );
});
it("block spacing and order change the phrase schedule but not block timing", () => {
  const draft = createDraft("dswp-1"),
    b = draft.blocks[0];
  const pair = applyOperations(draft, [
    { op: "add_seed", sourceId: "dswp-2", newBlockId: "second" },
    { op: "set_spacing", blockId: b.id, seconds: 0.9 },
  ]);
  const events = eventSchedule(pair);
  assert.ok(
    Math.abs(
      events.events[6].seconds - (RENDERER.leadSeconds + span(b) + 0.9),
    ) < 1e-12,
  );
  const swapped = applyOperations(pair, [
    { op: "move_block", blockId: "second", toIndex: 0 },
  ]);
  assert.equal(swapped.blocks[0].id, "second");
  assert.deepEqual(swapped.blocks[1].times, b.times);
  assert.equal(
    applyOperations(swapped, [{ op: "remove_block", blockId: "second" }]).blocks
      .length,
    1,
  );
});
it("undo and redo restore content but never reuse revisions or result bindings", () => {
  const original = createDraft("dswp-1"),
    id = original.blocks[0].id;
  const h: History = { present: original, past: [], future: [] };
  const changed = commitDraft(
    h,
    applyOperations(original, [
      { op: "scale_duration", blockId: id, factor: 1.25 },
    ]),
  );
  const undo = travel(changed, "undo"),
    redo = travel(undo, "redo");
  assert.deepEqual(undo.present.blocks, original.blocks);
  assert.deepEqual(redo.present.blocks, changed.present.blocks);
  assert.deepEqual(
    [
      original.revision,
      changed.present.revision,
      undo.present.revision,
      redo.present.revision,
    ],
    [0, 1, 2, 3],
  );
  assert.notEqual(binding(original, id), binding(undo.present, id));
  assert.equal(
    commitDraft(
      undo,
      applyOperations(undo.present, [
        { op: "scale_duration", blockId: id, factor: 1.1 },
      ]),
    ).future.length,
    0,
  );
});
it("retrieval excludes phrase ancestry and byte copies, deduplicates candidates and keeps unequal counts", () => {
  const draft = createDraft("dswp-1"),
    id = draft.blocks[0].id;
  const catalog = structuredClone(recordings);
  catalog.push(
    { ...structuredClone(recordings[0]), id: "seed-byte-copy" },
    { ...structuredClone(recordings[1]), id: "candidate-byte-copy" },
  );
  const result = compareBlock(draft, id, null, catalog);
  assert.equal(result.eligibleCount, 2);
  assert.equal(result.candidateCount, 3);
  assert.deepEqual(result.excludedDuplicates, [
    "seed-byte-copy",
    "candidate-byte-copy",
  ]);
  assert.deepEqual(
    new Set(result.matches.map((r) => r.sourceId)),
    new Set(["dswp-2", "dswp-11"]),
  );
  assert.equal(result.rejected[0].sourceId, "dswp-7");
  assert.equal(result.rejected[0].comparison.status, "not-comparable");
  const pair = applyOperations(draft, [
    { op: "add_seed", sourceId: "dswp-2", newBlockId: "second" },
  ]);
  const removed = applyOperations(pair, [
    { op: "remove_block", blockId: "second" },
  ]);
  assert.deepEqual(
    compareBlock(removed, id).matches.map((r) => r.sourceId),
    ["dswp-11"],
  );
});
for (const [name, build] of Object.entries({
  unknown: () => [{ op: "execute_code", code: "evil" }],
  stale: () => [{ op: "scale_duration", blockId: "missing", factor: 1.25 }],
  sourceMutation: (id: string) => [
    { op: "scale_duration", blockId: id, factor: 1.25, seed: "dswp-7" },
  ],
  badGap: (id: string) => [
    { op: "set_gap", blockId: id, gapIndex: 0, seconds: 0 },
  ],
  nonfinite: (id: string) => [
    { op: "scale_duration", blockId: id, factor: Infinity },
  ],
  stringFactor: (id: string) => [
    { op: "scale_duration", blockId: id, factor: "2" },
  ],
  noOp: (id: string) => [{ op: "scale_duration", blockId: id, factor: 1 }],
  tooMany: (id: string) =>
    Array.from({ length: 9 }, () => ({
      op: "scale_duration",
      blockId: id,
      factor: 1.01,
    })),
  removeOnly: (id: string) => [{ op: "remove_block", blockId: id }],
  duplicateId: (id: string) => [
    { op: "duplicate_block", blockId: id, newBlockId: id },
  ],
  tooManyBlocks: (id: string) =>
    Array.from({ length: 4 }, (_, i) => ({
      op: "duplicate_block",
      blockId: id,
      newBlockId: `copy${i}`,
    })),
}))
  it(`invalid ${name} operation batch cannot partially mutate a draft`, () => {
    const draft = createDraft("dswp-1"),
      original = JSON.stringify(draft);
    assert.throws(() => applyOperations(draft, build(draft.blocks[0].id)));
    assert.equal(JSON.stringify(draft), original);
  });
it("a valid edit followed by an invalid one leaves the original unchanged", () => {
  const draft = createDraft("dswp-1"),
    original = JSON.stringify(draft),
    id = draft.blocks[0].id;
  assert.throws(() =>
    applyOperations(draft, [
      { op: "scale_duration", blockId: id, factor: 1.25 },
      { op: "set_gap", blockId: id, gapIndex: 99, seconds: 1 },
    ]),
  );
  assert.equal(JSON.stringify(draft), original);
});
it("proposal facts include removed blocks, position and spacing; final-block spacing is not an effective edit", () => {
  const draft = createDraft("dswp-1"),
    id = draft.blocks[0].id;
  assert.throws(
    () =>
      applyOperations(draft, [{ op: "set_spacing", blockId: id, seconds: 1 }]),
    /final block/,
  );
  const pair = applyOperations(draft, [
    { op: "duplicate_block", blockId: id, newBlockId: "copy" },
  ]);
  const removed = applyOperations(pair, [{ op: "remove_block", blockId: id }]);
  const facts = beforeAfter(pair, removed);
  assert.equal(facts[0].afterSpan, null);
  assert.equal(facts[0].afterPosition, null);
  assert.equal(facts[1].beforePosition, 2);
  assert.equal(facts[1].afterPosition, 1);
});
it("phrase/marker limits, no-op round trips and original source versions are enforced", () => {
  const draft = createDraft("dswp-1"),
    id = draft.blocks[0].id;
  assert.throws(() =>
    parseDraft({
      ...draft,
      blocks: [
        {
          ...draft.blocks[0],
          times: Array.from({ length: 13 }, (_, i) => i / 10),
        },
      ],
    }),
  );
  const ops: Operation[] = [1, 2, 3].map((i) => ({
    op: "duplicate_block",
    blockId: id,
    newBlockId: `dup${i}`,
  }));
  const pair = applyOperations(draft, ops);
  pair.blocks.forEach((b) => (b.times = [0, 5, 10]));
  assert.throws(() => parseDraft(pair), /30 seconds/);
  assert.throws(
    () =>
      applyOperations(draft, [
        { op: "duplicate_block", blockId: id, newBlockId: "copy" },
        { op: "remove_block", blockId: "copy" },
      ]),
    /no change/,
  );
  const forged = structuredClone(draft);
  forged.blocks[0].seed.originalOffsetSeconds = 0;
  assert.throws(() => parseDraft(forged), /Source reference/);
});
it("project round trips retain creator labels, source credits, offsets and inert historical analysis", () => {
  const draft = createDraft("dswp-1");
  draft.title = "A greeting I made";
  draft.intention = "A human intention";
  draft.blocks[0].meaning =
    "<img src=https://untrusted.invalid onerror=evil()>";
  const saved = projectJson(draft, [draft.blocks[0]], {
    status: "completed",
    execution: "provider",
    forged: "not trusted",
  });
  const restored = parseProject(saved);
  assert.deepEqual(restored.draft, draft);
  assert.equal(restored.codebook[0].meaning, draft.blocks[0].meaning);
  assert.match(saved, /synthetic timing sonification/);
  assert.match(saved, /CC BY 4.0/);
  assert.match(saved, /Meaning to sperm whales: unknown/);
  assert.equal(
    sourceCredits(restored.draft!)[0].originalOffsetSeconds,
    draft.blocks[0].seed.originalOffsetSeconds,
  );
  const forged = JSON.parse(saved);
  forged.credits = { url: "https://untrusted.invalid", identity: "observed" };
  assert.doesNotMatch(
    JSON.stringify(parseProject(JSON.stringify(forged)).credits),
    /untrusted.invalid|observed/,
  );
  assert.throws(
    () => parseProject("x".repeat(COMPOSER_LIMITS.projectBytes + 1)),
    /128 KiB/,
  );
  assert.throws(() =>
    parseProject(
      JSON.stringify({ ...JSON.parse(saved), url: "https://bad.invalid" }),
    ),
  );
  assert.throws(() =>
    parseProject(JSON.stringify({ ...JSON.parse(saved), version: 999 })),
  );
  let nested: unknown = null;
  for (let i = 0; i < 30; i++) nested = [nested];
  assert.throws(
    () =>
      parseProject(
        JSON.stringify({ ...JSON.parse(saved), savedAnalysis: nested }),
      ),
    /too complex/,
  );
});
it("playback PCM and WAV share exact event placement, duration, gain and source metadata", () => {
  const draft = createDraft("dswp-1");
  draft.blocks = [seedBlock("dswp-1", "first")];
  const { samples, schedule } = renderSamples(draft),
    bytes = wavBytes(draft),
    view = new DataView(bytes);
  assert.equal(view.getUint32(24, true), 48000);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(40, true), samples.length * 2);
  assert.equal(samples.length, Math.ceil(schedule.duration * 48000));
  for (let i = 0; i < samples.length; i++) {
    assert.ok(Math.abs(samples[i]) <= RENDERER.gain);
    assert.equal(
      view.getInt16(44 + i * 2, true),
      Math.round(samples[i] * 32767) || 0,
    );
  }
  for (const event of schedule.events) {
    const frame = Math.round(event.seconds * 48000);
    assert.equal(samples[frame - 1], 0);
    assert.equal(samples[frame], 0);
    assert.ok(samples.slice(frame, frame + 576).some((v) => v !== 0));
  }
  assert.ok(
    samples
      .slice(0, Math.round(RENDERER.leadSeconds * 48000))
      .every((v) => v === 0),
  );
  assert.match(
    new TextDecoder().decode(bytes.slice(44 + samples.length * 2)),
    /synthetic timing sonification/,
  );
});
