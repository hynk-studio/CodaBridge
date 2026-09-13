// Independent saved-artifact verification: no Python, estimator or fitting imports.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const root = "analysis/dialogue-transfer/";
const read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const sha = (v: Buffer) => createHash("sha256").update(v).digest("hex");
const report = read(root + "results/report.json"), cohort = read(root + "inputs/cohort.json").examples, split = read(root + "split-manifest.json"), calls = new Map<number, any>(read(root + "inputs/validated.json").calls.map((c: any) => [c.sourceLine, c]));
const models = ["M0", "M1", "M2", "M2-lagged"];
const contrasts = ["M2_vs_M1", "M2-lagged_vs_M1", "M2_vs_M2-lagged"];
const near = (a: number, b: number) => assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-8 + 1e-7 * Math.abs(b), `${a} differs from ${b}`);
const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;
const quantile = (v: number[], q: number) => { const a = [...v].sort((a, b) => a - b), index = (a.length - 1) * q, lo = Math.floor(index); return a[lo] + (a[Math.ceil(index)] - a[lo]) * (index - lo); };
const category = (d: number, edges: number[]) => d <= edges[0] ? 0 : d <= edges[1] ? 1 : 2;
const records = report.records as any[];
for (const [path, hash] of Object.entries(report.provenance.hashes)) {
  assert.equal(sha(readFileSync(path)), hash, `Input changed: ${path}`);
  assert.equal(sha(execFileSync("git", ["show", `${report.provenance.producerCommit}:${path}`], { maxBuffer: 16 * 1024 * 1024 })), hash, `Producer mismatch: ${path}`);
}
assert.equal(execFileSync("git", ["rev-parse", `${report.provenance.producerCommit}^{tree}`], { encoding: "utf8" }).trim(), report.provenance.producerTree);
execFileSync("git", ["merge-base", "--is-ancestor", report.provenance.freezeCommit, report.provenance.producerCommit]);
for (const file of ["protocol.json", "features-v1.json", "split-manifest.json", "inputs/cohort.json", "inputs/validated.json"])
  assert.equal(sha(execFileSync("git", ["show", `${report.provenance.freezeCommit}:${root}${file}`], { maxBuffer: 16 * 1024 * 1024 })), sha(readFileSync(root + file)));
