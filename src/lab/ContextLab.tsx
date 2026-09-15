import Notice, { useNotice } from "../Notice.tsx";
import AstraActivity from "../astra/AstraActivity.tsx";
import AstraEvidence, { AstraCitations, type AstraEvidenceHandle } from "../astra/AstraEvidence.tsx";
import { ASTRA_REQUEST_FAILED, astraUnavailableCopy } from "../astra/copy.ts";
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { flushSync } from "react-dom";
import {
  contextSegment as segment,
  contextSource,
  DATASET_ID,
  DEFAULT_LAB_QUESTION,
  labBinding,
} from "./catalog.ts";
import {
  comparePairing,
  LAB_LIMITATIONS,
  ordered,
  overlapPairs,
} from "./model.ts";
import { renderExchange } from "./sound.ts";
import { SyntheticPlayer } from "../composer/sound.ts";
import { deliver } from "../composer/project.ts";
import { investigationCard, investigationPacket } from "./export.ts";
import type { LabRequest, LabResult } from "./contract.ts";
import ScoreChart from "./ScoreChart.tsx";
import Prediction from "./Prediction.tsx";
import { pairingFinding } from "./presentation.ts";
import "./lab.css";
import Atlas, { type AtlasEntry } from "../atlas/Atlas.tsx";

const seconds = (n: number | null, precision = 4) =>
  n === null ? "Unavailable" : `${n.toFixed(precision)} s`;
const calls = ordered(segment.calls),
  pairs = overlapPairs(segment);
const initialRow = pairs[0]?.aId ?? calls[0].id;
const initialWindow = Math.max(
  segment.start,
  Math.min(segment.end - 20, calls.find((c) => c.id === initialRow)!.onset - 3),
);
const label = (id: string) => {
  const c = calls.find((c) => c.id === id)!;
  return `${c.caller === segment.callers[0] ? "A" : "B"} · row ${c.sourceLine}`;
};

export type ContextLabHandle = { investigate: () => void };

