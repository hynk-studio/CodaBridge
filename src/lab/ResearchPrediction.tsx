import { useEffect, useState } from "react";
import Notice, { useNotice } from "../Notice.tsx";
import { deliver } from "../composer/project.ts";
import { RESEARCH_LABELS, readResearchBytes, researchFinding, researchView, validateResearchSummary, type Metrics, type ResearchExample, type ResearchStudy, type ResearchSummary } from "./researchPrediction.ts";
import type { Coda } from "./model.ts";
import "./researchPrediction.css";

const signed = (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(6)}`;
const range = (v: number[] | undefined) => v ? v.map(signed).join(" to ") : "unavailable";
const modelNames = { M0: "Training mean", M1: "Self only", M2: "Self + recent partner", "M2-lagged": "Self + older partner" };
const contrastNames = { M2_vs_M1: "Recent partner vs self only", "M2-lagged_vs_M1": "Older partner vs self only", "M2_vs_M2-lagged": "Recent vs older partner" };
const seconds = (v: number) => `${v.toFixed(4)} s`;

function Marks({ call }: { call: Coda }) {
  return <svg viewBox="0 0 220 30" className="prediction-marks" role="img" aria-label={`${call.clicks.length} annotated clicks across ${seconds(call.duration)}`}>
    <line x1="4" y1="15" x2="216" y2="15" stroke="currentColor" opacity=".3" />
    {call.clicks.map((t, i) => <line key={i} x1={4 + t / call.duration * 212} x2={4 + t / call.duration * 212} y1="5" y2="25" stroke="currentColor" strokeWidth="2" />)}
  </svg>;
}
function Download({ summary }: { summary: ResearchSummary }) {
  const [message, setMessage] = useNotice(), [busy, setBusy] = useState(false);
  async function download() {
    setBusy(true); setMessage("");
    try {
      const bytes = await readResearchBytes(await fetch(summary.report.path), summary.report.bytes);
      if (bytes.byteLength !== summary.report.bytes) throw new Error("Report size does not match this saved research package.");
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(v => v.toString(16).padStart(2, "0")).join("");
      if (hash !== summary.report.sha256) throw new Error("Report checksum does not match this saved research package.");
      deliver(new Blob([bytes], { type: "application/json" }), "codabridge-dialogue-transfer-v0.2.json");
      setMessage("Sourced v0.2 JSON download requested. It contains all four studies, every evaluated row, controls, bootstrap draws and provenance.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Research download failed.", "warning"); }
    finally { setBusy(false); }
  }
  return <section className="lab-panel research-download"><h2>Keep the sourced research</h2>
    <p>All four prespecified analyses, their signs and any failures are retained. The report includes source bindings, fold assignments, fixed predictions, losses, group contributions, strata and bootstrap draws.</p>
    <button className="primary" disabled={busy} onClick={download}>{busy ? "Checking v0.2 report…" : "Download sourced v0.2 JSON"}</button><Notice message={message} />
  </section>;
}
function Stratum({ label, metrics: m }: { label: string; metrics: Metrics }) {
  return <p><strong>{label}:</strong> {m.pooled ? <>{m.pooled.n} codas / {m.groups} roots · pooled {signed(m.pooled.gain.M2_vs_M1)} · macro {signed(m.macro!.gain.M2_vs_M1)} · {m.status === "limited-group-coverage" ? "limited group coverage" : "descriptive"}</> : "Empty cell — no estimate"}</p>;
}
function Study({ study: s, summary }: { study: ResearchStudy; summary: ResearchSummary }) {
  const labels = RESEARCH_LABELS[s.id], cohort = summary.cohorts[s.cohort], m = s.metrics;
  return <section className="lab-panel research-study" data-testid={`research-study-${s.id}`} aria-labelledby={`research-${s.id}`}>
    <p className="eyebrow">{s.role} · {s.status === "completed" ? "Completed offline" : "Unavailable"}</p>
    <h2 id={`research-${s.id}`}>{labels.title}</h2><h3 className="research-finding">{researchFinding(s)}</h3>
    {!m?.pooled ? <><p>{s.failures.map(f => f.reason).join("; ")}</p><p>No estimate from successful folds or another endpoint is substituted.</p></> : <>
      <p className="prediction-result"><strong>{signed(m.pooled.gain.M2_vs_M1)}</strong> {labels.unit} · paired gain from recent partner history</p>
      <p>95% paired root-bootstrap interval: <strong>{range(s.uncertainty?.intervals.M2_vs_M1.pooled)}</strong>.</p>
      <p>Equal-root macro gain: <strong>{signed(m.macro!.gain.M2_vs_M1)}</strong>; interval {range(s.uncertainty?.intervals.M2_vs_M1.macro)}. Pooled results weight codas; macro results weight recording roots equally.</p>
      <p>{cohort.examples} evaluated codas · {cohort.recGroups} exact REC fragments · {cohort.parentGroups} recording roots · five held-out folds. Gain = self-only loss − recent-partner loss; positive values mean lower observed loss.</p>
      <p className="research-caution">These are pointwise, conditional, descriptive intervals from 2,000 paired root resamples. They omit refit uncertainty and multiplicity adjustment; the roots are not certified independent encounters.</p>
      {s.id === "coverage-duration" && <p>Requiring two completed partners expands the cohort by {summary.cohorts.coverage.examples - summary.cohorts.core.examples} codas. Every model here uses the same expanded support; there is no older-partner fit. Changed training and evaluation support prevents treating the difference from the core gain as a controlled model improvement.</p>}
      {s.id === "count" && <p>Poisson regression is a positive conditional-mean working model. A click count is not ornamentation, a noise-law claim or a validated generative distribution.</p>}
      {s.id === "gap" && <p>This target is time from current focal completion to the next eligible recorded focal onset, conditional on its occurrence and recording. It is not partner reply latency, speaking probability or survival analysis.</p>}
      <div className="prediction-metrics">{s.models.map(model => <div key={model}><span>{modelNames[model]}</span><strong>{m.pooled!.loss[model].toFixed(6)}</strong><small>mean {s.estimator === "poisson" ? "Poisson deviance" : "squared log error"} · lower is better</small><small>MAE: {m.pooled!.mae[model].toFixed(6)} {labels.diagnostic}</small></div>)}</div>
      <details><summary>Older control, every root and deletion influence</summary>
        {Object.entries(contrastNames).filter(([key]) => key in m.pooled!.gain).map(([key, label]) => <p key={key}><strong>{label}:</strong> pooled {signed(m.pooled!.gain[key])}, interval {range(s.uncertainty?.intervals[key].pooled)}; macro {signed(m.macro!.gain[key])}, interval {range(s.uncertainty?.intervals[key].macro)}.</p>)}
        {s.cohort === "core" && <p>The older model was fitted separately with third/fourth latest completed partner codas and their actual ages. No future donor or circular wrap. It changes recency and cannot remove shared-context confounds.</p>}
        <div className="research-table-wrap" tabIndex={0} role="region" aria-label={`${labels.title}: every recording root`}>
          <table><caption>Recent vs self-only · {labels.unit}</caption><thead><tr><th>Root</th><th>n</th><th>Gain</th><th>Pooled contribution</th><th>Macro contribution</th><th>Pooled gain after deletion</th></tr></thead>
            <tbody>{m.perGroup!.map(g => <tr key={g.parentGroup}><th scope="row">{g.parentGroup}</th><td>{g.n}</td><td>{signed(g.gain.M2_vs_M1)}</td><td>{signed(g.pooledContribution.M2_vs_M1)}</td><td>{signed(g.macroContribution.M2_vs_M1)}</td><td>{signed(s.deletions.find(d => d.removedRoot === g.parentGroup)!.pooledGain.M2_vs_M1)}</td></tr>)}</tbody>
          </table>
        </div>
        <p>Each deletion only removes that root’s saved predictions and recomputes the estimate. Training folds are unchanged: this is influence on the fixed result, not refitted validation. The JSON includes every contrast and both pooled and macro deletions.</p>
      </details>
      <details><summary>Three prespecified history strata and fold details</summary>
        <p>These descriptive partitions use only completed history. No target-derived threshold, group search or extra fit; empty and small cells stay visible. All gains below use {labels.unit}.</p>
        <h3>Previous focal history</h3><Stratum label="Present" metrics={s.strata.previous.present} /><Stratum label="Absent" metrics={s.strata.previous.absent} />
        <h3>Completed recent partners overlap current focal coda</h3><Stratum label="Definite overlap" metrics={s.strata.overlap.definite} /><Stratum label="No definite overlap" metrics={s.strata.overlap["no-definite-overlap"]} />
        <p>Definite overlap requires the intervals to overlap after source rounding envelopes. The other cell includes rounding ambiguity.</p>
        <h3>Age of latest completed partner</h3><Stratum label="At or below training-fold median" metrics={s.strata.age["at-or-below"]} /><Stratum label="Above training-fold median" metrics={s.strata.age.above} />
        {s.folds.map(f => <p key={f.fold}>Fold {f.fold + 1}: {f.trainingCount} training / {f.testCount} held out; training-only age median {seconds(f.latestAgeMedian)}. Ties enter the at-or-below cell.</p>)}
        {s.estimator === "poisson" && s.models.map(model => <p key={model}>{modelNames[model]}: {m.outOfRangeMeans![model].outsideTrainingCountRange} means outside the corresponding training count range; {m.outOfRangeMeans![model].outsideSourceCountRange} outside the valid source range 2–29. No means were rounded or clipped.</p>)}
        <p>{s.warningsCount} recorded numerical-backend warnings; finite predictions and the frozen numerical acceptance checks passed for every fit in this completed endpoint. Warning messages and fold/model identities remain in the report.</p>
      </details>
    </>}
  </section>;
}
function Example({ example, summary, active }: { example: ResearchExample; summary: ResearchSummary; active: boolean }) {
  const [revealed, setRevealed] = useState(false);
  useEffect(() => { if (!active) setRevealed(false); }, [active]);
  const view = researchView(example, summary.studies, revealed), current = view.history.find(c => c.sourceLine === view.currentRow)!;
  const partners = view.history.filter(c => c.caller !== current.caller).sort((a, b) => b.onset + b.duration - a.onset - a.duration);
  const recentRows = partners.slice(0, 2).map(c => c.sourceLine);
  const primary = view.history.filter(c => c.caller === current.caller || recentRows.includes(c.sourceLine));
  return <>
    <section className="lab-panel research-history"><p className="eyebrow">01 · Available at the cutoff</p><h2>Start with completed history</h2>
      <p>The focal caller has just finished at {seconds(view.cutoff)}. Histories stay inside this exact REC; caller labels have no identity across recordings.</p>
      <div className="prediction-history-grid">{primary.map(c => <article key={c.sourceLine} data-source-row={c.sourceLine} data-caller-role={c.caller === current.caller ? "focal" : "partner"}>
        <span>{c.sourceLine === current.sourceLine ? "Current focal coda" : c.caller === current.caller ? "Previous focal coda" : "Recent partner coda"}</span><Marks call={c} /><strong>{seconds(c.duration)} · {c.clicks.length} clicks</strong><small>Ended {(view.cutoff - (c.onset + c.duration)).toFixed(3)} s before cutoff · row {c.sourceLine}</small>
      </article>)}</div>
      {view.history.filter(c => c.caller === current.caller).length === 1 && <p>No previous completed focal coda is available. The self-history predictors retain that missing-history state.</p>}
      <details><summary>Allowed older history and recording scope</summary>
        {partners.slice(2).map(c => <p key={c.sourceLine}>Older partner row {c.sourceLine}: {seconds(c.duration)}, {c.clicks.length} clicks; ended {(view.cutoff - c.onset - c.duration).toFixed(3)} s before cutoff.</p>)}
        <p>Exact REC {view.rec} · parent root {view.parentGroup} · current row {view.currentRow}. Only calls completed before the cutoff’s rounding envelope enter partner history.</p>
      </details>
    </section>
    <section className="lab-panel research-compare"><p className="eyebrow">02 · Compare precomputed held-out predictions</p><h2>Three questions about the next focal coda</h2>
      <p>Each model was trained on other recording roots. These are saved point predictions, not live inference, response rules or probabilities of a coda occurring.</p>
      {view.predictions.map(p => <section className="research-point-row" key={p.id} aria-label={RESEARCH_LABELS[p.id].title}>
        <p className="eyebrow">{p.role}</p><h3>{RESEARCH_LABELS[p.id].title}</h3>
        {p.points ? <><div className="research-points">{(["M1", "M2"] as const).map(model => <div key={model}><span>{modelNames[model]}</span><strong>{p.points![model].nativePoint.toFixed(4)}</strong><small>{RESEARCH_LABELS[p.id].point}</small></div>)}</div><p className="lab-caption">Fold {p.fold! + 1} · this example’s root was held out.</p></> : <p>{p.status === "failed" ? "Study failed" : "Insufficient data"} — saved prediction unavailable.</p>}
      </section>)}
      <p>Duration and gap use natural logs. Exponentiating a log prediction gives a point in seconds, not the arithmetic expected duration or gap. Count is a fractional conditional mean, not an ornament label.</p>
      {!revealed && <div className="prediction-reveal"><p>The actual next coda and this example’s errors appear only after Reveal.</p><button className="primary" onClick={() => setRevealed(true)}>Reveal v0.2 actual next coda</button></div>}
      {view.target && <section className="prediction-target" data-testid="research-target" aria-live="polite"><p className="eyebrow">03 · Actual next recorded focal coda</p><h3>{seconds(view.target.duration)} · {view.target.clicks.length} clicks</h3><Marks call={view.target} />
        <p>Row {view.target.sourceLine} · onset {seconds(view.target.onset)} · {seconds(view.gapSeconds!)} after current completion. The whole annotated coda is retained.</p>
        <button onClick={() => setRevealed(false)}>Hide v0.2 actual coda</button>
      </section>}
    </section>
    {revealed && <>
      <section className="lab-panel research-example-controls"><p className="eyebrow">04 · Inspect the same held-out example</p><h2>Older history and prediction errors</h2>
        <p>The older-partner model was fitted separately using earlier completed donors. Its predictions are evaluated on the identical core examples. An individual example is not a study finding.</p>
        {view.predictions.filter(p => p.points).map(p => {
          const r = view.records![p.id]!;
          return <div className="research-control-row" key={p.id}><h3>{RESEARCH_LABELS[p.id].title}</h3><p>Older-partner point: <strong>{p.points!["M2-lagged"].nativePoint.toFixed(4)}</strong> {RESEARCH_LABELS[p.id].point}. Training-mean baseline: {p.points!.M0.nativePoint.toFixed(4)}.</p><p>Self-only loss {r.predictions.M1.loss.toFixed(6)}; recent-partner loss {r.predictions.M2.loss.toFixed(6)}; paired gain {signed(r.gain.M2_vs_M1)} {RESEARCH_LABELS[p.id].unit}.</p></div>;
        })}
      </section>
      <div className="research-results"><p className="eyebrow">05 · All prespecified results</p>{summary.studies.map(s => <Study key={s.id} study={s} summary={summary} />)}</div>
      <Download summary={summary} />
    </>}
  </>;
}
export default function ResearchPrediction({ active }: { active: boolean }) {
  const [summary, setSummary] = useState<ResearchSummary | null>(null), [error, setError] = useState(""), [attempt, setAttempt] = useState(0), [index, setIndex] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/prediction-v02/summary.json", { signal: controller.signal }).then(r => readResearchBytes(r, 262144)).then(bytes => {
      const data = validateResearchSummary(JSON.parse(new TextDecoder().decode(bytes)));
      if (!controller.signal.aborted) { setSummary(data); setError(""); }
    }).catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Research unavailable."); });
    return () => controller.abort();
  }, [attempt]);
  if (error) return <section className="lab-panel" role="status"><h2>v0.2 research unavailable</h2><p>{error}</p><button onClick={() => { setError(""); setAttempt(a => a + 1); }}>Try loading v0.2 again</button></section>;
  if (!summary) return <p role="status">Loading saved v0.2 research…</p>;
  return <div className="prediction-mode research-mode" data-testid="research-mode">
    <p className="prediction-identity">Precomputed held-out research · v0.2</p><h2>Beyond duration categories</h2>
    <p>One fixed exploratory follow-up: duration, click count and time until the next recorded focal coda, plus one duration coverage sensitivity. Reusing the original data makes this exploratory research, not independent confirmation.</p>
    <p className="lab-caption">{summary.studies.filter(s => s.status === "completed").length} of 4 prespecified analyses completed. The original v0.1 result remains available above.</p>
    <label className="prediction-select">Held-out example<select aria-label="Held-out v0.2 example" value={index} onChange={e => setIndex(Number(e.target.value))}>{summary.examples.map((e, i) => <option key={e.id} value={i}>Example {i + 1} · {e.parentGroup} · current row {e.currentRow}</option>)}</select></label>
    <p className="lab-caption">First eligible source-order example in each of the first five lexical roots, fixed before scoring. The three core endpoints share these examples.</p>
    <Example key={summary.examples[index].id} example={summary.examples[index]} summary={summary} active={active} />
    <details className="lab-source-details prediction-source"><summary>v0.2 methods, attribution and limits</summary>
      <p><a href={summary.source.recordUrl}>{summary.source.attribution}</a> · {summary.source.license}. Source annotations are not independently human-reviewed here. Original WAV associations and global caller identities remain unresolved.</p>
      <p>Fixed Ridge regression for log duration/gap; fixed Poisson regression for count. All preprocessing is fitted only on training roots. No fitting, live inference or provider request happens in this view.</p>
      {summary.limitations.map((line, i) => <p key={i}>{line}</p>)}
      <p>Human-authored coda styling can use observed timing as descriptive inspiration. These results do not validate whale-response rules or generation on arbitrary synthetic codas.</p>
      <p>Reveal is a learning aid. Targets exist in public static files; this is not a security boundary.</p>
      <p>Source SHA-256: {summary.source.csvSha256}. Freeze: {summary.provenance.freezeCommit}. Producer: {summary.provenance.producerCommit}. Report SHA-256: {summary.report.sha256}.</p>
    </details>
  </div>;
}
