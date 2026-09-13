import { useEffect, useMemo, useRef, useState } from "react";
import { SyntheticPlayer } from "../composer/sound.ts";
import { deliver } from "../composer/project.ts";
import { ATLAS_LIMITATIONS, ATLAS_METHOD } from "./method.ts";
import type { AtlasRecord, Features, GroupSummary } from "./model.ts";
import { renderAnnotation } from "./sound.ts";
import { useAtlas } from "./useAtlas.ts";
import "./atlas.css";

export interface AtlasEntry { clickCount: number; sourceLine?: number; request: number }
export const number = (n: number, digits = 4) => n.toFixed(digits);
export function GroupOverview({ group }: { group: GroupSummary }) {
  return <div className="atlas-group" data-testid="atlas-support">
    <p><strong>{group.records.toLocaleString("en-US")} {group.records === 1 ? "record" : "records"} · {group.roots} {group.roots === 1 ? "root" : "roots"}</strong> · {group.recs} REC {group.recs === 1 ? "label" : "labels"} · {group.prefixes} file {group.prefixes === 1 ? "prefix" : "prefixes"}</p>
    {group.records === 0 ? <p role="status">No retained records for this click count.</p> : <>
      <p className="atlas-muted">Largest root supplies {number(group.largestRootShare! * 100, 1)}% of records. These labels do not establish independent animals or encounters.</p>
      {group.sparse ? <p className="atlas-caution"><strong>Sparse reference.</strong> Fewer than 20 records or 3 roots. Browse actual rows; bands and percentile judgments are withheld.</p> : <div className="atlas-stats">
        {([['Duration', group.durationSeconds!, 's'], ['Interval CV', group.intervalCV!, ''], ['Last / first interval', group.endpointRatio!, 'ratio']] as const).map(([label, q, unit]) => <div key={label}><span>{label}</span><strong>{number(q.p10)}–{number(q.p90)} {unit}</strong><small>10th–90th · median {number(q.p50)}</small></div>)}
      </div>}
      <details><summary>Root contributions</summary><ul className="atlas-roots">{group.rootContributions.map(r => <li key={r.root}>{r.root}: {r.records} records ({number(r.share * 100, 1)}%)</li>)}</ul></details>
    </>}
  </div>;
}
export function GapRanges({ group, features, label }: { group: GroupSummary; features: Features; label: string }) {
  const showRange = !group.sparse && features.shapeInformative;
  return <div className="atlas-gaps">
    <h4>{showRange ? ATLAS_METHOD.ranges : "Normalized gap shares"}</h4>
    {!features.shapeInformative && <p className="atlas-caution">Two-click shape is nondiscriminating: the only gap share is 1. A zero distance cannot distinguish these rows.</p>}
    {showRange && <p className="atlas-muted">Each position is summarized separately. This is neither a joint 80% region nor a whole-coda template; coordinate medians may not sum to one.</p>}
    <div className="atlas-table-scroll" tabIndex={0} role="region" aria-label={`${label} gap measurements`}>
      <table><thead><tr><th>Gap</th><th>{label} · seconds</th><th>Share · fraction</th>{showRange && <><th>Observed p10–p90</th><th>Position in this archive</th></>}</tr></thead>
        <tbody>{features.gapShares.map((share, i) => {
          const q = group.gapShares[i];
          return <tr key={i}><th scope="row">{i + 1}</th><td>{number(features.intervalsSeconds[i], 6)}</td><td><span>{number(share, 6)}</span><div className="atlas-share-track" aria-hidden="true"><i style={{ width: `${share * 100}%` }} /></div></td>
            {showRange && q && <><td>{number(q.p10, 6)}–{number(q.p90, 6)}<div className="atlas-share-track" aria-hidden="true"><i className="atlas-band" style={{ left: `${q.p10 * 100}%`, width: `${(q.p90 - q.p10) * 100}%` }} /><b style={{ left: `${share * 100}%` }} /></div></td><td>Gap {i + 1} is {share < q.p10 ? "below this reference's 10th percentile" : share > q.p90 ? "above this reference's 90th percentile" : "within this marginal range"}</td></>}
          </tr>;
        })}</tbody></table>
    </div>
  </div>;
}
function AnnotatedPattern({ row, stop }: { row: AtlasRecord; stop: () => void }) {
  const [view, setView] = useState<"absolute" | "normalized">("absolute");
  const end = view === "absolute" ? row.duration : 1;
  return <div className="atlas-pattern">
    <div className="atlas-actions" role="group" aria-label="Annotated timing scale">
      <button aria-pressed={view === "absolute"} onClick={() => { stop(); setView("absolute"); }}>Absolute seconds</button>
      <button aria-pressed={view === "normalized"} onClick={() => { stop(); setView("normalized"); }}>Normalized positions</button>
    </div>
    <svg viewBox="0 0 720 100" role="img" aria-label={`Whole source row ${row.sourceLine}: ${row.clicks.length} clicks, ${number(row.duration, 6)} seconds; ${view} scale`}>
      <line x1="20" x2="700" y1="42" y2="42" stroke="currentColor" opacity=".4" />
      {row.features.clickPositions.map((p, i) => <line key={i} x1={20 + p * 680} x2={20 + p * 680} y1="22" y2="62" stroke="currentColor" strokeWidth="3" />)}
      {[0, .5, 1].map(p => <text key={p} x={20 + p * 680} y="91" textAnchor={p === 0 ? "start" : p === 1 ? "end" : "middle"} fill="currentColor" fontSize="18">{number(end * p, 3)}{view === "absolute" ? " s" : ""}</text>)}
    </svg>
    <details><summary>Every click position as numbers</summary><ol className="atlas-roots">{row.clicks.map((t, i) => <li key={i}>Click {i + 1}: {number(t, 7)} s · normalized {number(row.features.clickPositions[i], 7)}</li>)}</ol></details>
  </div>;
}
export function AtlasSource({ row }: { row: AtlasRecord }) {
  return <details className="atlas-source"><summary>Source details · CSV line {row.sourceLine}</summary>
    <p>REC {row.rec} · annotation-local caller {row.caller} · prefix {row.prefix} · root {row.root}. These are source labels, not resolved individuals or encounters.</p>
    <p>Declared duration: {row.raw.Duration} s. Original onset: {row.raw.TsTo} s. Derived whole span: {row.duration} s.</p>
    <p>Mean interval {number(row.features.meanIntervalSeconds, 6)} s · population interval CV {number(row.features.intervalCV, 6)} · last/first ratio {number(row.features.endpointRatio, 6)} · end-minus-start share {number(row.features.endpointShareDifference, 6)}.</p>
    <p>Endpoint comparisons do not establish monotonic acceleration, rubato, ornamentation or meaning. Full original numeric text is retained in the Atlas JSON.</p>
  </details>;
}
export default function Atlas({ active, entry, stopField }: { active: boolean; entry?: AtlasEntry; stopField: () => void }) {
  const { state, retry } = useAtlas(active);
  const [count, setCount] = useState(entry?.clickCount ?? 5);
  const [sourceLine, setSourceLine] = useState<number | undefined>(entry?.sourceLine);
  const [sort, setSort] = useState("source");
  const [audio, setAudio] = useState("Synthetic playback stopped"), [notice, setNotice] = useState("");
  const player = useRef<SyntheticPlayer | null>(null);
  useEffect(() => { player.current = new SyntheticPlayer(setAudio); return () => player.current?.stop(); }, []);
  useEffect(() => { if (entry) { setCount(entry.clickCount); setSourceLine(entry.sourceLine); setSort("source"); } }, [entry]);
  useEffect(() => { player.current?.stop(); setNotice(""); }, [count, sourceLine, sort, active, entry]);
  const rows = useMemo(() => state.status !== "ready" ? [] : state.data.atlas.records.filter(r => r.features.clickCount === count).sort((a, b) => {
    const feature = sort === "duration" ? "durationSeconds" : sort === "cv" ? "intervalCV" : "endpointRatio";
    return (sort === "source" ? 0 : a.features[feature] - b.features[feature]) || a.sourceLine - b.sourceLine;
  }), [state, count, sort]);
  const row = rows.find(r => r.sourceLine === sourceLine) ?? rows[0];
  async function play() {
    if (!row || !active) return;
    stopField(); setNotice("");
    try { await player.current?.playRendered(renderAnnotation(row).samples); }
    catch (e) { setNotice(`${e instanceof Error ? e.message : "Audio unavailable."} Visual inspection and downloads remain available.`); }
  }
  if (state.status === "failed") return <div className="atlas-panel" role="alert"><p>{state.error} No reference results are available.</p><button onClick={retry}>Retry Atlas loading</button></div>;
  if (state.status !== "ready") return <p role="status">Loading source-checked timing atlas…</p>;
  const { atlas, summary, bytes } = state.data, group = atlas.groups.find(g => g.clickCount === count)!;
  return <div className="atlas" data-testid="style-atlas">
    <p className="atlas-intro">Browse whole annotated codas and use their timing as a descriptive reference for your own creations.</p>
    <p className="atlas-muted">{atlas.accounting.validRows.toLocaleString("en-US")} retained records · {atlas.support.roots} roots · {atlas.accounting.excludedRows} original exclusions. <a href="https://zenodo.org/records/10817697">Sharma et al. / Dominica Sperm Whale Project</a> · CC BY 4.0</p>
    <div className="atlas-panel">
      <div className="atlas-controls"><label>Click count<select aria-label="Atlas click count" value={count} onChange={e => { setCount(Number(e.target.value)); setSourceLine(undefined); }}>
        {atlas.groups.map(g => <option key={g.clickCount} value={g.clickCount}>{g.clickCount} clicks · {g.records} {g.records === 1 ? "record" : "records"}{g.records === 0 ? " · empty" : g.sparse ? " · sparse" : ""}</option>)}
      </select></label></div>
      <GroupOverview group={group} />
    </div>
    {row && <div className="atlas-panel" data-testid="atlas-selected" data-source-row={row.sourceLine}>
      <p className="eyebrow">One complete annotated row</p><h2>Row {row.sourceLine} · {row.clicks.length} clicks</h2>
      <p><strong>{number(row.duration, 6)} s</strong> first-to-last duration · mean interval {number(row.features.meanIntervalSeconds, 6)} s</p>
      <div className="atlas-controls"><label>Sort actual references<select aria-label="Atlas reference sort" value={sort} onChange={e => { setSort(e.target.value); setSourceLine(undefined); }}><option value="source">Source line</option><option value="duration">Duration, shortest first</option><option value="cv">Interval CV, lowest first</option><option value="ratio">Last/first ratio, lowest first</option></select></label>
        <label>Annotated row<select aria-label="Atlas annotated row" value={row.sourceLine} onChange={e => setSourceLine(Number(e.target.value))}>{rows.map(r => <option key={r.id} value={r.sourceLine}>Row {r.sourceLine} · {number(r.duration)} s · {r.rec}</option>)}</select></label></div>
      <div className="atlas-actions"><button disabled={rows.indexOf(row) === 0} onClick={() => setSourceLine(rows[rows.indexOf(row) - 1].sourceLine)}>Previous row</button><button disabled={rows.indexOf(row) === rows.length - 1} onClick={() => setSourceLine(rows[rows.indexOf(row) + 1].sourceLine)}>Next row</button></div>
      <AnnotatedPattern row={row} stop={() => player.current?.stop()} />
      <p className="reconstruction-label">Synthetic timing reconstruction, not original audio. Every click comes from this one annotated row.</p>
      <div className="atlas-actions"><button className="primary" onClick={() => void play()}>Play complete annotated row</button><button onClick={() => player.current?.stop()}>Stop Atlas audio</button><span role="status">{audio}</span></div>
      <GapRanges group={group} features={row.features} label="Annotated row" />
      <AtlasSource row={row} />
    </div>}
    <div className="atlas-panel"><h2>Keep the sourced reference</h2><p>All retained rows, original numeric text, exclusions, count summaries and method provenance. {number(summary.report.bytes / 1024 / 1024, 2)} MiB JSON.</p>
      <button onClick={() => { try { deliver(new Blob([new Uint8Array(bytes)], { type: "application/json" }), "codabridge-style-atlas-v1.json"); setNotice("Sourced Atlas JSON download requested."); } catch { setNotice("Atlas download could not start. Please retry."); } }}>Download sourced Atlas JSON</button>
      <details><summary>Methods, limits & file identities</summary><ul>{ATLAS_LIMITATIONS.map(l => <li key={l}>{l}</li>)}</ul><p>{ATLAS_METHOD.quantiles.rule}</p><p>{atlas.accounting.longRows} rows exceed 12 clicks; {atlas.accounting.subComposerGapRows} contain gaps below 0.04 s. All remain whole.</p><p>Atlas {atlas.atlasVersion} · method SHA-256 <code>{atlas.methodSha256}</code></p><p>Source SHA-256 <code>{atlas.sourceSha256}</code></p><p>Report SHA-256 <code>{summary.report.sha256}</code></p></details>
    </div>
    <p role="status">{notice}</p>
  </div>;
}
