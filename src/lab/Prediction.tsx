import { useEffect, useState } from "react";
import { deliver } from "../composer/project.ts";
import Notice, { useNotice } from "../Notice.tsx";
import { BIN_NAMES, CONTRAST_KEYS, PREDICTION_MODELS, predictionFinding, predictionView, validatePredictionSummary, type PredictionExample, type PredictionSummary } from "./prediction.ts";
import type { Coda } from "./model.ts";
import "./prediction.css";
const seconds = (n: number) => `${n.toFixed(4)} s`;
const bits = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(5)}`;
const modelNames = { M0: "Training frequencies", M1: "Self only", M2: "Self + recent partner", "M2-lagged": "Self + older partner" };
const contrastNames = { M2_vs_M1: "Recent partner vs self only", "M2-lagged_vs_M1": "Older partner vs self only", "M2_vs_M2-lagged": "Recent vs older partner" };

function CodaMarks({ call }: { call: Coda }) {
  return <svg viewBox="0 0 220 30" className="prediction-marks" role="img" aria-label={`${call.clicks.length} annotated clicks across ${seconds(call.duration)}`}>
    <line x1="4" y1="15" x2="216" y2="15" stroke="currentColor" opacity=".3" />
    {call.clicks.map((t, i) => <line key={i} x1={4 + t / call.duration * 212} x2={4 + t / call.duration * 212} y1="5" y2="25" stroke="currentColor" strokeWidth="2" />)}
  </svg>;
}
function Distribution({ label, values, category }: { label: string; values: number[]; category?: number }) {
  return <section className="prediction-distribution" aria-label={label}>
    <h3>{label}</h3>
    {values.map((p, i) => <div key={i} className="prediction-probability" data-actual={category === i ? "true" : undefined}>
      <span>{BIN_NAMES[i]}{category === i ? " · recorded" : ""}</span><strong>{(p * 100).toFixed(1)}%</strong>
      <div className="probability-track" aria-hidden="true"><span style={{ width: `${p * 100}%` }} /></div>
    </div>)}
  </section>;
}
function ReportDownload({ summary }: { summary: PredictionSummary }) {
  const [message, setMessage] = useNotice(), [downloading, setDownloading] = useState(false);
  async function download() {
    setDownloading(true); setMessage("");
    try {
      const response = await fetch(summary.report.path);
      if (!response.ok) throw new Error("The report download is unavailable.");
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength !== summary.report.bytes) throw new Error("Report size does not match this saved experiment.");
      const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(v => v.toString(16).padStart(2, "0")).join("");
      if (digest !== summary.report.sha256) throw new Error("Report checksum does not match this saved experiment.");
      deliver(new Blob([bytes], { type: "application/json" }), "codabridge-dialogue-transfer-v0.1.json");
      setMessage("Sourced experiment JSON download requested. It contains every evaluated coda and the frozen protocol.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Report download failed.", "warning"); }
    finally { setDownloading(false); }
  }
  return <section className="lab-panel prediction-download">
    <h2>Keep the sourced experiment</h2><p>This saved report contains the frozen protocol, source bindings, split assignments and {summary.status === "completed" ? `${summary.cohort.eligibleExamples} paired predictions, their losses, controls and bootstrap draws` : "the exact unavailable status and failure reasons"}.</p>
    <button className="primary" disabled={downloading} onClick={download}>{downloading ? "Checking report…" : "Download sourced prediction JSON"}</button>
    <Notice message={message} />
  </section>;
}
function Example({ example, summary, active }: { example: PredictionExample; summary: PredictionSummary; active: boolean }) {
  const [revealed, setRevealed] = useState(false);
  // Keyed by example in the parent: the target never survives a selection change.
  useEffect(() => { if (!active) setRevealed(false); }, [active]);
  const view = predictionView(example, revealed), r = example.record;
  const primaryHistory = view.history.filter(c => r.selfRows.includes(c.sourceLine) || r.recentRows.includes(c.sourceLine));
  const label = (c: Coda) => c.sourceLine === r.currentRow ? "Current focal coda" : r.selfRows.includes(c.sourceLine) ? "Previous focal coda" : r.recentRows.includes(c.sourceLine) ? "Recent partner coda" : "Older partner coda";
  return <div className="prediction-example" data-testid="prediction-example">
    <section className="lab-panel prediction-history" aria-labelledby="history-title">
      <p className="eyebrow">01 · Available at the cutoff</p>
      <h2 id="history-title">Only completed calls</h2>
      <p>The focal caller has just finished. These whole codas were available at {seconds(view.cutoff)} from the recording start. Each strip shows one coda’s internal timing.</p>
      <div className="prediction-history-grid">{primaryHistory.map(c => <article key={c.sourceLine} data-source-row={c.sourceLine} data-caller-role={r.selfRows.includes(c.sourceLine) ? "focal" : "partner"}>
        <span>{label(c)}</span><CodaMarks call={c} /><strong>{seconds(c.duration)} · {c.clicks.length} clicks</strong>
        <small>Ended {(view.cutoff - (c.onset + c.duration)).toFixed(3)} s before cutoff · row {c.sourceLine}</small>
      </article>)}</div>
      {r.selfRows.length === 1 && <p className="lab-caption">No previous completed focal coda is available in this continuity span. The self-history features include an explicit missing-history indicator.</p>}
      <details><summary>Allowed older history and cutoff details</summary>
        <p>Cutoff rounding half-width: {r.cutoffError.toPrecision(4)} s. Other codas must finish before its lower rounding envelope. Caller labels are local to this exact REC.</p>
        {view.history.filter(c => r.laggedRows.includes(c.sourceLine)).map(c => <p key={c.sourceLine}>Older partner row {c.sourceLine}: {seconds(c.duration)}, {c.clicks.length} clicks, ended {(view.cutoff - c.onset - c.duration).toFixed(3)} s before cutoff.</p>)}
        <p>Exact REC {r.rec} · parent recording root {r.parentGroup} · cutoff at current row {r.currentRow}. No target timing or unfinished-call duration is used.</p>
      </details>
    </section>
    <section className="lab-panel" aria-labelledby="prediction-compare-title">
      <p className="eyebrow">02 · Compare held-out predictions</p>
      <h2 id="prediction-compare-title">What duration comes next?</h2>
      <p>Conditional on a subsequent eligible recorded coda from the focal caller. These are model probabilities for project-defined duration bins, not confidence about meaning.</p>
      <div className="prediction-bins" aria-label="Training-only duration categories">
        <span>Short ≤ {seconds(view.edges[0])}</span><span>Medium &gt; {seconds(view.edges[0])} to {seconds(view.edges[1])}</span><span>Long &gt; {seconds(view.edges[1])}</span>
      </div>
      <p className="lab-caption">Fold {r.fold + 1} boundaries come only from training targets in other recording roots. This example’s group was held out.</p>
      <div className="prediction-distributions">
        <Distribution label="Self only" values={view.selfOnly} category={view.category} />
        <Distribution label="Self + recent partner" values={view.selfPartner} category={view.category} />
      </div>
      {!revealed && <div className="prediction-reveal"><p>The actual next coda is hidden in this view until you reveal it.</p><button className="primary" onClick={() => setRevealed(true)}>Reveal actual next coda</button></div>}
      {view.target && <section className="prediction-target" data-testid="prediction-target" aria-live="polite">
        <p className="eyebrow">03 · Actual next recorded coda</p>
        <h3>{BIN_NAMES[view.category!]} · {seconds(view.target.duration)}</h3><CodaMarks call={view.target} />
        <p>{view.target.clicks.length} annotated clicks · row {view.target.sourceLine} · onset {seconds(view.target.onset)}. Whole coda retained.</p>
        <p>This example’s partner gain: <strong>{bits(view.gain!)} bits</strong>. An individual example does not establish a study effect.</p>
        <button onClick={() => setRevealed(false)}>Hide actual coda</button>
      </section>}
    </section>
    {revealed && <>
      <section className="lab-panel" aria-labelledby="lag-title">
        <p className="eyebrow">04 · Check older context</p><h2 id="lag-title">Does recent history add more?</h2>
        <p>A separately trained model uses partner rows {r.laggedRows.join(" and ")}, skipping the newest two. Their original ages are {r.laggedAges.map(a => `${a.toFixed(3)} s`).join(" and ")}; recent-context ages are {r.recentAges.map(a => `${a.toFixed(3)} s`).join(" and ")}.</p>
        <Distribution label="Self + older partner" values={r.predictions["M2-lagged"].scoring} category={view.category} />
        <p className="lab-caption">No circular wrap or future donor. Older context changes recency as well as content; it is not a permutation null or proof of influence.</p>
      </section>
      <Study summary={summary} />
      <ReportDownload summary={summary} />
    </>}
  </div>;
}
function Study({ summary: s }: { summary: PredictionSummary }) {
  const m = s.metrics;
  if (!m || !s.uncertainty) return <section className="lab-panel"><h2>{predictionFinding(s.status, null)}</h2><p>{s.failures.map(f => f.reason).join("; ")}</p><p>No prediction or score is substituted.</p></section>;
  const range = s.uncertainty.intervals.M2_vs_M1.pooled;
  return <section className="lab-panel prediction-study" aria-labelledby="study-title">
    <p className="eyebrow">05 · Whole-study result</p><h2 id="study-title">{predictionFinding(s.status, m.gainBits.M2_vs_M1)}</h2>
    <p className="prediction-result"><strong>{bits(m.gainBits.M2_vs_M1)}</strong> bits per evaluated coda</p>
    <p>95% group-bootstrap interval: <strong>{bits(range[0])} to {bits(range[1])}</strong>. {range[0] <= 0 && range[1] >= 0 ? "The interval includes zero; the direction is uncertain in this exercise." : "This conditional interval does not establish a biological effect."}</p>
    <p>{s.cohort.eligibleExamples} evaluated codas · {s.cohort.eligibleRecGroups} exact REC fragments · {s.cohort.eligibleParentGroups} recording roots · {s.folds.length} held-out folds. Requiring older partner history excluded {s.cohort.lagRequirementCost} of {s.cohort.beforeLagRequirement} otherwise eligible opportunities.</p>
    <p>These roots are not certified independent encounters. The 2,000 paired group resamples describe this fitted cross-validation exercise and omit model-refit uncertainty; group coverage remains limited.</p>
    <div className="prediction-metrics">{PREDICTION_MODELS.map(model => <div key={model}><span>{modelNames[model]}</span><strong>{m.logLossBits[model].toFixed(5)} bits</strong><small>mean log loss · lower is better</small></div>)}</div>
    <details><summary>Paired comparisons, groups and fold boundaries</summary>
      {CONTRAST_KEYS.map(key => <p key={key}><strong>{contrastNames[key]}:</strong> {bits(m.gainBits[key])} bits/coda, interval {s.uncertainty!.intervals[key].pooled.map(bits).join(" to ")}. Group-macro gain {bits(m.groupMacroGainBits[key])}.</p>)}
      <div className="prediction-group-list">{m.perGroup.map(g => <p key={g.parentGroup}>{g.parentGroup} · {g.n} codas · {bits(g.gainBits.M2_vs_M1)} bits/coda</p>)}</div>
      {s.folds.map(f => <p key={f.fold}>Fold {f.fold + 1}: edges {f.edges.map(seconds).join(" / ")}; {f.trainingCount} training / {f.testCount} held out.</p>)}
    </details>
  </section>;
}
export default function Prediction({ active }: { active: boolean }) {
  const [summary, setSummary] = useState<PredictionSummary | null>(null), [error, setError] = useState(""), [index, setIndex] = useState(0), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/prediction/summary.json", { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error("The saved experiment could not be loaded.");
      const text = await response.text(); if (text.length > 256 * 1024) throw new Error("The prediction summary exceeds its size limit.");
      const value = validatePredictionSummary(JSON.parse(text));
      if (!controller.signal.aborted) { setSummary(value); setError(""); }
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Saved experiment unavailable."); });
    return () => controller.abort();
  }, [attempt]);
  if (error) return <section className="lab-panel" role="status"><h2>Prediction unavailable</h2><p>{error}</p><button onClick={() => { setError(""); setAttempt(a => a + 1); }}>Try loading the saved experiment again</button></section>;
  if (!summary) return <p role="status">Loading the saved held-out experiment…</p>;
  return <div className="prediction-mode" data-testid="prediction-mode">
    <p className="prediction-identity">Precomputed held-out prediction</p>
    <p>Does the other caller’s completed history help predict the focal caller’s next recorded coda? Compare the two models, then reveal what was recorded.</p>
    {summary.status === "completed" ? <>
      <label className="prediction-select">Held-out example<select aria-label="Held-out prediction example" value={index} onChange={e => setIndex(Number(e.target.value))}>{summary.selectedExamples.map((e, i) => <option key={e.record.id} value={i}>Example {i + 1} · {e.record.parentGroup} · current row {e.record.currentRow}</option>)}</select></label>
      <p className="lab-caption">First eligible source-order example from each of the first five eligible recording roots; selection was fixed before scoring.</p>
      <Example key={summary.selectedExamples[index].record.id} example={summary.selectedExamples[index]} summary={summary} active={active} />
    </> : <><Study summary={summary} /><ReportDownload summary={summary} /></>}
    <details className="lab-source-details prediction-source"><summary>Methods, attribution and limits</summary>
      <p><a href={summary.source.recordUrl}>{summary.source.attribution}</a> · {summary.source.license}. Source annotations, not independently human-reviewed here; no original exchange-audio mapping.</p>
      <p>Three duration bins, train-only quantiles and preprocessing, L2 multinomial logistic models, fixed C=1 and grouped evaluation. No fitting, live inference or Astra request happens in this view.</p>
      {summary.limitations.map((text, i) => <p key={i}>{text}</p>)}
      <p>Reveal is a learning aid. Source data and precomputed targets are public static files, not secret.</p>
      <p>Source SHA-256: {summary.source.csvSha256}. Freeze: {summary.provenance.freezeCommit}. Producer: {summary.provenance.producerCommit}. Report SHA-256: {summary.report.sha256}.</p>
    </details>
  </div>;
}
