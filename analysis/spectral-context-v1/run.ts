import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { SOURCES, sourceUrl } from "../../src/spectral/contract.ts";
import { joinTables, summarize } from "../../src/spectral/model.ts";
const cache = "data/raw/spectral-context-v1/", root = "analysis/spectral-context-v1/";
mkdirSync(cache, { recursive: true });
const failures: string[] = [], texts: string[] = [];
for (const source of SOURCES) {
  try {
    const path = cache + source.path;
    if (!existsSync(path) && process.argv.includes("--fetch")) {
      const response = await fetch(sourceUrl(source), { redirect: "error", signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = Buffer.from(await response.arrayBuffer());
      if (data.length !== source.bytes || createHash("sha256").update(data).digest("hex") !== source.sha256) throw new Error("download byte identity mismatch");
      writeFileSync(path, data, { flag: "wx" });
    }
    const data = readFileSync(path);
    if (data.length !== source.bytes || createHash("sha256").update(data).digest("hex") !== source.sha256 || createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex") !== source.gitBlob) throw new Error("byte identity mismatch");
    texts.push(data.toString("utf8"));
  } catch (error) { failures.push(`${source.id}: ${error instanceof Error ? error.message : "unavailable"}`); }
}
if (failures.length) {
  // Never leave a stale successful local report beside failed inputs.
  writeFileSync(cache + "join-report.json", JSON.stringify({ status: "blocked", failures, rows: [] }, null, 2) + "\n");
  throw new Error(failures.join("; "));
}
const report = joinTables(texts[0], texts[1]);
writeFileSync(cache + "join-report.json", JSON.stringify(report, null, 2) + "\n");
const { rows, ...metadata } = report;
const summary = JSON.stringify({ ...metadata, summary: summarize(rows) }, null, 2) + "\n";
if (report.status !== "verified") throw new Error("Integration blocked; inspect the local join-report.json.");
if (process.argv.includes("--check")) {
  if (readFileSync(root + "verification.json", "utf8") !== summary) throw new Error("Committed verification differs.");
} else writeFileSync(root + "verification.json", summary);
console.log(JSON.stringify({ status: report.status, ...report.counts, summary: summarize(rows) }));
