import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { audit } from "./audit.ts";
import { ROOT, checkPreservation, loadSources, readJson, sha256 } from "./io.ts";

const check = process.argv.includes("--check"), preservation = checkPreservation();
const original = readFileSync("data/context/sperm-whale-dialogues.csv", "utf8");
assert.equal(sha256(original), readJson(ROOT + "protocol.json").sourceSha256);
const core = readJson("analysis/dialogue-transfer-v02/inputs/core.json"), coverage = readJson("analysis/dialogue-transfer-v02/inputs/coverage.json");
assert.equal(core.length, 723); assert.equal(coverage.length, 1017);
const old = readJson("analysis/dialogue-transfer/inputs/cohort.json").examples;
assert.deepEqual(core.map((e: { id: string }) => e.id), old.map((e: { id: string }) => e.id));
const result = audit(original, loadSources(), { core, coverage }, readJson("analysis/dialogue-transfer-v02/coverage-split.json").assignments);
const producerFiles = ["audit.ts", "ceti.ts", "csv.ts", "dates.ts", "io.ts", "maor.ts", "precision.ts", "run.ts", "protocol.json", "retrieval-manifest.json", "preservation-manifest.json"];
const provenance = { originalSha256: sha256(original), preservation, producerFiles: producerFiles.map(path => ({ path: ROOT + path, sha256: sha256(readFileSync(ROOT + path)) })),
  cohortFiles: ["analysis/dialogue-transfer-v02/inputs/core.json", "analysis/dialogue-transfer-v02/inputs/coverage.json", "analysis/dialogue-transfer-v02/coverage-split.json"].map(path => ({ path, sha256: sha256(readFileSync(path)) })),
  execution: "Full pinned files, no fitting, no downloaded code execution; external CSVs remain in ignored cache" };
const outputs = { "candidate-mapping.json": result.mapping, "coverage.json": result.coverage, "report.json": { ...result.summary, provenance } };
for (const [name, value] of Object.entries(outputs)) {
  const path = ROOT + "results/" + name, bytes = JSON.stringify(value) + "\n";
  if (check) assert.equal(readFileSync(path, "utf8"), bytes, `Reproduction mismatch: ${name}`);
  else { assert.ok(!existsSync(path), `Refusing overwrite: ${path}; use --check`); writeFileSync(path, bytes, { flag: "wx" }); }
}
console.log(JSON.stringify({ status: check ? "Exact deterministic reproduction passed; no outputs overwritten" : "Full-file audit completed", preservation, maor: result.summary.maor,
  ceti: { ...result.summary.ceti, candidateConflicts: result.summary.ceti.candidateConflicts.length }, rawCoverage: result.summary.rawCoverage,
  cohortStatuses: Object.fromEntries(Object.entries(result.summary.cohorts).map(([k, v]) => [k, v.exampleStatus])) }, null, 2));
