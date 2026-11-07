import { parseCsv, indexBy, type CsvRow } from "../../analysis/metadata-linkage-v1/csv.ts";
import { EXTRA_FIELDS, FIELDS, REUSE, SHARED_FIELDS, SOURCES, VERSION } from "./contract.ts";
export interface JoinedRow { id: string; spectralLine: number; environmentLine: number; raw: Record<string, string>; interpreted: Record<string, string | number | boolean | null> }
export interface JoinIssue { kind: string; source?: string; id?: string; lines?: number[]; field?: string; left?: string; right?: string }
export function interpret(raw: Record<string, string>): JoinedRow["interpreted"] {
  const values: JoinedRow["interpreted"] = {};
  for (const field of Object.keys(FIELDS)) {
    const v = raw[field];
    if (["URN", "AIS_Data"].includes(field) || !v || v === "NA") values[field] = null;
    else if (field === "focal") values[field] = v === "True" ? true : v === "False" ? false : null;
    else if (field === "Duration" || field.startsWith("meand") || field.startsWith("mismatch")) values[field] = Number.isFinite(Number(v)) ? Number(v) : null;
    else values[field] = v;
  }
  return values;
}
export function joinTables(spectralText: string, environmentText: string, expectedCount = 1375) {
  const issues: JoinIssue[] = [];
  let spectral: CsvRow[] = [], environment: CsvRow[] = [];
  for (const [name, text, expected] of [["spectral", spectralText, SHARED_FIELDS], ["environment", environmentText, [...SHARED_FIELDS, ...EXTRA_FIELDS]]] as const) {
    try {
      const rows = parseCsv(text);
      const keys = Object.keys(rows[0]?.raw ?? {}).sort();
      if (JSON.stringify(keys) !== JSON.stringify([...expected].sort())) issues.push({ kind: "schema", source: name });
      if (rows.length !== expectedCount) issues.push({ kind: "row-count", source: name });
      if (name === "spectral") spectral = rows; else environment = rows;
    } catch { issues.push({ kind: "malformed-csv", source: name }); }
  }
  const left = indexBy(spectral, "codanum"), right = indexBy(environment, "codanum");
  for (const [name, index] of [["spectral", left], ["environment", right]] as const) {
    for (const [id, rows] of index) {
      if (!id?.trim()) issues.push({ kind: "missing-id", source: name, lines: rows.map(r => r.line) });
      if (rows.length !== 1) issues.push({ kind: "duplicate-id", source: name, id, lines: rows.map(r => r.line) });
    }
  }
  const candidates: JoinedRow[] = [];
  for (const id of new Set([...left.keys(), ...right.keys()])) {
    const a = left.get(id), b = right.get(id);
    if (!a || !b) { issues.push({ kind: "unmatched-id", source: a ? "spectral" : "environment", id }); continue; }
    if (!id?.trim() || a.length !== 1 || b.length !== 1) continue;
    const differences = SHARED_FIELDS.filter(field => a[0].raw[field] !== b[0].raw[field]);
    for (const field of differences) issues.push({ kind: "shared-field-difference", id, field, left: a[0].raw[field], right: b[0].raw[field], lines: [a[0].line, b[0].line] });
    if (!differences.length) candidates.push({ id: `ceti-codanum:${id}`, spectralLine: a[0].line, environmentLine: b[0].line, raw: { ...b[0].raw }, interpreted: interpret(b[0].raw) });
  }
  return { version: VERSION, status: issues.length ? "blocked" as const : "verified" as const, sources: SOURCES, reuse: REUSE,
    idNamespace: "CETI codanum; not timing archive row IDs", fields: FIELDS,
    waveformMapping: "unavailable", timingArchiveMapping: "unresolved; prior candidate links are not promoted",
    counts: { spectral: spectral.length, environment: environment.length, uniqueSpectral: left.size, uniqueEnvironment: right.size, agreeingPairs: candidates.length, sharedFieldDifferences: issues.filter(i => i.kind === "shared-field-difference").length },
    issues, rows: issues.length ? [] : candidates };
}
export type JoinReport = ReturnType<typeof joinTables>;
export function summarize(rows: JoinedRow[]) {
  const frequencies = (field: string) => Object.fromEntries([...new Set(rows.map(r => r.raw[field] || "(missing)"))].sort().map(value => [value, rows.filter(r => (r.raw[field] || "(missing)") === value).length]));
  return { denominator: rows.length, unknownProducer: rows.filter(r => r.interpreted.whale === null).length,
    knownProducerGroups: new Set(rows.filter(r => r.interpreted.whale !== null).map(r => r.raw.whale)).size,
    missing: Object.fromEntries(Object.keys(FIELDS).map(f => [f, rows.filter(r => !r.raw[f] || r.raw[f] === "NA").length])),
    codaTypes: frequencies("codatype"), manualVowels: frequencies("handv"), rawURN: frequencies("URN"), rawAIS: frequencies("AIS_Data"),
    groupingLimit: "Known producer names describe repeated records; no independent encounter count is available." };
}
export async function verifiedJoin(files: readonly File[]) {
  if (files.length !== 2) throw new Error("Select both pinned CSV files together.");
  const texts: string[] = [];
  for (const source of SOURCES) {
    const matching = files.filter(f => f.name === source.path);
    if (matching.length !== 1 || matching[0].size !== source.bytes) throw new Error(`Expected pinned ${source.path} (${source.bytes} bytes).`);
    const bytes = await matching[0].arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
    if (hash !== source.sha256) throw new Error(`Checksum mismatch: ${source.path}. No rows loaded.`);
    texts.push(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  }
  return joinTables(texts[0], texts[1]);
}
