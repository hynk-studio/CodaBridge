import { useCallback, useEffect, useRef, useState } from "react";
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
import "./lab.css";

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

export default function ContextLab({
  active,
  onReturn,
  stopField,
}: {
  active: boolean;
  onReturn: () => void;
  stopField: () => void;
}) {
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
    [notice, setNotice] = useState("");
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
        if (!ac.signal.aborted) setAvailable(r.status === "available");
      })
      .catch(() => {});
    return () => ac.abort();
  }, []);
  const comparison = comparePairing(segment, offset),
    selected = calls.find((c) => c.id === selectedId)!;
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
        "Timing audio could not start. Visual exploration and saving remain available.",
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
      )
        throw new Error("Rejected");
      setResult(value as LabResult);
    } catch {
      if (token === generation.current && !ac.signal.aborted)
        setNotice(
          "Astra's result could not be accepted. The measured comparison is unchanged.",
        );
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
      setNotice(error instanceof Error ? error.message : "Download failed.");
    }
  }
  return (
    <section
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
          <p>
            These two callers’ sounds seem to last a similar amount of time.
            Does that depend on which calls we compare?
          </p>
        </div>
        <button onClick={onReturn}>← Return to my Composer</button>
      </div>
      <p className="lab-source-note">
        A source-annotated exchange, separate from your creation and our four
        field clips.{" "}
        <a href={contextSource.recordUrl}>Sharma et al. · Zenodo release</a> ·
        CC BY 4.0
      </p>
      <section className="lab-panel" aria-labelledby="exchange-title">
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
          Axis: seconds from the source file’s start. Shading marks actual
          positive overlap. The control never changes this timeline or sound.
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
                  {label(c.id)} · {c.onset.toFixed(4)} s
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
      </section>
      <section className="lab-panel" aria-labelledby="pairing-title">
        <p className="eyebrow">02 Change the comparison</p>
        <h2 id="pairing-title">Keep the calls. Reassign the durations.</h2>
        <p>
          Freeze the {comparison.pairCount} original overlap pairs. Move caller
          B’s measured durations around those same slots. Would the durations
          still be close?
        </p>
        <label className="lab-offset">
          Pairing to inspect
          <select
            aria-label="Control offset"
            value={offset}
            onChange={(e) => change(() => setOffset(Number(e.target.value)))}
          >
            <option value={0}>Observed · offset 0</option>
            {comparison.controls.map((c) => (
              <option key={c.offset} value={c.offset}>
                Control {c.offset} · rotate B by {c.offset}
                {c.equivalentToOffset !== null
                  ? ` (equivalent to ${c.equivalentToOffset})`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <button onClick={() => change(() => setOffset(0))}>
          Reset to observed
        </button>
        <div
          className="lab-statistics"
          aria-label="Deterministic duration comparison"
        >
          <div>
            <span>Observed mean absolute gap</span>
            <strong data-testid="lab-observed">
              {seconds(comparison.observed.valueSeconds, 6)}
            </strong>
          </div>
          <div>
            <span>
              {offset === 0
                ? "Observed reset"
                : "Selected reassignment control"}
            </span>
            <strong data-testid="lab-selected-score">
              {seconds(comparison.selected.valueSeconds, 6)}
            </strong>
          </div>
          <div>
            <span>Nonzero control median</span>
            <strong>
              {seconds(comparison.controlSummary?.medianSeconds ?? null, 6)}
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
            Control range: {seconds(comparison.controlSummary.minSeconds, 6)} to{" "}
            {seconds(comparison.controlSummary.maxSeconds, 6)}.{" "}
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
            <p key={p.aId}>
              {label(p.aId)} ({seconds(p.aDurationSeconds)}) stays paired with
              the original slot {label(p.bId)}.{" "}
              {offset === 0
                ? "Its own duration is used."
                : `That B slot now uses the duration from ${label(p.durationFromRowId)} (${seconds(p.assignedBDurationSeconds)}).`}{" "}
              Absolute difference: {seconds(p.absoluteDifferenceSeconds)}.
            </p>
          ))}
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
        <details open>
          <summary>What this comparison cannot establish</summary>
          <ul>
            {LAB_LIMITATIONS.slice(1).map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </details>
      </section>
      <section className="lab-panel lab-ask" aria-labelledby="lab-ask-title">
        <p className="eyebrow">03 Ask about the evidence · optional</p>
        <h2 id="lab-ask-title">What else could explain this?</h2>
        <p>
          {available
            ? "Only an explicit Ask sends this source-bound question. Interpretation remains unverified."
            : "Astra is unavailable here. Exploring, comparing, listening and saving work locally."}
        </p>
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
              ? "Investigating this comparison…"
              : "Ask Astra about this comparison"}
          </button>
          {pending && (
            <button type="button" onClick={cancel}>
              Cancel Context request
            </button>
          )}
        </form>
        {result && (
          <div className="lab-result" data-testid="lab-result">
            <p className="reconstruction-label">
              {result.execution === "mock-transport-test"
                ? "TEST ONLY · provider transport fixture · no live Astra call"
                : "Astra provider result · generated and unverified"}
            </p>
            <h3>Generated interpretation · unverified</h3>
            {[
              ...result.explanation.possibleInterpretations,
              ...result.explanation.limitations,
            ].map((r, i) => (
              <p key={i}>{r.text}</p>
            ))}
            <details>
              <summary>
                Exact generated answer, citations, tool evidence and receipts
              </summary>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </details>
          </div>
        )}
      </section>
      <section className="lab-panel lab-save" aria-labelledby="lab-save-title">
        <p className="eyebrow">04 Keep the investigation</p>
        <h2 id="lab-save-title">A question worth keeping.</h2>
        <p>
          Take the exact segment, computed values and row mappings with you. The
          image is a readable card; JSON carries the full evidence. Saved
          interpretation is historical, never a new live run.
        </p>
        <div>
          <button onClick={() => void save("card")}>
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
      <p role="status">{notice}</p>
      <details className="lab-source-details">
        <summary>Source audit, license and planned deeper work</summary>
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
          {contextSource.attribution} CC BY 4.0. The full predictive Context /
          Dialogue Transfer experiment remains planned; this control does not
          replace it.
        </p>
        <p>
          Source CSV SHA-256: {contextSource.csvSha256}. Original selected rows
          and transformations are in the downloaded JSON and repository audit.
        </p>
      </details>
    </section>
  );
}
