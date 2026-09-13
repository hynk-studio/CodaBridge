import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { buildResearchCohorts, featureDefinitions } from "../analysis/dialogue-transfer-v02/cohort.ts";
const root = "analysis/dialogue-transfer-v02/", read = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const csv = readFileSync("data/context/sperm-whale-dialogues.csv");
assert.equal(createHash("sha256").update(csv).digest("hex"), read(root + "protocol.json").sourceSha256);
const result = buildResearchCohorts(csv.toString());
assert.deepEqual(result.original.examples, read("analysis/dialogue-transfer/inputs/cohort.json").examples);
assert.deepEqual(result.coreSplit, read("analysis/dialogue-transfer/split-manifest.json"));
assert.deepEqual(result.original.validated, read("analysis/dialogue-transfer/inputs/validated.json"));
assert.deepEqual(featureDefinitions, read("analysis/dialogue-transfer/features-v1.json"));
for (const [path, value] of Object.entries({ "inputs/core.json":result.core,"inputs/coverage.json":result.coverage,"core-split.json":result.coreSplit,"coverage-split.json":result.coverageSplit,"eligibility-audit.json":result.audit,"features.json":featureDefinitions })) {
 const bytes = JSON.stringify(value)+"\n";
 if(process.argv.includes("--check")) assert.equal(readFileSync(root+path,"utf8"),bytes,path); else writeFileSync(root+path,bytes);
}
console.log(JSON.stringify({status:"DATA ONLY; NO NEW SCORES",core:result.audit.core,coverage:result.audit.coverage,added:result.audit.addedIds.length,newRoots:result.coverageSplit.appendedGroups}));
