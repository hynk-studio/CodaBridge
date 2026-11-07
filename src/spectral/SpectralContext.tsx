import { downloadJson } from "./download.ts";
import { useEffect, useRef, useState } from "react";
import { FIELDS, REUSE, SOURCES, sourceUrl } from "./contract.ts";
import { summarize, verifiedJoin, type JoinReport } from "./model.ts";
import "./spectral.css";
import NativeSpectrum from "./NativeSpectrum.tsx";
export default function SpectralContext({ active }: { active: boolean }) {
  const [report, setReport] = useState<JoinReport | null>(null), [message, setMessage] = useState("External rows unavailable until you select the pinned source files.");
  const [type, setType] = useState(""), [urn, setURN] = useState("");
  const generation = useRef(0);
  useEffect(() => { if (!active) { generation.current++; setMessage(m => m === "Verifying source bytes…" ? "Import canceled after leaving this workspace. Select the files again." : m); } return () => { generation.current++; }; }, [active]);
  async function load(files: File[]) {
    const token = ++generation.current; setReport(null); setType(""); setURN(""); setMessage("Verifying source bytes…");
    try {
      const result = await verifiedJoin(files);
      if (token !== generation.current) return;
      setReport(result); setMessage(result.status === "verified" ? "Both complete files verified. All shared fields agree." : "Integration blocked. No rows admitted; download the conflict report.");
    } catch (e) { if (token === generation.current) setMessage(e instanceof Error ? e.message : "Import failed."); }
  }
  const rows = report?.rows.filter(r => (!type || r.raw.codatype === type) && (!urn || r.raw.URN === urn)) ?? [];
  const summary = summarize(rows);
  return <div className="spectral-context">
    <NativeSpectrum active={active} />
    <h2>Published CETI spectrum and environmental annotations</h2>
    <p>Compare published spectral annotations and environmental codes from the same CETI codas. These records have no verified mapping to the four field recordings or the timing archive.</p>
    <p>{REUSE.distribution} Files stay in this browser; no upload or model request occurs. No audio is available for these rows.</p>
    <ul>{SOURCES.map(s => <li key={s.id}><a href={sourceUrl(s)} target="_blank" rel="noreferrer">{s.path}</a> · {s.bytes.toLocaleString()} bytes · revision {s.revision.slice(0, 7)}</li>)}</ul>
    <label>Open both pinned CSV files<input type="file" accept=".csv" multiple onChange={e => { void load(Array.from(e.target.files ?? [])); e.target.value = ""; }} /></label>
    <p role="status">{message}</p>
    {report && <button onClick={() => downloadJson({ ...report, summary: summarize(report.rows) }, "codabridge-spectral-context-v1.json")}>Download source-bound join report</button>}
    {report?.status === "verified" && <>
      <div className="spectral-filters"><label>Coda type<select value={type} onChange={e => setType(e.target.value)}><option value="">All types</option>{[...new Set(report.rows.map(r => r.raw.codatype))].sort().map(t => <option key={t}>{t}</option>)}</select></label>
      <label>Raw URN code<select value={urn} onChange={e => setURN(e.target.value)}><option value="">All codes</option>{[...new Set(report.rows.map(r => r.raw.URN))].sort().map(t => <option key={t}>{t}</option>)}</select></label></div>
      <p>{summary.denominator} / {report.rows.length} records · {summary.knownProducerGroups} known producer groups · {summary.unknownProducer} unidentified producers. Repeated records are not independent animals.</p>
      <p>URN and AIS codes retain unresolved meanings, including −1 and 1*. Manual vowel labels and automated spectral labels are separate annotations. No environmental causal effect is estimated here.</p>
      <details><summary>Missingness, raw code counts and grouping support</summary><pre>{JSON.stringify(summary, null, 2)}</pre></details>
      <div className="lab-table-scroll" role="region" aria-label="Spectral context records" tabIndex={0}><table><thead><tr><th>CETI ID / source lines</th><th>Type / producer</th><th>Duration (s)</th><th>Manual / automated vowel</th><th>Peak 1 distance (Hz)</th><th>URN / AIS raw</th></tr></thead><tbody>{rows.slice(0, 100).map(r => <tr key={r.id}><td>{r.raw.codanum}<br />{r.spectralLine} / {r.environmentLine}</td><td>{r.raw.codatype} / {r.interpreted.whale ?? "unknown"}</td><td>{r.interpreted.Duration ?? "missing"}</td><td>{r.raw.handv || "unknown"} / {r.raw.autovbycoda || "unknown"}</td><td>{r.interpreted.meandist_pk1 ?? "missing"}</td><td>{r.raw.URN} / {r.raw.AIS_Data}</td></tr>)}</tbody></table></div>
      <p>Showing the first {Math.min(100, rows.length)} filtered records in source order. The download includes every joined record, raw values and field provenance.</p>
    </>}
    <details><summary>Sources, field definitions and reuse status</summary><p>{REUSE.attribution}</p><pre>{JSON.stringify({ reuse: REUSE, sources: SOURCES, fields: FIELDS }, null, 2)}</pre></details>
  </div>;
}
