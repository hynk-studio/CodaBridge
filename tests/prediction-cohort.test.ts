import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseAnnotations } from "../src/lab/parse.ts";
import { afterCutoff, beforeCutoff, buildCohort, end, prefixFeatures, splitManifest } from "../analysis/dialogue-transfer/cohort.ts";
const config = { maxGapSeconds: 60, parentPrefixLength: 6 };
const source = readFileSync("data/context/sperm-whale-dialogues.csv", "utf8");
const header = source.split("\n")[0];
function row(onset: number, caller: number, duration = 1, rec = "testAA001_1", clicks = 3) {
  return [rec, clicks, duration.toFixed(6), ...Array.from({ length: 28 }, (_, i) => i < clicks - 1 ? (duration / (clicks - 1)).toFixed(6) : "0"), caller, onset.toFixed(6)].join(",");
}
const csv = (rows: string[]) => header + "\n" + rows.join("\n") + "\n";
const history = () => Array.from({ length: 16 }, (_, i) => row(i * 3, i % 2 + 1));
test("full source uses parseAnnotations parity, original hash and whole long codas", () => {
  assert.equal(createHash("sha256").update(source).digest("hex"), "1856c8bf915cc5ae6f928aaa2036cbbc6ad8840bb6e4f6a96aaeb96953215da2");
  const built = buildCohort(source, config), parsed = parseAnnotations(source);
  assert.deepEqual(built.validated.calls, parsed.calls);
  assert.deepEqual(built.validated.excluded, parsed.excluded);
  assert.equal(built.validated.rawRows.length, 3840);
  assert.equal(parsed.calls.length, 3790);
  assert.equal(built.audit.longValidCodas, 124);
  for (const c of parsed.calls) assert.equal(c.clicks.length, Number(c.raw.nClicks));
  assert.equal(built.examples.length, 723);
  const selected = new Set(built.examples.flatMap(e => [...e.selfRows, ...e.recentRows, ...e.laggedRows, e.targetRow]));
  assert.ok(parsed.calls.some(c => selected.has(c.sourceLine) && c.clicks.length > 12));
});
test("invalid next focal is a barrier, never skipped to a later valid target", () => {
  const lines = history(); lines[10] = row(30, 1, -1);
  const built = buildCohort(csv(lines), config);
  assert.ok(built.audit.exclusions.some(e => e.currentRow === 10 && e.nextFocalRow === 12 && e.reason === "NEXT_FOCAL_REJECTED"));
  assert.ok(!built.examples.some(e => e.currentRow === 10));
  assert.ok(built.examples.every(e => !(e.currentRow < 12 && e.targetRow > 12)));
});
test("unknown onset/caller, same-caller overlap, duplicate, and 60-second gaps break continuity", () => {
  for (const replacement of [row(30, 0), row(30, 1).replace("30.000000", "unknown")]) {
    const lines = history(); lines[10] = replacement;
    assert.equal(buildCohort(csv(lines), config).examples.length, 0);
  }
  const gap = [...history().slice(0, 10), ...history().slice(10).map((_, i) => row(150 + i * 3, i % 2 + 1))];
  const built = buildCohort(csv(gap), config);
  assert.equal(built.audit.gaps.filter(g => g.barrier).length, 1);
  assert.ok(!built.examples.some(e => e.currentRow < 12 && e.targetRow >= 12));
  const overlap = history(); overlap[10] = row(24.5, 1);
  assert.ok(buildCohort(csv(overlap), config).audit.barriers.some(b => b.reason === "AMBIGUOUS_OR_REPEATED_EVENT"));
  const dup = history(); dup.push(dup[10]);
  assert.ok(buildCohort(csv(dup), config).audit.barriers.some(b => b.reason.includes("EXACT_DUPLICATE")));
  dup[dup.length - 1] = dup.at(-1)!.replace("30.000000", "30.0000000");
  assert.ok(buildCohort(csv(dup), config).audit.duplicateEvents.length > 0);
});
test("features exclude unfinished/future context, obey precision cutoff and retain actual lag timestamps", () => {
  const parsed = parseAnnotations(csv(history())), current = parsed.calls[12];
  const features = prefixFeatures(current, parsed.calls);
  assert.deepEqual(features.recentRows, [13, 11]);
  assert.deepEqual(features.laggedRows, [9, 7]);
  assert.ok(features.laggedAges.every(age => age > Math.max(...features.recentAges)));
  const future = structuredClone(parsed.calls);
  for (const c of future) if (c.onset > end(current)) { c.duration *= 20; c.clicks = [0, c.duration]; c.raw.ICI1 = c.duration.toFixed(6); }
  assert.deepEqual(prefixFeatures(current, future), features);
  const unfinished = parseAnnotations(csv([row(35.5, 2, 20)] )).calls[0]; unfinished.id = "unfinished";
  assert.deepEqual(prefixFeatures(current, [...parsed.calls, unfinished]), features);
  const changedPast = structuredClone(parsed.calls); changedPast[11].duration *= 1.1;
  assert.notDeepEqual(prefixFeatures(current, changedPast).features.M2, features.features.M2);
  const touching = parseAnnotations(csv([row(end(current), 1)])).calls[0];
  assert.equal(afterCutoff(touching, current), false);
  const almost = { ...touching, onset: end(current) + 1e-7 };
  assert.equal(afterCutoff(almost, current), false);
  assert.equal(beforeCutoff({ ...current, id: "other" }, current), false);
});
test("target eligibility is separate from fixed prefix features and REC-local identity", () => {
  const lines = history(), calls = parseAnnotations(csv(lines)).calls, current = calls[10];
  const before = prefixFeatures(current, calls);
  lines[12] = row(36, 1, -1); // invalidating a target may remove the example, never alter its predictors
  const changed = parseAnnotations(csv(lines));
  assert.deepEqual(prefixFeatures(current, changed.calls), before);
  assert.ok(!buildCohort(csv(lines), config).examples.some(e => e.currentRow === current.sourceLine));
  assert.deepEqual(prefixFeatures(current, [...calls, ...calls.map(c => ({ ...c, rec: "testAA002_1", id: c.id + "copy" }))]), before);
});
test("all four models have one donor-eligible cohort and all shared source roots stay in a single fold", () => {
  const built = buildCohort(source, config), split = splitManifest(built.examples);
  assert.equal(split.folds, 5); assert.equal(Object.keys(split.assignments).length, 19);
  assert.equal(built.audit.beforeLagRequirement - built.audit.lagRequirementCost, built.examples.length);
  for (const e of built.examples) {
    assert.equal(e.features.M1.length, 17); assert.equal(e.features.M2?.length, 34); assert.equal(e.features["M2-lagged"]?.length, 34);
    assert.equal(e.recentRows.length, 2); assert.equal(e.laggedRows.length, 2);
    assert.equal(new Set([...e.recentRows, ...e.laggedRows]).size, 4);
    assert.deepEqual([...e.completedPartnerRows].slice(-4, -2).reverse(), e.laggedRows);
  }
  for (const fold of [0, 1, 2, 3, 4]) {
    const train = new Set(split.examples.filter(e => e.fold !== fold).map(e => e.parentGroup));
    assert.ok(split.examples.filter(e => e.fold === fold).every(e => !train.has(e.parentGroup)));
  }
  const targetChanged = built.examples.map(e => ({ ...e, targetDuration: e.targetDuration * 1000 }));
  assert.deepEqual(splitManifest(targetChanged), split);
  assert.equal(splitManifest(built.examples.filter(e => e.parentGroup === built.examples[0].parentGroup)).status, "insufficient-data");
});
