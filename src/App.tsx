import { useCallback, useEffect, useRef, useState } from "react";
import AudioCard from "./AudioCard.tsx";
import { recordings } from "./domain/catalog.ts";
import type { Recording, Side, ViewMode } from "./domain/types.ts";
import {
  buildEvidence,
  evidenceJson,
  LIMITATIONS,
  timingInput,
} from "./domain/evidence.ts";
import { compareTiming, measureTiming } from "./domain/timing.ts";
import { registerEvidenceTool } from "./webmcp.ts";
import InvestigationPanel from "./InvestigationPanel.tsx";
import { useInvestigation } from "./useInvestigation.ts";
import { measuredObservation } from "./domain/observation.ts";
import Composer, { type ComposerHandle } from "./composer/Composer.tsx";
import { stopSynthetic } from "./composer/sound.ts";

const seconds = (value: number) => `${value.toFixed(3)} s`;

function TimingPlot({
  a,
  b,
  view,
}: {
  a: Recording;
  b: Recording;
  view: ViewMode;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(960);
  useEffect(() => {
    const svg = svgRef.current!;
    const observer = new ResizeObserver(() =>
      setWidth(Math.max(160, svg.getBoundingClientRect().width)),
    );
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const duration =
    view === "normalized"
      ? 1
      : Math.max(a.audio.durationSeconds, b.audio.durationSeconds);
  const x = (fraction: number) => 40 + fraction * (width - 64);
  return (
    <div className="timing-plot">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} 176`}
        role="img"
        aria-label={`${view === "normalized" ? "Normalized" : "Absolute"} click timing for recordings A and B`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => (
          <g key={fraction}>
            <line
              className="plot-grid"
              x1={x(fraction)}
              x2={x(fraction)}
              y1="12"
              y2="134"
            />
            {(width >= 450 ||
              fraction === 0 ||
              fraction === 0.5 ||
              fraction === 1) && (
              <text
                className="axis-label"
                textAnchor={
                  fraction === 1 ? "end" : fraction === 0 ? "start" : "middle"
                }
                x={x(fraction)}
                y="168"
              >
                {(duration * fraction).toFixed(2)}
                {view === "absolute" ? " s" : ""}
              </text>
            )}
          </g>
        ))}
        {[a, b].map((recording, row) => {
          const measured = measureTiming(timingInput(recording));
          if (measured.status !== "valid") return null;
          const positions =
            view === "absolute"
              ? recording.annotation.clickTimesSeconds
              : measured.measurements.normalizedClickPositions;
          const y = row === 0 ? 43 : 110;
          return (
            <g key={row} className={row === 0 ? "side-a" : "side-b"}>
              <text className="plot-side" x="12" y={y + 6}>
                {row === 0 ? "A" : "B"}
              </text>
              <line
                className="plot-track"
                x1={x(positions[0] / duration)}
                x2={x(positions[positions.length - 1] / duration)}
                y1={y}
                y2={y}
              />
              {positions.map((t, i) => (
                <g key={i}>
                  <circle
                    className="plot-click"
                    cx={x(t / duration)}
                    cy={y}
                    r={width < 500 ? 4 : 7}
                  />
                  <text
                    className="plot-number"
                    textAnchor="middle"
                    x={x(t / duration)}
                    y={y - 16}
                  >
                    {i + 1}
                  </text>
                </g>
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function App() {
  const [selection, setSelection] = useState({
    A: recordings[0].id,
    B: recordings[1].id,
  });
  const [view, setView] = useState<ViewMode>("absolute");
  const [downloadStatus, setDownloadStatus] = useState("");
  const [revealed, setRevealed] = useState(false);
  const composer = useRef<ComposerHandle>(null);
  const audioElements = useRef(new Map<Side, HTMLAudioElement>());
  const registerAudio = useCallback(
    (side: Side, element: HTMLAudioElement | null) => {
      if (element) audioElements.current.set(side, element);
      else audioElements.current.delete(side);
    },
    [],
  );
  const stopAudio = useCallback(
    () => audioElements.current.forEach((element) => element.pause()),
    [],
  );
  const select = (side: Side, id: string) => {
    if (!recordings.some((recording) => recording.id === id)) return;
    if (selection[side] === id) return;
    stopAudio();
    stopSynthetic();
    investigation.cancel(
      "Selection changed. Previous investigation is obsolete; ask about this pair.",
    );
    setSelection((current) => ({ ...current, [side]: id }));
    setDownloadStatus("");
  };
  const a = recordings.find((recording) => recording.id === selection.A)!;
  const b = recordings.find((recording) => recording.id === selection.B)!;
  const investigation = useInvestigation(a, b);
  const comparison = compareTiming(timingInput(a), timingInput(b));
  const measurements = [a, b].map((recording) =>
    measureTiming(timingInput(recording)),
  );
  const intervalCount = Math.max(
    ...measurements.map((result) =>
      result.status === "valid"
        ? result.measurements.intervalsSeconds.length
        : 0,
    ),
  );
  const currentEvidence = buildEvidence(
    a,
    b,
    view,
    undefined,
    investigation.result,
  );
  const evidenceRef = useRef(currentEvidence);
  useEffect(() => {
    evidenceRef.current = buildEvidence(
      a,
      b,
      view,
      undefined,
      investigation.result,
    );
  }, [a, b, view, investigation.result]);
  useEffect(
    () =>
      registerEvidenceTool(document.modelContext, () => evidenceRef.current),
    [],
  );

  function download() {
    try {
      const json = evidenceJson(currentEvidence);
      const url = URL.createObjectURL(
        new Blob([json], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `codabridge-${a.id}-${b.id}-${view}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadStatus(
        "Evidence download requested for the current selection.",
      );
    } catch (cause) {
      setDownloadStatus(
        cause instanceof Error ? cause.message : "Evidence download failed.",
      );
    }
  }

  return (
    <>
      <a className="skip-link" href="#workspace">
        Skip to comparison
      </a>
      <header className="site-header">
        <a href="#" className="wordmark" aria-label="CodaBridge home">
          <span className="brand-mark" aria-hidden="true">
            ı┃ı┃ı
          </span>
          CodaBridge
        </a>
        <span className="edition">
          Coda Composer <span> / </span> Listen · Make · Keep
        </span>
      </header>
      <main id="workspace">
        <div className="intro">
          <div>
            <p className="eyebrow">A small window into sound</p>
            <h1>
              Hear a pattern. <em>Make it yours.</em>
            </h1>
            <p>
              Listen to real sperm whale recordings. Shape their timing into a
              personal, synthetic phrase.
            </p>
          </div>
          <button className="export-button" onClick={download}>
            Download evidence <span aria-hidden="true">↓</span>
          </button>
        </div>
        <div className="workspace-label" id="listen">
          <span>
            01 <strong>Listen</strong>
          </span>
          <span>
            Original audio · DSWP ·{" "}
            <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
          </span>
        </div>
        <div className="recordings-grid">
          {(["A", "B"] as const).map((side) => (
            <AudioCard
              key={`${side}-${selection[side]}`}
              side={side}
              recording={side === "A" ? a : b}
              recordings={recordings}
              onSelect={(id) => select(side, id)}
              registerAudio={registerAudio}
              onMake={() =>
                composer.current?.makeVersion(side === "A" ? a.id : b.id)
              }
              onPlay={(element) => {
                stopSynthetic();
                audioElements.current.forEach((other) => {
                  if (other !== element) other.pause();
                });
              }}
            />
          ))}
        </div>
        <div className="listen-impression">
          <label>
            What do you hear? <span>(a personal impression)</span>
            <input
              aria-label="My listening impression"
              maxLength={160}
              placeholder="Even, uneven, a pause…"
            />
          </label>
          <button
            className="reveal-measurements"
            onClick={() => setRevealed((v) => !v)}
            aria-expanded={revealed}
            aria-controls="field-measurements"
          >
            {revealed ? "Hide measurements" : "Reveal measurements"}
          </button>
        </div>
        <div id="field-measurements" hidden={!revealed}>
          <section className="comparison-panel" aria-labelledby="compare-title">
            <div className="comparison-heading">
              <div>
                <p className="eyebrow">02 Compare</p>
                <h2 id="compare-title">The rhythm, made visible.</h2>
              </div>
              <fieldset className="view-toggle">
                <legend className="sr-only">Timing view</legend>
                {(["absolute", "normalized"] as const).map((mode) => (
                  <label key={mode} className={view === mode ? "selected" : ""}>
                    <input
                      type="radio"
                      name="view"
                      value={mode}
                      checked={view === mode}
                      onChange={() => {
                        setView(mode);
                        setDownloadStatus("");
                      }}
                    />
                    {mode === "absolute" ? "Absolute" : "Normalized"}
                  </label>
                ))}
              </fieldset>
            </div>
            <p className="view-explanation">
              {view === "absolute"
                ? "Seconds from each original file’s start. Each dot is a machine-estimated click peak."
                : "First click = 0, last click = 1. Compare spacing independent of offset and total click span. Audio stays at original speed."}
            </p>
            <TimingPlot a={a} b={b} view={view} />
            <p className="measured-observation">
              <strong>Measured · not AI-generated</strong>{" "}
              {measuredObservation(timingInput(a), timingInput(b))}
            </p>
            <div className="measurement-strip">
              {measurements.map((result, index) => (
                <div key={index} className={index === 0 ? "side-a" : "side-b"}>
                  <span className="measure-label">
                    {index === 0 ? "A" : "B"} · Click-span duration
                  </span>
                  <strong>
                    {result.status === "valid"
                      ? seconds(result.measurements.clickSpanSeconds)
                      : "Invalid timing"}
                  </strong>
                </div>
              ))}
              <div className="metric-result" aria-live="polite">
                <span className="measure-label">
                  Normalized interval MAD{" "}
                  <span className="metric-version">v1.0.0</span>
                </span>
                <strong data-testid="metric-value">
                  {comparison.status === "comparable"
                    ? comparison.value.toFixed(6)
                    : "Not comparable"}
                </strong>
              </div>
            </div>
            <p className="metric-caption">
              {comparison.status === "comparable"
                ? "Mean absolute normalized interval difference. Smaller means closer under this timing metric."
                : comparison.reason}{" "}
              {a.id === b.id && (
                <strong>Same recording selected in A and B.</strong>
              )}
            </p>
            <details className="interval-details">
              <summary>
                Measured intervals{" "}
                <span>
                  {view === "absolute" ? "seconds" : "fraction of click span"}
                </span>
              </summary>
              <div
                className="table-scroll"
                role="region"
                aria-label="Interval measurements; scroll horizontally for all intervals"
                tabIndex={0}
              >
                <table>
                  <caption className="sr-only">
                    Intervals between consecutive estimated clicks
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Click interval</th>
                      {Array.from({ length: intervalCount }, (_, i) => (
                        <th scope="col" key={i}>
                          {i + 1} → {i + 2}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {measurements.map((result, i) => (
                      <tr key={i}>
                        <th scope="row">
                          <span className={i === 0 ? "text-a" : "text-b"}>
                            {i === 0 ? "A" : "B"}
                          </span>{" "}
                          / {i === 0 ? a.source.filename : b.source.filename}
                        </th>
                        {result.status === "valid" ? (
                          Array.from({ length: intervalCount }, (_, index) => {
                            const values =
                              view === "absolute"
                                ? result.measurements.intervalsSeconds
                                : result.measurements.normalizedIntervals;
                            return (
                              <td key={index}>
                                {values[index] === undefined
                                  ? "—"
                                  : values[index].toFixed(
                                      view === "absolute" ? 3 : 4,
                                    )}
                              </td>
                            );
                          })
                        ) : (
                          <td>{result.reason}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </section>
        </div>
        <Composer
          ref={composer}
          stopField={stopAudio}
          fieldSelection={`${selection.A}:${selection.B}`}
          onExample={(id) => select("B", id)}
        />
        <div className="bottom-grid">
          <details className="evidence-panel">
            <summary>
              <span>
                <span className="eyebrow">03 Inspect</span>
                <strong>Follow the evidence</strong>
              </span>
              <span aria-hidden="true">＋</span>
            </summary>
            <p>
              Original timestamps, full source provenance, and unrounded
              measurements for the current selection.
            </p>
            <ul>
              {LIMITATIONS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <pre aria-label="Current evidence JSON">
              {evidenceJson(currentEvidence)}
            </pre>
          </details>
          <InvestigationPanel investigation={investigation} />
        </div>
        <p className="download-status" role="status">
          {downloadStatus}
        </p>
      </main>
      <footer>
        <span>CodaBridge · Listen closely. Keep the evidence.</span>
        <span>Acoustic distance is not a translation.</span>
      </footer>
    </>
  );
}