assert.deepEqual(report.split, split);
assert.deepEqual(readFileSync(root + "results/report.json"), readFileSync("public/prediction/dialogue-transfer-report.json"));
const summary = read("public/prediction/summary.json");
assert.equal(summary.report.sha256, sha(readFileSync(root + "results/report.json")));
assert.equal(summary.report.bytes, readFileSync(root + "results/report.json").byteLength);
assert.ok(summary.report.bytes < 8 * 1024 * 1024);
assert.ok(readFileSync("public/prediction/summary.json").byteLength < 256 * 1024);
assert.deepEqual(summary.metrics, report.metrics);
assert.deepEqual(summary.selectedExamples, report.selectedExamples);
assert.deepEqual(summary.status, report.status);
if (report.status !== "completed") {
  assert.ok(report.failures.length); assert.equal(report.metrics, null); assert.equal(report.bootstrap, null); assert.deepEqual(records, []); assert.deepEqual(report.selectedExamples, []);
  console.log("Verified honest unavailable state; no primary estimate.");
} else {
  assert.equal(new Set(records.map(r => r.id)).size, cohort.length);
  assert.deepEqual(records.map(r => r.id), cohort.map((e: any) => e.id));
  assert.deepEqual(report.selectedExamples.map((e: any) => e.record.id), split.selectedExamples);
  const internals = read(root + "results/fold-fits.json");
  for (const fold of report.folds) {
    const train = cohort.filter((e: any) => split.assignments[e.parentGroup] !== fold.fold), test = cohort.filter((e: any) => split.assignments[e.parentGroup] === fold.fold);
    const trainGroups = [...new Set(train.map((e: any) => e.parentGroup))].sort();
    assert.deepEqual(fold.trainingGroups, trainGroups);
    assert.deepEqual(fold.testGroups, [...new Set(test.map((e: any) => e.parentGroup))].sort());
    assert.ok(fold.testGroups.every((g: string) => !trainGroups.includes(g)));
    assert.equal(train.length, fold.trainingCount); assert.equal(test.length, fold.testCount);
    const edges = [quantile(train.map((e: any) => e.targetDuration), 1 / 3), quantile(train.map((e: any) => e.targetDuration), 2 / 3)];
    edges.forEach((edge, i) => near(edge, fold.edges[i]));
    const counts = [0, 0, 0]; train.forEach((e: any) => counts[category(e.targetDuration, edges)]++);
    assert.deepEqual(counts, fold.trainClassCounts);
    const details = internals.find((f: any) => f.fold === fold.fold);
    for (const model of models.slice(1)) {
      const d = details.models[model];
      assert.deepEqual(d.trainingIds, train.map((e: any) => e.id)); assert.deepEqual(d.testIds, test.map((e: any) => e.id));
      for (let j = 0; j < train[0].features[model].length; j++) {
        const available = train.map((e: any) => e.features[model][j]).filter((x: any) => x !== null), median = available.length ? quantile(available, .5) : 0;
        near(d.imputer[j], median);
        const filled = train.map((e: any) => e.features[model][j] ?? median), average = mean(filled), sd = Math.sqrt(mean(filled.map((x: number) => (x - average) ** 2)));
        near(d.mean[j], average); near(d.scale[j], sd < 1e-12 ? 1 : sd);
      }
    }
    for (const r of records.filter(r => r.fold === fold.fold)) r.predictions.M0.raw.forEach((p: number, i: number) => near(p, counts[i] / train.length));
  }
  const independent = new Map<string, { loss: Record<string, number>; gain: Record<string, number> }>();
  for (let i = 0; i < records.length; i++) {
    const r = records[i], e = cohort[i];
    for (const [key, value] of Object.entries(e)) if (key !== "features") assert.deepEqual(r[key], value);
    assert.equal(r.fold, split.assignments[r.parentGroup]);
    assert.equal(r.category, category(calls.get(r.targetRow).duration, r.edges));
    const current = calls.get(r.currentRow), target = calls.get(r.targetRow);
    near(r.cutoff, current.onset + current.duration);
    assert.ok(target.onset > r.cutoff);
    const checkBinding = (bound: any) => { const c = calls.get(bound.sourceLine); assert.equal(c.rec, r.rec); assert.equal(c.caller, bound.caller); near(c.onset, bound.onset); near(c.onset + c.duration, bound.end); near(c.duration, bound.duration); assert.equal(c.clicks.length, bound.clickCount); };
    checkBinding(r.sourceBindings.current); checkBinding(r.sourceBindings.target);
    for (const kind of ["self", "recent", "lagged"]) for (const bound of r.sourceBindings[kind]) { checkBinding(bound); assert.ok(bound.end <= r.cutoff); }
    assert.deepEqual(r.laggedRows, r.completedPartnerRows.slice(-4, -2).reverse());
    for (const kind of ["recent", "lagged"]) r.sourceBindings[kind].forEach((b: any, j: number) => near(r[`${kind}Ages`][j], r.cutoff - b.end));
    const loss: Record<string, number> = {}, gain: Record<string, number> = {};
    for (const m of models) {
      const p = r.predictions[m]; assert.equal(p.raw.length, 3); p.raw.forEach((n: number) => assert.ok(Number.isFinite(n) && n >= 0 && n <= 1)); near(p.raw.reduce((a: number, b: number) => a + b, 0), 1);
      const floor = p.raw.map((n: number) => Math.max(n, 1e-12)), total = floor.reduce((s: number, n: number) => s + n, 0), scored = floor.map((n: number) => n / total);
      scored.forEach((n: number, j: number) => near(p.scoring[j], n));
      assert.equal(p.clippedClasses, p.raw.filter((n: number) => n < 1e-12).length);
      loss[m] = -Math.log(scored[r.category]) / Math.log(2); near(p.logLossBits, loss[m]);
    }
    for (const key of contrasts) { const [a, b] = key.split("_vs_"); gain[key] = loss[b] - loss[a]; near(r.gainBits[key], gain[key]); }
    independent.set(r.id, { loss, gain });
  }
  for (const m of models) {
    near(report.metrics.logLossBits[m], mean(records.map(r => independent.get(r.id)!.loss[m])));
    assert.equal(report.metrics.clipping[m].classes, records.reduce((s, r) => s + r.predictions[m].clippedClasses, 0));
    assert.equal(report.metrics.clipping[m].rows, records.filter(r => r.predictions[m].clippedClasses > 0).length);
  }
  const count = [0, 0, 0]; records.forEach(r => count[r.category]++); assert.deepEqual(count, report.metrics.classCounts);
  for (const key of contrasts) {
    near(report.metrics.gainBits[key], mean(records.map(r => independent.get(r.id)!.gain[key])));
    for (const group of report.metrics.perGroup) {
      const rows = records.filter(r => r.parentGroup === group.parentGroup);
      assert.equal(rows.length, group.n);
      near(group.gainBits[key], mean(rows.map(r => independent.get(r.id)!.gain[key])));
      for (const m of models) near(group.logLossBits[m], mean(rows.map(r => independent.get(r.id)!.loss[m])));
    }
    near(report.metrics.groupMacroGainBits[key], mean(report.metrics.perGroup.map((g: any) => g.gainBits[key])));
    const b = report.bootstrap, pooled: number[] = [], macro: number[] = [];
    assert.equal(b.draws.length, 2000); assert.equal(b.seed, 20260913); assert.deepEqual(b.groups, Object.keys(split.assignments).sort());
    for (const draw of b.draws) {
      assert.equal(draw.length, b.groups.length);
      let n = 0, total = 0; const groupMeans: number[] = [];
      for (const index of draw) {
        assert.ok(Number.isInteger(index) && index >= 0 && index < b.groups.length);
        const rows = records.filter(r => r.parentGroup === b.groups[index]), values = rows.map(r => independent.get(r.id)!.gain[key]);
        n += rows.length; total += values.reduce((s, v) => s + v, 0); groupMeans.push(mean(values));
      }
      pooled.push(total / n); macro.push(mean(groupMeans));
    }
    for (const [kind, values] of [["pooled", pooled], ["groupMacro", macro]] as const) [.025, .975].forEach((q, j) => near(b.intervals[key][kind][j], quantile(values, q)));
  }
  console.log(JSON.stringify({ status: "INDEPENDENT VERIFICATION PASS", examples: records.length, groups: report.metrics.perGroup.length, folds: report.folds.length, checks: "source/producer/freeze hashes; exact OOF support; train-only bins/imputation/scaling; original donor bindings; raw/floored probabilities; base-2 losses; paired gains; clipping; 2000 paired group-bootstrap draws and percentile weighting; delivered summary/report bytes" }));
}
