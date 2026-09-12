import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseAnnotations, selectSegment } from "../src/lab/parse.ts";
import { overlapPairs } from "../src/lab/model.ts";
const source = JSON.parse(
  readFileSync("data/context/source-record.json", "utf8"),
);
const csv = readFileSync("data/context/sperm-whale-dialogues.csv");
const hash = createHash("sha256").update(csv).digest("hex");
if (hash !== source.files[0].sha256)
  throw new Error("Source CSV hash changed.");
const parsed = parseAnnotations(csv.toString("utf8")),
  segment = selectSegment(parsed);
const rule = JSON.parse(
  readFileSync("data/context/selection-rule.json", "utf8"),
);
if (rule.version !== "quality-coverage-v1" || rule.windowSeconds !== 60)
  throw new Error("Unreviewed selection rule.");
const derived = {
  version: 1,
  datasetId: "zenodo-10817697",
  source: {
    version: source.version,
    releaseCommit: source.releaseCommit,
    csvSha256: hash,
    archiveSha256: source.archiveSha256,
    recordUrl: source.recordUrl,
    doi: source.doi,
    license: "CC BY 4.0",
    attribution:
      "Pratyusha Sharma, Shane Gero, Roger Payne, David F. Gruber, Daniela Rus, Antonio Torralba and Jacob Andreas; Dominica Sperm Whale Project. Contextual and combinatorial structure in sperm whale vocalisations (2024).",
    paperUrl: "https://www.nature.com/articles/s41467-024-47221-8",
    annotation:
      "Source research annotations; not independently human-reviewed by CodaBridge",
    timeOrigin:
      "Seconds from source recording start, as documented in archive exchange notebook. REC suffix meaning is not established; exact REC groups stay separate.",
  },
  selectionRule: rule.version,
  segment,
};
const audit = {
  ...parsed.audit,
  exclusions: parsed.excluded,
  selected: {
    id: segment.id,
    rec: segment.rec,
    start: segment.start,
    end: segment.end,
    callers: segment.callers,
    sourceLines: segment.calls.map((c) => c.sourceLine),
    clickCounts: [...new Set(segment.calls.map((c) => c.clicks.length))].sort(
      (a, b) => a - b,
    ),
    boundaryExcludedLines: segment.boundaryExcludedLines,
    positiveOverlapPairs: overlapPairs(segment).length,
  },
  paperSubsetCount: 3948,
  countDifferenceStatus:
    "Archive contains 3840 rows; notebook code itself uses 3840. Why this differs from the paper subset is unresolved; no rows invented or silently filled.",
};
for (const [path, value] of [
  ["src/data/context.json", derived],
  ["data/context/audit.json", audit],
] as const) {
  const text = JSON.stringify(value, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    if (readFileSync(path, "utf8") !== text)
      throw new Error(`Derived context differs: ${path}`);
  } else writeFileSync(path, text);
}
console.log(
  JSON.stringify({
    sourceRows: audit.sourceRows,
    validRows: audit.validRows,
    exclusions: audit.exclusionCounts,
    selected: audit.selected,
  }),
);
