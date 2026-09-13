import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildCohort, featureDefinitions, splitManifest } from "../analysis/dialogue-transfer/cohort.ts";
const root = "analysis/dialogue-transfer/";
const config = JSON.parse(readFileSync(root + "protocol.json", "utf8"));
const csv = readFileSync("data/context/sperm-whale-dialogues.csv");
const sha = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
if (sha(csv) !== config.sourceSha256) throw new Error("Pinned annotation bytes changed.");
const { validated, examples, audit } = buildCohort(csv.toString("utf8"), config);
const manifest = splitManifest(examples);
mkdirSync(root + "inputs", { recursive: true });
for (const [file, value] of Object.entries({ "inputs/validated.json": validated, "inputs/cohort.json": { version: "cohort-v1", examples }, "eligibility-audit.json": audit, "split-manifest.json": manifest, "features-v1.json": featureDefinitions })) {
  const bytes = JSON.stringify(value) + "\n";
  if (process.argv.includes("--check")) {
    if (readFileSync(root + file, "utf8") !== bytes) throw new Error(`Prediction derivation changed: ${file}`);
  } else writeFileSync(root + file, bytes);
}
console.log(JSON.stringify({ status: "data-only-no-scores", rows: audit.sourceRows, valid: audit.validRows, roots: audit.sixCharacterRoots, eligibleExamples: examples.length, eligibleRec: audit.eligibleRecGroups, eligibleGroups: audit.eligibleParentGroups, beforeLag: audit.beforeLagRequirement, lagCost: audit.lagRequirementCost, barriers: audit.barriers.length, gapsOver60: audit.gaps.filter(g => g.barrier).length, duplicates: audit.duplicateEvents.length, crossFragmentOverlaps: audit.crossFragmentOverlaps.length, exclusions: audit.exclusionCounts, folds: manifest.folds }));
