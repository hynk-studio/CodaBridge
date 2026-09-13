import { useMemo, useRef, useState } from "react";
import { deliver } from "../composer/project.ts";
import { compareWithAtlas, timingBinding, type CurrentTiming } from "./model.ts";
import { useAtlas } from "./useAtlas.ts";
import { GapRanges, GroupOverview, number } from "./Atlas.tsx";

export default function ObservedReference({ current, enabled, onExplore }: { current: CurrentTiming; enabled: boolean; onExplore: (count: number, sourceLine?: number) => void }) {
  const { state, retry } = useAtlas(enabled);
  const key = timingBinding(current), latest = useRef(key); latest.current = key;
  const [notice, setNotice] = useState({ key: "", text: "" });
  // The only asynchronous input is the fixed archive. Derive synchronously from
  // the current timing binding on every edit/selection/import/undo/redo render.
  const comparison = useMemo(() => state.status === "ready" ? compareWithAtlas(JSON.parse(key), state.data.atlas, state.data.summary.report) : null, [state, key]);
  function download() {
    if (!enabled || !comparison || comparison.binding !== latest.current) return;
    try {
      const text = JSON.stringify(comparison, null, 2) + "\n";
      deliver(new Blob([text], { type: "application/json" }), "codabridge-composer-timing-reference-v1.json");
      setNotice({ key, text: "Current-block comparison JSON download requested." });
    } catch { setNotice({ key, text: "Comparison download could not start. Please retry." }); }
  }
  return <section className="atlas-panel observed-reference" aria-label="Observed timing reference" hidden={!enabled}>
    <p className="eyebrow">Research annotations · read-only</p><h3>Observed timing reference</h3>
    <p>Compare this block with whole annotated rows of the same click count. All timing processing stays in your browser.</p>
    {state.status === "failed" ? <div role="alert"><p>{state.error} No reference results are available.</p><button onClick={retry}>Retry reference loading</button></div> : !comparison ? <p role="status">Loading source-checked timing reference…</p> : <div data-testid="composer-atlas-comparison" data-binding={comparison.binding}>
      <p className="atlas-current"><strong>This block: {number(comparison.currentTiming.features.durationSeconds, 6)} s · {current.times.length} clicks</strong><br />Duration is separate from normalized shape.</p>
      <GroupOverview group={comparison.support} />
      <GapRanges group={comparison.support} features={comparison.currentTiming.features} label="This block" />
      <details className="atlas-nearest"><summary>{comparison.shapeStatus === "nondiscriminating-two-click" ? "Actual two-click references · tied, uninformative shape" : "Up to three nearest actual references"}</summary>
        <p>normalized-interval-mad v1.0.0 · dimensionless · smaller is closer. Equal counts only; distance ties use source line. Zero distance does not establish identity or meaning.</p>
        <ol>{comparison.nearest.map(n => <li key={n.id}><strong>Row {n.sourceLine}</strong> · {number(n.durationSeconds, 6)} s · distance {number(n.distance, 8)}<p>{n.reference.rec} · local caller {n.reference.caller}</p><button onClick={() => onExplore(current.times.length, n.sourceLine)}>Inspect annotated row {n.sourceLine}</button></li>)}</ol>
      </details>
      <div className="atlas-actions"><button onClick={() => onExplore(current.times.length)}>Explore matching-count atlas</button><button onClick={download}>Download current comparison JSON</button></div>
      <p className="atlas-muted">The download includes only this block's timing and sourced reference evidence. Your project, intention and codebook are separate.</p>
      <p className="atlas-muted">Descriptive archive comparison, not an authenticity score, correction, prediction or meaning inference.</p>
    </div>}
    <p role="status">{notice.key === key ? notice.text : ""}</p>
  </section>;
}
