import { useEffect, useState } from "react";
import { loadNativeReport, type NativeReport } from "./native.ts";
import { downloadJson } from "./download.ts";
export default function NativeSpectrum({ active }: { active: boolean }) {
  const [report, setReport] = useState<NativeReport | null>(null), [error, setError] = useState("");
  const [selected, setSelected] = useState(0), [rate, setRate] = useState(44100);
  useEffect(() => {
    if (!active) return;
    const ac = new AbortController(); setError("");
    loadNativeReport(ac.signal).then(v => { if (!ac.signal.aborted) setReport(v); }).catch(e => { if (!ac.signal.aborted) { setReport(null); setError(e.message); } });
    return () => ac.abort();
  }, [active]);
  const clip = report?.clips[selected], v = clip?.variants.find(v => v.rate === rate);
  const ranking = report?.rankings.find(r => r.id === clip?.id && r.rate === rate);
  return <section aria-labelledby="native-spectrum-title" className="native-spectrum">
    <h2 id="native-spectrum-title">Timing and spectrum of the four original clips</h2>
    <p>Measured from verified original PCM, with separate timing and spectral distances. A 20 ms window around a machine-estimated marker is not a verified biological click.</p>
    {!report && <p role="status">{error || "Loading verified spectral measurements…"}</p>}
    {report && clip && v && ranking && <>
      <div className="spectral-filters"><label>Field recording<select value={selected} onChange={e => setSelected(Number(e.target.value))}>{report.clips.map((c, i) => <option key={c.id} value={i}>{c.source.filename}</option>)}</select></label>
      <label>Measurement sample rate<select value={rate} onChange={e => setRate(Number(e.target.value))}><option value={44100}>44.1 kHz original</option><option value={32000}>32 kHz derived</option><option value={16000}>16 kHz derived</option></select></label></div>
      <p>{v.detectedSeconds.length} detected transient groups · change from original: {v.countDelta} · {v.eligibleWindows} eligible / {v.events.length} original marker windows.</p>
      <p>First-to-last detected span: {v.timing.status === "valid" ? v.timing.measurements.clickSpanSeconds.toFixed(6) + " s" : "unavailable"}. Mean event-window centroid: {v.meanEvent ? v.meanEvent.centroidHz.toFixed(1) + " Hz" : "unavailable"}. Whole-clip centroid: {v.wholeClip.summary ? v.wholeClip.summary.centroidHz.toFixed(1) + " Hz" : "unavailable"}.</p>
      <div className="lab-table-scroll" role="region" aria-label="Separate similarity rankings" tabIndex={0}><table><thead><tr><th>Criterion</th><th>Candidate</th><th>Distance</th></tr></thead><tbody>{(["timing", "spectrum"] as const).flatMap(kind => ranking[kind].length ? ranking[kind].map((r, i) => <tr key={kind + r.id}><td>{i === 0 ? kind === "timing" ? "Normalized interval MAD · same count" : "Event band-fraction L1 · same sample rate" : ""}</td><td>{r.id}</td><td>{r.distance.toFixed(6)}</td></tr>) : [<tr key={kind}><td>{kind}</td><td colSpan={2}>No comparable candidates</td></tr>])}</tbody></table></div>
      <p>Smaller is closer under the named criterion. Spectral ranks may include different click counts. There is no combined similarity score.</p>
      <details><summary>All sample rates, event windows and source binding</summary><pre>{JSON.stringify(clip, null, 2)}</pre></details>
      <button onClick={() => downloadJson({ ...report, selection: { id: clip.id, rate } }, "codabridge-native-spectrum-v1.json")}>Download native spectrum comparison</button>
      <details><summary>Measurement limits</summary><ul>{report.limits.map(l => <li key={l}>{l}</li>)}</ul></details>
    </>}
  </section>;
}