export default function ContextLab({
  active,
  onReturn,
  stopField,
  atlasEntry,
  ref,
}: {
  active: boolean;
  onReturn: () => void;
  stopField: () => void;
  atlasEntry?: AtlasEntry;
  ref?: Ref<ContextLabHandle>;
}) {
  const [panel, setPanel] = useState<"explore" | "compare" | "save">("explore");
  const [mode, setMode] = useState<"descriptive" | "prediction" | "atlas">("descriptive");
  useEffect(() => { if (atlasEntry) setMode("atlas"); }, [atlasEntry]);
  const region = useRef<HTMLElement>(null);
  const [selectedId, setSelectedId] = useState(initialRow),
    [offset, setOffset] = useState(0);
  const [windowStart, setWindowStart] = useState(initialWindow),
    [windowSize, setWindowSize] = useState(20);
  const [muted, setMuted] = useState<string[]>([]),
    [playback, setPlayback] = useState("Synthetic playback stopped");
  const [question, setQuestion] = useState(DEFAULT_LAB_QUESTION),
    [available, setAvailable] = useState(false);
  const [pending, setPending] = useState(false),
    [result, setResult] = useState<LabResult | null>(null),
    [notice, setNotice] = useNotice();
  const [requestFeedback, setRequestFeedback] = useState<"ready" | "failed" | "cancelled">("ready");
  const [unavailableMessage, setUnavailableMessage] = useState(astraUnavailableCopy());
  const evidence = useRef<AstraEvidenceHandle>(null);
  const player = useRef<SyntheticPlayer | null>(null),
    controller = useRef<AbortController | null>(null),
    generation = useRef(0);
  const key = labBinding(offset, selectedId),
    currentKey = useRef(key);
  currentKey.current = key;
  const cancel = useCallback(() => {
    generation.current++;
    controller.current?.abort();
    controller.current = null;
    setPending(false);
    setResult(null);
    setRequestFeedback("ready");
  }, []);
  useEffect(() => {
    player.current = new SyntheticPlayer(setPlayback);
    return () => {
      player.current?.stop();
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!active) {
      cancel();
      player.current?.stop();
    }
  }, [active, cancel]);
  useEffect(() => {
    const ac = new AbortController();
    fetch("/api/investigation/status", { signal: ac.signal })
      .then((r) => r.json())
      .then((r) => {
        if (!ac.signal.aborted) {
          setAvailable(r.status === "available");
          setUnavailableMessage(astraUnavailableCopy(r));
        }
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);
  const comparison = comparePairing(segment, offset),
    selected = calls.find((c) => c.id === selectedId)!;
  const selectedControl = comparison.controls.find(control => control.offset === offset);
  const end = Math.min(segment.end, windowStart + windowSize),
    width = 1000;
  const x = (time: number) =>
    65 + ((time - windowStart) / (end - windowStart)) * (width - 90);
  const visible = calls.filter(
    (c) => c.onset < end && c.onset + c.duration >= windowStart,
  );
  const neighbors = calls.slice(
    Math.max(0, calls.indexOf(selected) - 2),
    calls.indexOf(selected) + 3,
  );
  function change(action: () => void) {
    cancel();
    player.current?.stop();
    setNotice("");
    action();
  }
  async function play() {
    stopField();
    try {
      await player.current?.playRendered(
        renderExchange(segment, windowStart, end, muted).samples,
      );
    } catch {
      setNotice(
        "Timing audio could not start. Visual exploration and saving remain available.", "warning",
      );
    }
  }
  async function ask() {
    if (!active || pending || !available || !question.trim()) return;
    cancel();
    setNotice("");
    const token = generation.current,
      bound = key,
      ac = new AbortController();
    controller.current = ac;
    setPending(true);
    let failureMessage = ASTRA_REQUEST_FAILED;
    const input: LabRequest = {
      datasetId: DATASET_ID,
      segmentId: segment.id,
      callers: [...segment.callers],
      offset,
      selectedRowId: selectedId,
      binding: bound,
      question,
    };
    try {
      const response = await fetch("/api/lab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: ac.signal,
      });
      const value = await response.json();
      if (
        token !== generation.current ||
        currentKey.current !== bound ||
        ac.signal.aborted
      )
        return;
      if (
        !response.ok ||
        value.status !== "completed" ||
        value.binding !== bound
      ) {
        if (value.status === "unavailable") failureMessage = astraUnavailableCopy(value);
        throw new Error("Rejected");
      }
      setResult(value as LabResult);
    } catch {
      if (token === generation.current && !ac.signal.aborted) {
        setRequestFeedback("failed");
        setNotice(
          failureMessage, "warning",
        );
      }
    } finally {
      if (token === generation.current) setPending(false);
    }
  }
  async function save(kind: "json" | "card") {
    try {
      const packet = investigationPacket(question, offset, selectedId, result);
      const blob =
        kind === "json"
          ? new Blob([JSON.stringify(packet, null, 2)], {
              type: "application/json",
            })
          : await investigationCard(packet);
      deliver(
        blob,
        `codabridge-context-offset-${offset}.${kind === "json" ? "json" : "png"}`,
      );
      setNotice(
        "Investigation download requested. Saved analysis is a historical snapshot.",
      );
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Download failed.", "warning");
    }
  }
  function showPanel(next: typeof panel) {
    player.current?.stop();
    flushSync(() => setPanel(next));
    region.current?.scrollIntoView({ block: "start" });
    region.current?.focus({ preventScroll: true });
  }
  useImperativeHandle(ref, () => ({
    investigate() {
      change(() => {
        flushSync(() => { setMode("descriptive"); setPanel("compare"); });
        region.current?.scrollIntoView({ block: "start" });
        region.current?.focus({ preventScroll: true });
      });
    },
  }));
  const modeButtons = <nav className="lab-modes" aria-label="Context Lab mode">
    <button aria-pressed={mode === "descriptive"} onClick={() => change(() => { stopField(); setMode("descriptive"); })}>Descriptive pairing</button>
    <button aria-pressed={mode === "prediction"} onClick={() => change(() => { stopField(); setMode("prediction"); })}>Dialogue Transfer / Prediction</button>
    <button aria-pressed={mode === "atlas"} onClick={() => change(() => { stopField(); setMode("atlas"); })}>Timing / Style Atlas</button>
  </nav>;
  if (mode === "atlas") return <section ref={region} tabIndex={-1} className="context-lab" hidden={!active} aria-labelledby="lab-title">
    <div className="lab-heading"><div><p className="eyebrow">Context Lab / Observed timing</p><h1 id="lab-title">Timing / <em>Style Atlas</em></h1></div><button onClick={onReturn}>← Return to my Composer</button></div>
    {modeButtons}<Atlas active={active} entry={atlasEntry} stopField={stopField} />
  </section>;
  if (mode === "prediction") return <section ref={region} tabIndex={-1} className="context-lab" hidden={!active} aria-labelledby="lab-title">
    <div className="lab-heading"><div><p className="eyebrow">Context Lab / Dialogue Transfer</p><h1 id="lab-title">Can past calls help <em>predict?</em></h1></div><button onClick={onReturn}>← Return to my Composer</button></div>
    {modeButtons}<Prediction active={active} />
  </section>;
  return (
    <section
      ref={region}
      tabIndex={-1}
      className="context-lab"
      hidden={!active}
      aria-labelledby="lab-title"
    >
      <div className="lab-heading">
        <div>
          <p className="eyebrow">Context Lab / Research annotations</p>
          <h1 id="lab-title">
            Does the pairing <em>matter?</em>
          </h1>
          <p hidden={panel !== "explore"}>
            Explore an annotated exchange. Test how call-duration comparisons
            change when measured durations are reassigned.
          </p>
        </div>
        <button onClick={onReturn}>← Return to my Composer</button>
      </div>
      {modeButtons}
      <p hidden={panel !== "explore"} className="lab-source-note">
        A source-annotated exchange, separate from your creation and our four
        field clips.{" "}
        <a href={contextSource.recordUrl}>Sharma et al. · Zenodo release</a> ·
        CC BY 4.0
      </p>
      <nav className="workspace-steps" aria-label="Context Lab steps">
        <button aria-pressed={panel === "explore"} onClick={() => showPanel("explore")}>Explore exchange</button>
        <button aria-pressed={panel === "compare"} onClick={() => showPanel("compare")}>Compare pairings</button>
        <button aria-pressed={panel === "save"} onClick={() => showPanel("save")}>Save investigation</button>
      </nav>
      {panel !== "compare" && <Notice className="lab-notice" message={notice} />}
      <section hidden={panel !== "explore"} className="lab-panel" aria-labelledby="exchange-title">
        <div className="lab-section-heading">
          <div>
            <p className="eyebrow">01 Explore & listen</p>
            <h2 id="exchange-title">Two callers. One minute.</h2>
          </div>
          <span>
            {calls.length} annotated codas ·{" "}
            {(segment.end - segment.start).toFixed(0)} s segment
          </span>
        </div>
        <p className="reconstruction-label">
          Timing reconstruction from research annotations — not the original
          recording.
        </p>
        <div className="segment-overview" aria-label={`Viewing ${windowSize} seconds of the fixed 60-second segment`}>
          <div><strong>Full fixed segment · 60 s</strong><span>Zoomed view · {windowSize} s</span></div>
          <div className="segment-track" aria-hidden="true"><span style={{left: `${(windowStart - segment.start) / (segment.end - segment.start) * 100}%`, width: `${(end - windowStart) / (segment.end - segment.start) * 100}%`}} /></div>
          <p className="lab-caption">Showing {seconds(windowStart, 2)}–{seconds(end, 2)} from the source file. All comparisons use the full {seconds(segment.start, 2)}–{seconds(segment.end, 2)} segment.</p>
        </div>
        <div className="lab-window-controls">
          <label>
            View window
            <select
              aria-label="Exchange window length"
              value={windowSize}
              onChange={(e) =>
                change(() => {
                  const size = Number(e.target.value);
                  setWindowSize(size);
                  setWindowStart(Math.min(windowStart, segment.end - size));
                })
              }
            >
              {[10, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {n} seconds
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={windowStart <= segment.start}
            onClick={() =>
              change(() =>
                setWindowStart(
                  Math.max(segment.start, windowStart - windowSize / 2),
                ),
              )
            }
          >
            Earlier window
          </button>
          <button
            disabled={end >= segment.end}
            onClick={() =>
              change(() =>
                setWindowStart(
                  Math.min(
                    segment.end - windowSize,
                    windowStart + windowSize / 2,
                  ),
                ),
              )
            }
          >
            Later window
          </button>
          <button
            onClick={() =>
              change(() =>
                setWindowStart(
                  Math.max(
                    segment.start,
                    Math.min(segment.end - windowSize, selected.onset - 3),
                  ),
                ),
              )
            }
          >
            Zoom to selected coda
          </button>
        </div>
        <div
          className="lab-timeline-scroll"
          role="region"
          aria-label="Scrollable exchange timeline"
          tabIndex={0}
        >
          <svg
            className="exchange-timeline"
            viewBox="0 0 1000 245"
            role="img"
            aria-label={`Two caller lanes, ${windowStart.toFixed(4)} to ${end.toFixed(4)} seconds from source recording start. Highlighted regions have positive cross-caller overlap.`}
          >
            <defs>
              <clipPath id="lab-window-clip">
                <rect x="65" y="15" width="910" height="180" />
              </clipPath>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line
                  className="lab-grid"
                  x1={65 + t * 910}
                  x2={65 + t * 910}
                  y1="15"
                  y2="195"
                />
                <text
                  x={65 + t * 910}
                  y="228"
                  textAnchor={t === 1 ? "end" : "middle"}
                >
                  {(windowStart + t * (end - windowStart)).toFixed(2)} s
                </text>
              </g>
            ))}
            {segment.callers.map((caller, i) => (
              <g key={caller}>
                <text className={`caller-${i}`} x="10" y={72 + i * 100}>
                  {i === 0 ? "A" : "B"}
                </text>
                <line
                  className="lab-track"
                  x1="65"
                  x2="975"
                  y1={68 + i * 100}
                  y2={68 + i * 100}
                />
              </g>
            ))}
            <g clipPath="url(#lab-window-clip)">
              {pairs.map((p) => {
                const a = calls.find((c) => c.id === p.aId)!,
                  b = calls.find((c) => c.id === p.bId)!;
                const start = Math.max(a.onset, b.onset),
                  finish = Math.min(a.onset + a.duration, b.onset + b.duration);
                return (
                  <rect
                    key={`${p.aId}:${p.bId}`}
                    className="overlap-band"
                    x={x(start)}
                    y="20"
                    width={x(finish) - x(start)}
                    height="175"
                  />
                );
              })}
              {visible.map((c) => {
                const lane = segment.callers.indexOf(c.caller),
                  y = 68 + lane * 100;
                return (
                  <g
                    key={c.id}
                    className={`caller-${lane} ${c.id === selectedId ? "selected-coda" : ""}`}
                  >
                    <rect
                      x={x(c.onset)}
                      y={y - 21}
                      width={Math.max(2, x(c.onset + c.duration) - x(c.onset))}
                      height="42"
                      rx="5"
                    />
                    <line
                      x1={x(c.onset)}
                      x2={x(c.onset + c.duration)}
                      y1={y}
                      y2={y}
                    />
                    {c.clicks.map((t, i) => (
                      <line
                        className="click-mark"
                        key={i}
                        x1={x(c.onset + t)}
                        x2={x(c.onset + t)}
                        y1={y - 12}
                        y2={y + 12}
                      />
                    ))}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
        <p className="lab-caption">
          A and B are local caller labels. Marks are annotated clicks; shaded areas are overlapping calls. Scroll the timeline to see the zoomed window. Reassigning durations never changes this recording timeline or its reconstructed sound.
        </p>
        <div className="lab-audio">
          <button
            className="primary"
            disabled={muted.length === 2}
            onClick={() => void play()}
          >
            Play annotated timing window
          </button>
          <button onClick={() => player.current?.stop()}>
            Stop reconstruction
          </button>
          {segment.callers.map((caller, i) => (
            <div key={caller}>
              <label>
                <input
                  type="checkbox"
                  checked={muted.includes(caller)}
                  onChange={() =>
                    change(() =>
                      setMuted((m) =>
                        m.includes(caller)
                          ? m.filter((c) => c !== caller)
                          : [...m, caller],
                      ),
                    )
                  }
                />
                Mute caller {i === 0 ? "A" : "B"}
              </label>
              <button
                onClick={() =>
                  change(() =>
                    setMuted(segment.callers.filter((c) => c !== caller)),
                  )
                }
              >
                Solo {i === 0 ? "A" : "B"}
              </button>
            </div>
          ))}
          <button onClick={() => change(() => setMuted([]))}>
            Hear both callers
          </button>
        </div>
        <p role="status" className="lab-caption">
          {playback} · conservative combined gain · no animal-voice synthesis
        </p>
        <div className="lab-selected">
          <label>
            Selected coda
            <select
              aria-label="Selected exchange coda"
              value={selectedId}
              onChange={(e) => change(() => setSelectedId(e.target.value))}
            >
              {calls.map((c) => (
                <option key={c.id} value={c.id}>
                  {label(c.id)}
                </option>
              ))}
            </select>
          </label>
          <p>
            <strong>{label(selected.id)}</strong> · local source caller{" "}
            {selected.caller}
            <br />
            {selected.clicks.length} clicks · span {seconds(selected.duration)}
            <br />
            Onset {seconds(selected.onset)} → end{" "}
            {seconds(selected.onset + selected.duration)}
          </p>
        </div>
        <div className="lab-neighbors" aria-label="Neighboring annotated calls">
          {neighbors.map((c) => (
            <button
              key={c.id}
              aria-pressed={c.id === selectedId}
              onClick={() => change(() => setSelectedId(c.id))}
            >
              {label(c.id)} · {seconds(c.onset, 2)}
            </button>
          ))}
        </div>
        <details>
          <summary>Inspect selected source row and timing</summary>
          <p>
            Unchanged CSV line {selected.sourceLine}; nClicks−1 true intervals,
            padded zeros excluded. Span is reconstructed from ICIs; reported
            Duration {seconds(selected.declaredDuration, 7)} is retained
            separately. No long coda was truncated to Composer’s marker limit.
          </p>
          <pre>{JSON.stringify(selected, null, 2)}</pre>
        </details>
        <button className="primary lab-next" onClick={() => showPanel("compare")}>Compare the duration pairings →</button>
      </section>
      <section hidden={panel !== "compare"} className="lab-panel" aria-labelledby="pairing-title">
        <p className="eyebrow">02 Change the comparison</p>
        <h2 id="pairing-title">Keep the calls. Reassign the durations.</h2>
        <p>
          Compare how long the calls last, not how quickly one caller responds.
          Keep all {comparison.pairCount} original overlap pairs from the full 60-second segment.
          Reassign B’s durations to those same slots; the calls and their timing stay fixed.
        </p>
        <p className="pairing-finding"><strong>{pairingFinding(comparison)}</strong> This is a descriptive comparison, not a probability or a test of whether whales communicate.</p>
        <div className="comparison-visuals">
        <ScoreChart comparison={comparison} onSelect={(value) => change(() => setOffset(value))} />
        <div>
        <div className="lab-control-detail">
        <label className="lab-offset">
          Duration assignment
          <select
            aria-label="Duration assignment" aria-describedby="control-assignment-description"
            value={offset}
            onChange={(e) => change(() => setOffset(Number(e.target.value)))}
          >
            <option value={0}>Observed</option>
            {comparison.controls.map((c) => (
              <option key={c.offset} value={c.offset}>
                Control {c.offset}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => change(() => setOffset(0))}>
          Reset to observed
        </button>
        <p className="lab-caption" id="control-assignment-description">
          {offset === 0 ? "Original duration assignments." : `B durations rotate by ${offset}; original calls stay fixed.`}
          {selectedControl?.equivalentToOffset != null ? ` Equivalent to offset ${selectedControl.equivalentToOffset}.` : ""}
        </p>
        </div>
        <div
          className="lab-statistics"
          aria-label="Deterministic duration comparison"
        >
          <div>
            <span>Observed duration difference</span>
            <strong data-testid="lab-observed">
              {seconds(comparison.observed.valueSeconds, 3)}
            </strong>
          </div>
          <div>
            <span>
              {offset === 0
                ? "Observed reset"
                : "Selected reassignment control"}
            </span>
            <strong data-testid="lab-selected-score">
              {seconds(comparison.selected.valueSeconds, 3)}
            </strong>
          </div>
          <div>
            <span>Median of controls</span>
            <strong>
              {seconds(comparison.controlSummary?.medianSeconds ?? null, 3)}
            </strong>
          </div>
        </div>
        <p className="lab-measured">
          <strong>Computed from annotations · not AI-generated.</strong>{" "}
          {offset === 0
            ? "Offset zero uses the original duration assignments."
            : `Control ${offset} changes the assignments only; all original pair slots and click times remain fixed.`}
        </p>
        {comparison.controlSummary && (
          <p>
            Control range: {seconds(comparison.controlSummary.minSeconds, 3)} to{" "}
            {seconds(comparison.controlSummary.maxSeconds, 3)}.{" "}
            {comparison.distinctControlCount} distinct controls;{" "}
            {comparison.equivalentControlCount} equivalent rotations.{" "}
            {comparison.controlSummary.minSeconds ===
              comparison.controlSummary.maxSeconds &&
              "All control scores coincide."}
          </p>
        )}
        <p>
          {comparison.pairCount} pairs · {comparison.uniqueCallCount} unique
          participating calls · {comparison.aCallCount} A /{" "}
          {comparison.bCallCount} B calls in the segment. Reused calls are not
          independent samples.
        </p>
        {comparison.reason && (
          <p role="status">
            Insufficient data for this control: {comparison.reason}. Unavailable
            values are not zero effects.
          </p>
        )}
        <div className="control-example">
          <strong>
            {offset === 0
              ? "One observed pair"
              : "One reassigned comparison — not a recording"}
          </strong>
          {comparison.selected.pairs.slice(0, 1).map((p) => (
            <div className="pair-illustration" key={p.aId}>
              <div><span>Fixed A call</span><strong>{label(p.aId)}</strong><span>{seconds(p.aDurationSeconds, 3)}</span></div>
              <span className="pair-symbol" aria-hidden="true">↔</span>
              <div><span>Fixed B slot</span><strong>{label(p.bId)}</strong><span>Original {seconds(p.originalBDurationSeconds, 3)}</span></div>
              <div className="assigned-duration"><span>{offset === 0 ? "Original duration used" : "Duration reassigned from"}</span><strong>{label(p.durationFromRowId)} · {seconds(p.assignedBDurationSeconds, 3)}</strong><span>Pair’s duration difference: {seconds(p.absoluteDifferenceSeconds, 3)}</span></div>
            </div>
          ))}
          <p className="lab-caption">Illustration of the first fixed pair; separate from the selected coda and zoomed view. Only the B duration used in the calculation changes. No call moves or becomes a new recording.</p>
        </div>
        </div>
        </div>
        <details>
          <summary>
            All fixed pairs, reassigned source rows and control values
          </summary>
          <div
            className="lab-table-scroll"
            role="region"
            aria-label="Pair assignments"
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>A row / seconds</th>
                  <th>Original B slot / seconds</th>
                  <th>Duration from B row / seconds</th>
                  <th>Absolute difference</th>
                </tr>
              </thead>
              <tbody>
                {comparison.selected.pairs.map((p) => (
                  <tr key={`${p.aId}:${p.bId}`}>
                    <td>
                      {p.aSourceLine} / {p.aDurationSeconds.toFixed(6)}
                    </td>
                    <td>
                      {p.bSlotSourceLine} /{" "}
                      {p.originalBDurationSeconds.toFixed(6)}
                    </td>
                    <td>
                      {p.durationFromSourceLine} /{" "}
                      {p.assignedBDurationSeconds.toFixed(6)}
                    </td>
                    <td>{p.absoluteDifferenceSeconds.toFixed(6)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <pre>{JSON.stringify(comparison, null, 2)}</pre>
        </details>
        <p className="lab-caption">
          Duration can be compared across unequal click counts. This answers a
          different question from Composer’s unchanged equal-count
          normalized-rhythm metric. Method: {comparison.method}.
        </p>
        <details>
          <summary>What this comparison cannot establish</summary>
          <ul>
            {LAB_LIMITATIONS.slice(1).map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </details>
      </section>
      <section hidden={panel !== "compare"} className="lab-panel lab-ask" aria-labelledby="lab-ask-title">
        <p className="eyebrow">03 Ask about the evidence · optional</p>
        <h2 id="lab-ask-title">What else could explain this?</h2>
        {available && <p>Ask about this exchange and its duration comparison. The answer is generated and unverified.</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <label>
            Context question
            <textarea
              aria-label="Context question"
              maxLength={800}
              value={question}
              onChange={(e) => {
                cancel();
                setQuestion(e.target.value);
              }}
            />
          </label>
          <button
            className="primary"
            disabled={!available || pending || !question.trim()}
          >
            {pending
              ? "Waiting for Astra…"
              : "Ask Astra"}
          </button>
          {pending && (
            <button type="button" onClick={() => {
              cancel();
              setRequestFeedback("cancelled");
              setNotice("Request canceled. No answer was accepted.");
            }}>
              Cancel Context request
            </button>
          )}
        </form>
        <AstraActivity
          state={pending ? "pending" : result ? "completed" : !available ? "unavailable" : requestFeedback}
          active={active && panel === "compare"}
        >
          <p role="status">{pending ? "Astra request in progress…" : result ? "Answer ready" : ""}</p>
          {!pending && !result && requestFeedback === "ready" && <p>{available
            ? "Ready when you are."
            : unavailableMessage}</p>}
          {panel === "compare" && <Notice className="lab-notice" message={notice} />}
        </AstraActivity>
        {result && (
          <div className="lab-result" data-testid="lab-result">
            <p className="result-label">
              {result.execution === "mock-transport-test"
                ? "TEST ONLY · provider transport fixture · no live Astra call"
                : "Astra provider result · generated and unverified"}
            </p>
            <details className="exact-answer" open>
            <summary>Exact generated answer · unverified</summary>
            {[
              ...result.explanation.possibleInterpretations,
              ...result.explanation.limitations,
            ].map((r, i) => (
              <p key={i}>{r.text}<AstraCitations ids={r.evidenceIds} evidence={result.evidence}
                onInspect={index => evidence.current?.inspect(index)} /></p>
            ))}
            </details>
            <AstraEvidence ref={evidence} actions={result.actions} evidence={result.evidence}
              summary="Exact generated answer, citations, evidence and receipts">
              <pre>{JSON.stringify({
                execution: result.execution,
                explanation: result.explanation,
                comparison: result.comparison,
                providerResponses: result.providerResponses,
              }, null, 2)}</pre>
            </AstraEvidence>
          </div>
        )}
        <button className="lab-next" onClick={() => showPanel("save")}>Save this investigation →</button>
      </section>
      <section hidden={panel !== "save"} className="lab-panel lab-save" aria-labelledby="lab-save-title">
        <p className="eyebrow">04 Keep the investigation</p>
        <h2 id="lab-save-title">A question worth keeping.</h2>
        <p>
          Keep a readable PNG card and a JSON snapshot with the full precision,
          source rows, pair mappings and any exact generated answer. The card is an image, not audio.
          Saved interpretation is historical, never a new live run.
        </p>
        <label className="save-question">Investigation question
          <textarea value={question} maxLength={800} onChange={(e) => { cancel(); setQuestion(e.target.value); }} />
        </label>
        <div className="investigation-takeaway">
          <p className="eyebrow">Computed from research annotations</p>
          <h3>{pairingFinding(comparison)}</h3>
          <p>Observed {seconds(comparison.observed.valueSeconds, 3)} · {offset === 0 ? "Original pairing" : `Control ${offset}`} {seconds(comparison.selected.valueSeconds, 3)} · {comparison.pairCount} fixed pairs</p>
          <p>Duration difference is not response latency. This control does not establish meaning or causality.</p>
          <p className="lab-caption">Sharma et al. / DSWP · CC BY 4.0 · Reconstruction from annotations; no original exchange audio.</p>
        </div>
        <div className="download-options">
          <button className="primary" onClick={() => void save("card")}>
            Download investigation card
          </button>
          <button onClick={() => void save("json")}>
            Download investigation JSON
          </button>
          <button onClick={onReturn}>
            Return to Composer with my creation
          </button>
        </div>
      </section>
      <details className="lab-source-details">
        <summary>Source audit, license and prediction mode</summary>
        <p>
          Archived release {contextSource.version}, DOI {contextSource.doi};{" "}
          {contextSource.annotation}. {contextSource.timeOrigin}
        </p>
        <p>
          3,840 source rows; 3,790 pass the documented strict quality rules. The
          paper describes a 3,948-coda temporal subset; that difference remains
          unresolved. This window was selected by REC/onset order and coverage,
          before computing any effect.
        </p>
        <p>
          {contextSource.attribution} CC BY 4.0. The separate Dialogue Transfer /
          Prediction mode presents the bounded precomputed held-out experiment;
          this descriptive control remains a different analysis.
        </p>
        <p>
          Source CSV SHA-256: {contextSource.csvSha256}. Original selected rows
          and transformations are in the downloaded JSON and repository audit.
        </p>
      </details>
    </section>
  );
}
