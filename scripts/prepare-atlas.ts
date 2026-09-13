import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { parseAnnotations } from "../src/lab/parse.ts";
import { ATLAS_METHOD, ATLAS_LIMITATIONS, SOURCE_RELEASE, SOURCE_SHA256 } from "../src/atlas/method.ts";
import { atlasRecord, catalogSummary, type AtlasReport, type AtlasSummary } from "../src/atlas/model.ts";

const check = process.argv.includes("--check");
const hash = (v: string | Buffer) => createHash("sha256").update(v).digest("hex");
const json = (v: unknown) => JSON.stringify(v) + "\n";
const file = (path: string) => { const b = readFileSync(path); return { path, bytes: b.length, sha256: hash(b) }; };
const csv = readFileSync("data/context/sperm-whale-dialogues.csv"), sourceRecord = JSON.parse(readFileSync("data/context/source-record.json", "utf8"));
assert.equal(hash(csv), SOURCE_SHA256);
assert.equal(sourceRecord.releaseCommit, SOURCE_RELEASE);
const parsed = parseAnnotations(csv.toString("utf8"));
assert.deepEqual([parsed.audit.sourceRows, parsed.calls.length, parsed.excluded.length], [3840, 3790, 50]);
const records = parsed.calls.map(atlasRecord), description = catalogSummary(records, parsed.excluded.length);
const producerFiles = ["src/atlas/method.ts", "src/atlas/model.ts", "src/domain/timing.ts", "src/lab/parse.ts", "src/lab/model.ts", "scripts/prepare-atlas.ts"].map(file);
const methodSha256 = hash(json(producerFiles));
const report: AtlasReport = {
  schema: "codabridge-style-atlas-v1", atlasVersion: "1.0.0", sourceSha256: SOURCE_SHA256, sourceRecord, methodSha256, method: ATLAS_METHOD,
  provenance: { base: "d50c3a7050f40823e56fd050f2a4e64277d8c96f", producerFiles, sourceRecordSha256: file("data/context/source-record.json").sha256 },
  limitations: ATLAS_LIMITATIONS, ...description, records, exclusions: parsed.excluded,
};
const reportBytes = json(report), reportIdentity = { path: "/style-atlas-v1/atlas.json", bytes: Buffer.byteLength(reportBytes), sha256: hash(reportBytes) };
const summary: AtlasSummary = { schema: "codabridge-style-atlas-summary-v1", atlasVersion: "1.0.0", sourceSha256: SOURCE_SHA256, methodSha256, ...description, report: reportIdentity };
const summaryBytes = json(summary);
assert(reportIdentity.bytes <= ATLAS_METHOD.byteLimits.report);
assert(Buffer.byteLength(summaryBytes) <= ATLAS_METHOD.byteLimits.summary);
const outputs = new Map([
  ["analysis/style-atlas-v1/method.json", json({ method: ATLAS_METHOD, methodSha256, producerFiles })],
  ["public/style-atlas-v1/atlas.json", reportBytes],
  ["public/style-atlas-v1/summary.json", summaryBytes],
  ["src/atlas/manifest.json", json({ version: "1.0.0", sourceSha256: SOURCE_SHA256, methodSha256,
    summary: { path: "/style-atlas-v1/summary.json", bytes: Buffer.byteLength(summaryBytes), sha256: hash(summaryBytes) }, report: reportIdentity })],
]);
// Preflight the entire output set before writing anything. --check never writes.
for (const [path, bytes] of outputs) {
  if (check) assert.equal(readFileSync(path, "utf8"), bytes, `${path}: deterministic reproduction mismatch`);
  else if (existsSync(path)) assert.equal(readFileSync(path, "utf8"), bytes, `${path}: refuses to overwrite a different artifact`);
}
if (!check) for (const [path, bytes] of outputs) { if (!existsSync(path)) { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, bytes, { flag: "wx" }); } }
console.log(JSON.stringify({ action: check ? "non-overwriting reproduction passed" : "derived complete source", methodSha256, ...description.accounting, ...description.support, report: reportIdentity, summaryBytes: Buffer.byteLength(summaryBytes) }, null, 2));
console.table(description.groups.map(g => ({ clicks: g.clickCount, records: g.records, REC: g.recs, prefixes: g.prefixes, roots: g.roots, largestRootShare: g.largestRootShare, sparse: g.sparse })));
