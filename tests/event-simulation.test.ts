import test from "node:test";
import assert from "node:assert/strict";
import { generate, prepare, protocol, serialize } from "../analysis/event-simulation-v1/generator.ts";
import { parseAnnotations } from "../src/lab/parse.ts";
test("event generator mechanisms have explicit lag and no common-driver direct edge", () => {
  for (const family of ["independent", "common-driver", "directed"] as const) {
    const g = generate(family, "clean", protocol.seedStart);
    for (const e of g.truth) {
      const expected = family === "common-driver" ? .55 * e.previousSelf + .45 * e.driver + e.innovation : family === "directed" && e.caller === 2 ? .35 * e.previousSelf + .65 * e.parentLogDuration! + e.innovation : .7 * e.previousSelf + e.innovation;
      assert.ok(Math.abs(expected - Math.log(e.clicks.at(-1)!)) < 1e-14);
      if (family !== "directed" || e.caller !== 2) assert.equal(e.parentLogDuration, null);
    }
    const b = g.truth.find(e => e.id === "0:1:2")!, a = g.truth.find(e => e.id === "0:0:1")!;
    if (family === "directed") { assert.equal(b.parentLogDuration, a.logDuration); assert.equal(b.emission - a.emission, 9); }
    const p = prepare(g.csv); assert.equal(p.split.folds, 5); assert.equal(Object.keys(p.split.assignments).length, 10); assert.ok(p.rows.length > 400);
    assert.ok(p.rows.every(r => Object.keys(r.features).join() === "M1,M2"));
  }
});
test("observation variants retain identical latent truth and change actual parsing/eligibility", () => {
  const clean = generate("directed", "clean", protocol.seedStart);
  for (const variant of ["missed-clicks", "missed-codas", "arrival-jitter", "boundaries"] as const) {
    const g = generate("directed", variant, protocol.seedStart); assert.deepEqual(g.truth, clean.truth); assert.notEqual(g.csv, clean.csv);
    const parsed = parseAnnotations(g.csv); assert.equal(parsed.excluded.length, 0);
    if (variant === "missed-clicks") assert.ok(parsed.calls.some(c => c.clicks.length === 2));
    if (variant === "missed-codas" || variant === "boundaries") assert.ok(prepare(g.csv).rows.length < prepare(clean.csv).rows.length);
  }
});
test("future/target changes do not enter predictors; invalid barriers are exercised", () => {
  const g = generate("directed", "clean", protocol.seedStart); const p = prepare(g.csv);
  const fixed = p.rows[10], built = parseAnnotations(g.csv); const current = built.calls.find(c => c.sourceLine === fixed.currentRow)!;
  const changed = g.observed.map(e => e.rec === current.rec && e.arrival > current.onset + current.duration ? { ...e, clicks: e.clicks.map(x => x * 1.1) } : e);
  const q = prepare(serialize(changed)); assert.deepEqual(q.rows.find(r => r.id === fixed.id)!.features, fixed.features);
  const bad = g.observed.map((e, i) => i === 20 ? { ...e, clicks: [0] } : e);
  const barrier = prepare(serialize(bad)); assert.ok(barrier.audit.invalidRows > 0); assert.ok(barrier.audit.barriers > 0);
});
