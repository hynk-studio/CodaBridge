import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { validateAtlas, validateSummary } from "../src/atlas/load.ts";
import { nearestReferences, timingFromClicks } from "../src/atlas/model.ts";
const summary = validateSummary(JSON.parse(readFileSync("public/style-atlas-v1/summary.json", "utf8")));
const atlas = validateAtlas(JSON.parse(readFileSync("public/style-atlas-v1/atlas.json", "utf8")), summary);
// Deterministic probes: first actual row at every supported count, its scaled
// timing, and a hand-changed shape. Python recomputes every candidate independently.
const probes = atlas.groups.filter(g => g.records).flatMap(g => {
  const row = atlas.records.find(r => r.features.clickCount === g.clickCount)!;
  return [row.clicks, row.clicks.map(t => t * 1.25)];
}).concat([[0, .1, .3, .7, 1.2, 1.3]]).map(times => ({ times, nearest: nearestReferences(timingFromClicks(times), atlas.records) }));
const result = spawnSync("python3", ["analysis/style-atlas-v1/verify.py"], { input: JSON.stringify(probes), encoding: "utf8", maxBuffer: 1024 * 1024 });
process.stdout.write(result.stdout); process.stderr.write(result.stderr);
assert.equal(result.status, 0, "Independent Atlas verification failed");
