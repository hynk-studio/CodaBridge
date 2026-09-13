import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { recordings } from "../domain/catalog.ts";
import { compareTiming } from "../domain/timing.ts";
import { timingInput } from "../domain/evidence.ts";
import { compareBlock } from "./analysis.ts";
import {
  applyOperations,
  binding,
  blockTiming,
  COMPOSER_LIMITS,
  commitDraft,
  createDraft,
  CREATION_IDENTITY,
  CREATION_LIMITATIONS,
  newId,
  parseDraft,
  phraseDuration,
  seedBlock,
  span,
  travel,
  type Block,
  type History,
  type Operation,
} from "./model.ts";
import {
  cardImage,
  creationEvidence,
  deliver,
  fileStem,
  parseProject,
  projectJson,
  sourceCredits,
  STORAGE_KEY,
} from "./project.ts";
import { SyntheticPlayer, wavBytes } from "./sound.ts";
import { durationHint, operationLabels, timingChange } from "./presentation.ts";
import type { ComposerRequest, ComposerResult } from "./contract.ts";
import "./composer.css";

export interface ComposerHandle {
  makeVersion(sourceId: string): void;
  leave(): void;
}
function Pattern({ block, label }: { block: Block; label: string }) {
  return (
    <svg
      viewBox="0 0 640 100"
      role="img"
      aria-label={label}
      className="block-pattern"
    >
      <line
        x1="18"
        x2="622"
        y1="58"
        y2="58"
        stroke="currentColor"
        opacity="0.3"
      />
      {block.times.map((t, i) => (
        <g key={i}>
          <line
            x1={18 + (t / span(block)) * 604}
            x2={18 + (t / span(block)) * 604}
            y1="36"
            y2="79"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle
            cx={18 + (t / span(block)) * 604}
            cy="58"
            r="6"
            fill="currentColor"
          />
          <text
            x={18 + (t / span(block)) * 604}
            y="20"
            textAnchor="middle"
            fill="currentColor"
            fontSize="15"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
function NumberEdit({
  label,
  value,
  min,
  max,
  onCommit,
  button = "Set",
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  button?: string;
  hint?: (value: number) => string;
}) {
  const [text, setText] = useState(String(Number(value.toFixed(6))));
  useEffect(() => setText(String(Number(value.toFixed(6)))), [value]);
  return (
    <form
      className="number-edit"
      onSubmit={(e) => {
        e.preventDefault();
        onCommit(text.trim() ? Number(text) : NaN);
      }}
    >
      <label>
        {label}
        <input
          aria-label={label}
          type="number"
          required
          min={min}
          max={max}
          step="any"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <button type="submit">{button}</button>
      {hint && (
        <p className="number-hint">{hint(text.trim() ? Number(text) : NaN)}</p>
      )}
    </form>
  );
}
const score = (comparison: ReturnType<typeof compareTiming>) =>
  comparison.status === "comparable"
    ? comparison.value.toFixed(6)
    : "Not comparable · unequal counts";
function initialProject() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return { project: saved ? parseProject(saved) : null, error: "" };
  } catch {
    return {
      project: null,
      error:
        "Local storage could not be read. You can still create and save files.",
    };
  }
}

const Composer = forwardRef<
  ComposerHandle,
  {
    onExample: (id: string) => void;
    stopField: () => void;
    fieldSelection: string;
  }
>(function Composer({ onExample, stopField, fieldSelection }, ref) {
  const [panel, setPanel] = useState<"edit" | "compare" | "save">("edit");
  const [initial] = useState(initialProject);
  const [history, setHistory] = useState<History | null>(
    initial.project?.draft
      ? { present: initial.project.draft, past: [], future: [] }
      : null,
  );
  const [activeId, setActiveId] = useState(initial.project?.activeId ?? "");
  const [codebook, setCodebook] = useState<Block[]>(
    initial.project?.codebook ?? [],
  );
  const [savedAnalysis, setSavedAnalysis] = useState<unknown>(
    initial.project?.savedAnalysis ?? null,
  );
  const [notice, setNotice] = useState(initial.error || (initial.project ? "Restored saved work from this browser." : ""));
  const [storage, setStorage] = useState(
    initial.error ? "File saving available" : "Saved only in this browser",
  );
  const [availability, setAvailability] = useState(
    "Checking optional Astra access…",
  );
  const [available, setAvailable] = useState(false);
  const [question, setQuestion] = useState(
    "Make the active block 1.25 times as long, preserving its interval ratios.",
  );
  const [mode, setMode] = useState<ComposerRequest["mode"]>("edit");
  const [result, setResult] = useState<ComposerResult | null>(null);
  const [pending, setPending] = useState(false);
  const [soundStatus, setSoundStatus] = useState("Synthetic playback stopped");
  const [exampleId, setExampleId] = useState("");
  const [includeAnalysis, setIncludeAnalysis] = useState(false);
  const requestRef = useRef<AbortController | null>(null),
    generation = useRef(0);
  const player = useRef<SyntheticPlayer | null>(null);
  const region = useRef<HTMLElement>(null);
  const requestForm = useRef<HTMLFormElement>(null);
  const historyRef = useRef(history);
  const textTransaction = useRef<string | null>(null);
  const finishText = useCallback(() => {
    textTransaction.current = null;
  }, []);
  // Mutations update this ref in install/reset. A render may be replayed with
  // older state; it must not roll back the latest input-event snapshot.
  const draft = history?.present ?? null;
  const active =
    draft?.blocks.find((b) => b.id === activeId) ?? draft?.blocks[0] ?? null;
  const previous =
    history?.past.at(-1)?.blocks.find((b) => b.id === active?.id) ?? null;
  const key = draft && active ? binding(draft, active.id, previous) : "";
  const keyRef = useRef(key);
  keyRef.current = key;
  const cancel = useCallback(() => {
    generation.current++;
    requestRef.current?.abort();
    requestRef.current = null;
    setPending(false);
    setResult(null);
    player.current?.stop();
  }, []);
  const install = (next: History, selected = activeId) => {
    finishText();
    cancel();
    historyRef.current = next;
    setHistory(next);
    setActiveId(
      next.present.blocks.some((b) => b.id === selected)
        ? selected
        : next.present.blocks[0].id,
    );
    setExampleId("");
    setSavedAnalysis(null);
  };
  useEffect(() => {
    player.current = new SyntheticPlayer(setSoundStatus);
    return () => {
      player.current?.stop();
      requestRef.current?.abort();
      generation.current++;
    };
  }, []);
  useEffect(() => {
    cancel();
  }, [key, fieldSelection, cancel]);
  useEffect(() => {
    finishText();
  }, [fieldSelection, finishText]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/investigation/status", { signal: controller.signal })
      .then((r) => r.json())
      .then((v) => {
        if (controller.signal.aborted) return;
        setAvailable(v.status === "available");
        setAvailability(
          v.status === "available"
            ? "Optional · draft timing and your question are sent only when you ask."
            : "Astra is unavailable here. All creative tools work locally.",
        );
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setAvailability(
            "Astra is unavailable here. All creative tools work locally.",
          );
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!draft && !codebook.length) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        projectJson(draft, codebook, savedAnalysis, active?.id ?? null),
      );
      setStorage("Saved only in this browser");
    } catch {
      setStorage(
        "Local saving failed. Download project JSON to keep your work.",
      );
    }
  }, [draft, codebook, savedAnalysis, active?.id]);
  function attempt(action: () => void) {
    try {
      action();
      setNotice("");
    } catch (e) {
      setNotice(
        e instanceof Error ? e.message : "The change could not be made.",
      );
    }
  }
  function operate(operations: Operation[]) {
    finishText();
    attempt(() => {
      const current = historyRef.current;
      if (current)
        install(
          commitDraft(current, applyOperations(current.present, operations)),
        );
    });
  }
  function makeVersion(sourceId: string) {
    setPanel("edit");
    finishText();
    attempt(() => {
      const current = historyRef.current;
      if (!current) {
        const created = createDraft(sourceId);
        install(
          { present: created, past: [], future: [] },
          created.blocks[0].id,
        );
      } else {
        const blockId = newId();
        install(
          commitDraft(
            current,
            applyOperations(current.present, [
              { op: "add_seed", sourceId, newBlockId: blockId },
            ]),
          ),
          blockId,
        );
      }
      region.current?.scrollIntoView({ block: "start" });
    });
  }
  useImperativeHandle(ref, () => ({
    makeVersion,
    leave: () => {
      finishText();
      cancel();
      player.current?.stop();
    },
  }));
  function editText(field: "title" | "intention" | "meaning", value: string) {
    attempt(() => {
      const current = historyRef.current;
      if (!current || !active) return;
      const transaction = field === "meaning" ? `meaning:${active.id}` : field;
      const next = structuredClone(current.present);
      if (field === "meaning")
        next.blocks.find((b) => b.id === active.id)!.meaning = value;
      else next[field] = value;
      const updated = commitDraft(
        current,
        next,
        textTransaction.current === transaction,
      );
      if (updated === current) return;
      // Rapid native input can arrive before a pending render is committed.
      // Keep this controlled input and its revision current before the next key;
      // invalidation still runs for every event in a coalesced transaction.
      flushSync(() => install(updated));
      textTransaction.current = transaction;
    });
  }
  async function play(which: "phrase" | "block" | "seed" | "preview") {
    finishText();
    if (!draft || !active) return;
    stopField();
    setNotice("");
    const selected =
      which === "preview"
        ? result?.proposal?.preview
        : which === "seed"
          ? {
              ...draft,
              blocks: [seedBlock(active.seed.recordingId, active.id)],
            }
          : which === "block"
            ? { ...draft, blocks: [active] }
            : draft;
    if (!selected) return;
    try {
      await player.current?.play(selected);
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Audio unavailable.");
    }
  }
  async function ask() {
    finishText();
    if (!draft || !active || pending || !available || !question.trim()) return;
    cancel();
    const currentGeneration = generation.current,
      requestKey = key;
    const controller = new AbortController();
    requestRef.current = controller;
    setPending(true);
    setNotice("");
    try {
      const input: ComposerRequest = {
        mode,
        draft,
        activeId: active.id,
        previous,
        binding: requestKey,
        question,
      };
      const response = await fetch("/api/composer", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      const output = await response.json();
      if (
        generation.current !== currentGeneration ||
        keyRef.current !== requestKey ||
        controller.signal.aborted
      )
        return;
      if (
        !response.ok ||
        output.status !== "completed" ||
        output.binding !== requestKey ||
        output.mode !== mode
      )
        throw new Error(
          output.status === "unavailable"
            ? "Astra is unavailable. Your draft is unchanged."
            : "Astra's result could not be accepted. Your draft is unchanged.",
        );
      // Recompute any proposed temporary draft locally before offering Apply.
      if (
        output.proposal &&
        JSON.stringify(applyOperations(draft, output.proposal.operations)) !==
          JSON.stringify(parseDraft(output.proposal.preview))
      )
        throw new Error("The edit preview does not match its operations.");
      setResult(output as ComposerResult);
    } catch (e) {
      if (
        generation.current === currentGeneration &&
        !controller.signal.aborted
      )
        setNotice(e instanceof Error ? e.message : "Astra request failed.");
    } finally {
      if (generation.current === currentGeneration) {
        setPending(false);
        requestRef.current = null;
      }
    }
  }
  async function exportFile(kind: "wav" | "card" | "json") {
    finishText();
    if (!draft || !active) return;
    try {
      const stem = fileStem(draft);
      if (kind === "wav")
        deliver(
          new Blob([wavBytes(draft)], { type: "audio/wav" }),
          `${stem}.wav`,
        );
      else if (kind === "card")
        deliver(await cardImage(draft, active.id), `${stem}-card.png`);
      else
        deliver(
          new Blob(
            [
              projectJson(
                draft,
                codebook,
                {
                  label: "Saved analysis — unverified on reopen",
                  deterministic: creationEvidence(draft, active.id),
                  generated: includeAnalysis ? result : null,
                },
                active.id,
              ),
            ],
            { type: "application/json" },
          ),
          `${stem}-project.json`,
        );
      setNotice(
        `${kind === "wav" ? "Synthetic WAV" : kind === "card" ? "Coda Card image" : "Project JSON"} download requested. Keep the audio and project with the image.`,
      );
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Download failed.");
    }
  }
  async function importFile(file: File | undefined) {
    finishText();
    if (!file) return;
    cancel();
    const token = generation.current;
    try {
      if (file.size > COMPOSER_LIMITS.projectBytes)
        throw new Error("Project exceeds 128 KiB.");
      const project = parseProject(await file.text());
      if (generation.current !== token) return;
      if (!project.draft)
        throw new Error(
          "This file contains a codebook without a phrase. Open a project with a phrase to restore.",
        );
      const next = {
        ...project.draft,
        revision:
          (historyRef.current?.present.revision ?? project.draft.revision) + 1,
      };
      install(
        { present: parseDraft(next), past: [], future: [] },
        project.activeId ?? next.blocks[0].id,
      );
      setCodebook(project.codebook);
      setSavedAnalysis(project.savedAnalysis);
      setNotice(
        "Project restored as a local human creation. Source links resolve to this catalog; imported history and analysis are unverified. Nothing played or called Astra.",
      );
    } catch (e) {
      if (generation.current === token)
        setNotice(
          e instanceof Error ? e.message : "Project could not be opened.",
        );
    }
  }
  function reuseBlock(block: Block) {
    finishText();
    attempt(() => {
      const copy = structuredClone(block);
      copy.id = newId();
      if (!history) {
        const next = createDraft(copy.seed.recordingId);
        next.blocks = [copy];
        install({ present: parseDraft(next), past: [], future: [] }, copy.id);
      } else {
        const next = structuredClone(history.present);
        next.blocks.push(copy);
        if (!next.ancestry.some((s) => s.recordingId === copy.seed.recordingId))
          next.ancestry.push(copy.seed);
        install(commitDraft(history, next), copy.id);
      }
    });
  }
  const analysis =
    draft && active ? compareBlock(draft, active.id, previous) : null;
  const example = recordings.find((r) => r.id === exampleId);
  function chooseRequestMode(next: ComposerRequest["mode"]) {
    cancel();
    setMode(next);
    setQuestion(
      next === "edit"
        ? "Make the active block 1.25 times as long, preserving its interval ratios."
        : "Find real recordings closest to my active block under the normalized interval metric.",
    );
  }
  function showPanel(next: typeof panel, target = region.current) {
    finishText();
    player.current?.stop();
    flushSync(() => setPanel(next));
    target?.scrollIntoView({ block: "start" });
    target?.focus({ preventScroll: true });
  }
  return (
    <section
      className="composer"
      data-panel={panel}
      id="composer"
      ref={region}
      tabIndex={-1}
      aria-labelledby="composer-title"
    >
      <div className="composer-heading">
        <div>
          <p className="eyebrow">Composer / Your synthetic creation</p>
          <h2 id="composer-title">{draft ? "Your phrase, your rhythm." : "A small phrase. Your own rhythm."}</h2>
        </div>
        <label className="file-open">
          Open project
          <input
            type="file"
            accept="application/json,.json"
            aria-label="Open Composer project"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="composer-storage" role="status">
        {storage}
      </p>
      {panel !== "compare" && <p className="composer-notice" role="status">
        {notice}
      </p>}
      {!draft || !active ? (
        <div className="composer-empty">
          <span className="empty-pattern" aria-hidden="true">
            ı ı　ı　┃ ı
          </span>
          <p>
            Start with timing from a real recording, then shape it into
            something personal.
          </p>
          <div className="composer-actions">
            {recordings.slice(0, 2).map((r) => (
              <button
                className="primary"
                key={r.id}
                onClick={() => makeVersion(r.id)}
              >
                Make my version of {r.source.filename}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <nav className="workspace-steps" aria-label="Composer steps">
            <button aria-pressed={panel === "edit"} onClick={() => showPanel("edit")}>Edit phrase</button>
            <button aria-pressed={panel === "compare"} onClick={() => showPanel("compare")}>Compare & ask</button>
            <button aria-pressed={panel === "save"} onClick={() => showPanel("save")}>Save & codebook</button>
          </nav>
          <div className="creation-identity">
            <span>{CREATION_IDENTITY}</span>
            <span>Meaning to sperm whales: unknown</span>
          </div>
          <details className="phrase-properties">
            <summary>Title & intention <span>{draft.title || "Untitled coda"}</span></summary>
          <div className="phrase-title">
            <label>
              Phrase title
              <input
                maxLength={80}
                value={draft.title}
                onChange={(e) => editText("title", e.target.value)}
                onBlur={finishText}
              />
            </label>
            <label>
              My intention <span>(optional)</span>
              <input
                maxLength={240}
                value={draft.intention}
                onChange={(e) => editText("intention", e.target.value)}
                onBlur={finishText}
                placeholder="What would you like this phrase to express?"
              />
            </label>
          </div>
          </details>
          <div hidden={panel === "save"}>
          <div className="phrase-toolbar" hidden={panel === "compare"}>
            <div>
              <strong>{phraseDuration(draft).toFixed(3)} s</strong>
              <span>
                {" "}
                / {draft.blocks.length} {draft.blocks.length === 1 ? "block" : "blocks"} · whole phrase
              </span>
            </div>
            <div className="composer-actions">
              <button
                disabled={!history?.past.length}
                onClick={() => history && install(travel(history, "undo"))}
              >
                Undo
              </button>
              <button
                disabled={!history?.future.length}
                onClick={() => history && install(travel(history, "redo"))}
              >
                Redo
              </button>
            </div>
          </div>
          <div className="phrase-strip" aria-label="Phrase blocks">
            {draft.blocks.map((b, i) => (
              <button
                key={b.id}
                aria-pressed={b.id === active.id}
                className={
                  b.id === active.id ? "phrase-block active" : "phrase-block"
                }
                onClick={() => {
                  finishText();
                  cancel();
                  setActiveId(b.id);
                  setExampleId("");
                }}
              >
                <span>
                  Block {i + 1}{b.id === active.id ? " · selected" : ""} <small>{span(b).toFixed(2)} s</small>
                </span>
                <Pattern block={b} label={`Block ${i + 1} timing`} />
                <span className="block-meaning">
                  {b.meaning || "No personal label yet"}
                </span>
              </button>
            ))}
          </div>
          <p className="composer-meta">
            Choose a block to edit. The phrase plays every block in order, including the pauses between them.
          </p>
          <div className="composer-actions playback-controls">
            <button className="primary" onClick={() => void play("phrase")}>
              ▶ Play my synthetic phrase
            </button>
            <button
              disabled={
                !soundStatus.includes("Playing") &&
                !soundStatus.includes("paused")
              }
              onClick={() => void player.current?.pauseResume()}
            >
              {soundStatus.includes("paused")
                ? "Resume synthetic"
                : "Pause synthetic"}
            </button>
            <button onClick={() => player.current?.stop()}>
              Stop synthetic
            </button>
          </div>
          <p
            className="composer-meta"
            role="status"
            aria-label="Synthetic playback status"
          >
            {soundStatus}. All Composer playback is synthetic.
          </p>
          <div className={`composer-workbench ${panel === "compare" ? "compare-workbench" : ""}`}>
            <section hidden={panel !== "edit"} className="block-editor" aria-label="Active block editor">
              <div className="small-heading">
                <h3>
                  Shape block{" "}
                  {draft.blocks.findIndex((b) => b.id === active.id) + 1}
                </h3>
                <span>
                  {active.times.length} clicks · seed {recordings.find((r) => r.id === active.seed.recordingId)!.source.filename}
                </span>
              </div>
              <div className="block-audition">
                <button onClick={() => void play("seed")}>Play synthetic seed timing</button>
                <button className="primary" onClick={() => void play("block")}>Play selected synthetic block</button>
              </div>
              <Pattern
                block={active}
                label="Active block normalized marker pattern"
              />
              <p className="composer-meta">
                Normalized marker pattern · first marker to last
              </p>
              <p className="edit-invitation">
                Lengthen or shorten every gap to change the pace. Change just the first gap to reshape the opening pause.
              </p>
              <div className="composer-actions quick-edits">
                <button
                  onClick={() =>
                    operate([
                      {
                        op: "scale_duration",
                        blockId: active.id,
                        factor: 1.25,
                      },
                    ])
                  }
                >
                  Lengthen ×1.25
                </button>
                <button
                  onClick={() =>
                    operate([
                      { op: "scale_duration", blockId: active.id, factor: 0.8 },
                    ])
                  }
                >
                  Shorten ×0.8
                </button>
                <button
                  onClick={() =>
                    operate([
                      {
                        op: "set_gap",
                        blockId: active.id,
                        gapIndex: 0,
                        seconds: active.times[1] + 0.05,
                      },
                    ])
                  }
                >
                  Open first gap +0.05 s
                </button>
                <button
                  disabled={active.times[1] - 0.05 < COMPOSER_LIMITS.gapMin}
                  onClick={() =>
                    operate([
                      {
                        op: "set_gap",
                        blockId: active.id,
                        gapIndex: 0,
                        seconds: active.times[1] - 0.05,
                      },
                    ])
                  }
                >
                  Tighten first gap −0.05 s
                </button>
              </div>
                <button onClick={() => {
                  if (mode !== "edit") chooseRequestMode("edit");
                  showPanel("compare", requestForm.current);
                }}>Describe an edit with Astra →</button>
                <details className="precise-timing">
                <summary>Precise duration & gap controls</summary>
              <div className="duration-edit">
                <NumberEdit
                  label="Duration multiplier"
                  value={1.25}
                  min={COMPOSER_LIMITS.scaleMin}
                  max={COMPOSER_LIMITS.scaleMax}
                  button="Scale duration"
                  hint={durationHint}
                  onCommit={(factor) =>
                    operate([
                      { op: "scale_duration", blockId: active.id, factor },
                    ])
                  }
                />
              </div>
              <details className="gap-editor">
                <summary>
                  Exact gap timing <span>seconds</span>
                </summary>
                <p>
                  Later markers move together; other gaps keep their lengths.
                </p>
                <div className="gap-grid">
                  {active.times.slice(1).map((t, i) => (
                    <NumberEdit
                      key={`${active.id}:${i}`}
                      label={`Gap ${i + 1} → ${i + 2}`}
                      value={t - active.times[i]}
                      min={COMPOSER_LIMITS.gapMin}
                      max={COMPOSER_LIMITS.gapMax}
                      onCommit={(seconds) =>
                        operate([
                          {
                            op: "set_gap",
                            blockId: active.id,
                            gapIndex: i,
                            seconds,
                          },
                        ])
                      }
                    />
                  ))}
                </div>
              </details>
              {draft.blocks.at(-1)?.id !== active.id && (
                <NumberEdit
                  label="Space after this block (seconds)"
                  value={active.spacingAfter}
                  min={COMPOSER_LIMITS.spacingMin}
                  max={COMPOSER_LIMITS.spacingMax}
                  onCommit={(seconds) =>
                    operate([
                      { op: "set_spacing", blockId: active.id, seconds },
                    ])
                  }
                />
              )}
              </details>
              <div className="composer-actions">
                <button
                  disabled={draft.blocks.length >= COMPOSER_LIMITS.blocks}
                  onClick={() => {
                    const nextId = newId();
                    attempt(() => {
                      if (history)
                        install(
                          commitDraft(
                            history,
                            applyOperations(draft, [
                              {
                                op: "duplicate_block",
                                blockId: active.id,
                                newBlockId: nextId,
                              },
                            ]),
                          ),
                          nextId,
                        );
                    });
                  }}
                >
                  Duplicate block
                </button>
                <button
                  disabled={draft.blocks.length < 2}
                  onClick={() =>
                    operate([{ op: "remove_block", blockId: active.id }])
                  }
                >
                  Remove block
                </button>
                <button
                  disabled={draft.blocks[0].id === active.id}
                  onClick={() =>
                    operate([
                      {
                        op: "move_block",
                        blockId: active.id,
                        toIndex:
                          draft.blocks.findIndex((b) => b.id === active.id) - 1,
                      },
                    ])
                  }
                >
                  Move earlier
                </button>
                <button
                  disabled={draft.blocks.at(-1)?.id === active.id}
                  onClick={() =>
                    operate([
                      {
                        op: "move_block",
                        blockId: active.id,
                        toIndex:
                          draft.blocks.findIndex((b) => b.id === active.id) + 1,
                      },
                    ])
                  }
                >
                  Move later
                </button>
              </div>
              <label className="seed-add">
                Add timing from a real recording
                <select
                  aria-label="Add seed block"
                  value=""
                  disabled={draft.blocks.length >= COMPOSER_LIMITS.blocks}
                  onChange={(e) => makeVersion(e.target.value)}
                >
                  <option value="">Choose a seed…</option>
                  {recordings.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.source.filename}
                    </option>
                  ))}
                </select>
              </label>
              <label className="meaning-label">
                Meaning I assign <span>(optional, creator-authored)</span>
                <input
                  maxLength={160}
                  value={active.meaning}
                  onChange={(e) => editText("meaning", e.target.value)}
                  onBlur={finishText}
                  placeholder="A personal label, never a whale translation"
                />
              </label>
            </section>
            <section
              className="creation-comparison"
              aria-label="Compare my creation"
            >
              <p className="eyebrow">Compare my creation</p>
              <h3>How did the pattern change?</h3>
              <p className="composer-meta">
                Measured locally · active block only
              </p>
              <p className="timing-change" data-testid="timing-change">
                Compared with the seed:{" "}
                {timingChange(
                  seedBlock(active.seed.recordingId, active.id),
                  active,
                )}
              </p>
              <div
                className="duration-pair"
                aria-label="Seed and selected block durations"
              >
                <div>
                  <span>Synthetic seed timing</span>
                  <strong>{analysis!.seed.spanSeconds.toFixed(3)} s</strong>
                  <button hidden={panel === "edit"} onClick={() => void play("seed")}>Play synthetic seed timing</button>
                </div>
                <div>
                  <span>Selected synthetic block</span>
                  <strong>{span(active).toFixed(3)} s</strong>
                  <button hidden={panel === "edit"} className="primary" onClick={() => void play("block")}>Play selected synthetic block</button>
                </div>
              </div>
              {previous && (
                <p className="composer-meta">
                  Since the previous local revision:{" "}
                  {timingChange(previous, active)}
                </p>
              )}
              <p className="composer-meta">The seed and selected block use the same synthetic click sound. The field recording keeps the whale’s original sound.</p>
              {panel === "edit" && <button onClick={() => showPanel("compare")}>Compare with real recordings →</button>}
              <div hidden={panel !== "compare"}>
              <details>
                <summary>Exact rhythm metric & previous revision</summary>
              <div className="baseline-result">
                <span>
                  Normalized interval MAD · seed {analysis!.seed.sourceId}
                </span>
                <strong data-testid="creation-seed-score">
                  {score(analysis!.seed.comparison)}
                </strong>
              </div>
              <div className="previous-result">
                <span>Previous local revision</span>
                <strong data-testid="creation-previous-score">
                  {analysis!.previous
                    ? score(analysis!.previous.comparison)
                    : "No previous revision"}
                </strong>
              </div>
              <p className="composer-meta">
                Normalized interval MAD v1.0.0. Lower means closer timing, not
                shared meaning. Uniform duration scaling leaves this score
                unchanged.
              </p>
              </details>
              <h4>Other real examples</h4>
              <p>
                {analysis!.eligibleCount} eligible / {analysis!.catalogCount}{" "}
                catalog recordings. Seed ancestry and duplicate bytes excluded.
              </p>
              <ol className="alternative-list">
                {analysis!.matches.map((row, rank) => (
                  <li key={row.sourceId}>
                    <div>
                      <strong>#{rank + 1} · {recordings.find((r) => r.id === row.sourceId)!.label}</strong>
                      <span>Distance {row.comparison.status === "comparable" ? row.comparison.value.toFixed(3) : "Not comparable"}</span>
                    </div>
                    <p className="composer-meta">{recordings.find((r) => r.id === row.sourceId)!.annotation.clickTimesSeconds.length} estimated clicks · {span(seedBlock(row.sourceId)).toFixed(2)} s click span. Lower distance means closer relative spacing, not shared meaning.</p>
                    <button
                      onClick={() => {
                        cancel();
                        setExampleId(row.sourceId);
                        onExample(row.sourceId);
                      }}
                    >
                      Listen / compare {row.sourceId}
                    </button>
                  </li>
                ))}
              </ol>
              {!analysis!.matches.length && (
                <p>No eligible other example in this small catalog.</p>
              )}
              {analysis!.rejected.map((row) => (
                <p className="rejected-example" key={row.sourceId}>
                  {row.sourceId}: unequal counts, not comparable. No alignment
                  or padding.{" "}
                  <button
                    onClick={() => {
                      cancel();
                      setExampleId(row.sourceId);
                      onExample(row.sourceId);
                    }}
                  >
                    Inspect {row.sourceId}
                  </button>
                </p>
              ))}
              {example && (
                <div className="selected-example" role="status">
                  <strong>
                    {example.id} selected as real recording B above.
                  </strong>
                  <p>
                    Draft comparison:{" "}
                    {score(
                      compareTiming(blockTiming(active), timingInput(example)),
                    )}
                    . Your phrase is preserved. Press Play recording B when
                    ready.
                  </p>
                  <button onClick={() => onExample(example.id)}>Go to field audio ↑</button>
                </div>
              )}
              </div>
              <details>
                <summary>Seed origin & measured evidence</summary>
                <p>
                  Original first-marker offset:{" "}
                  {active.seed.originalOffsetSeconds.toFixed(6)} s. Draft starts
                  at zero; the source file is unchanged. A source link does not
                  authenticate imported edit history.
                </p>
                <pre>{JSON.stringify(analysis, null, 2)}</pre>
              </details>
            </section>
          </div>
          </div>
          <section
            hidden={panel !== "compare"}
            className="composer-astra"
            aria-labelledby="composer-astra-title"
          >
            <div>
              <p className="eyebrow">03 Ask & test · optional</p>
              <h3 id="composer-astra-title">Astra, at your editing desk.</h3>
              <p>{availability}</p>
            </div>
            <form
              ref={requestForm}
              tabIndex={-1}
              aria-label="Ask Astra about this creation"
              onSubmit={(e) => {
                e.preventDefault();
                void ask();
              }}
            >
              <label>
                What would you like to do?
                <select
                  aria-label="What would you like to do?"
                  value={mode}
                  onChange={(e) => chooseRequestMode(e.target.value as ComposerRequest["mode"])}
                >
                  <option value="edit">Propose a timing edit</option>
                  <option value="investigate">Investigate this block</option>
                </select>
              </label>
              <label>
                Your request
                <textarea
                  maxLength={800}
                  value={question}
                  onChange={(e) => {
                    cancel();
                    setQuestion(e.target.value);
                  }}
                />
              </label>
              <div className="composer-actions">
                <button
                  className="primary"
                  disabled={!available || pending || !question.trim()}
                >
                  {pending
                    ? "Working with this revision…"
                    : mode === "edit"
                      ? "Ask Astra for an edit"
                      : "Ask Astra to investigate"}
                </button>
                {pending && (
                  <button
                    type="button"
                    onClick={() => {
                      cancel();
                      setNotice(
                        "Request canceled. No result will apply to your draft.",
                      );
                    }}
                  >
                    Cancel request
                  </button>
                )}
              </div>
            </form>
            {panel === "compare" && notice && <p className="composer-notice" role="status">{notice}</p>}
            {result && (
              <div className="composer-result" data-testid="composer-result">
                <p className="result-label" role="status">
                  {result.proposal ? "Edit proposal ready. " : "Answer ready. "}
                  {result.execution === "mock-transport-test"
                    ? "TEST ONLY · model transport fixture · no live Astra call"
                    : "Astra provider response · interpretation remains unverified"}
                </p>
                {result.proposal && (
                  <>
                    <h4>Proposed edit · your draft is unchanged</h4>
                    <p>
                      Steps in order. Labels stay with their blocks when
                      positions change.
                    </p>
                    <ol aria-label="Proposed operations">
                      {operationLabels(draft, result.proposal.operations).map(
                        (label, i) => (
                          <li key={i}>{label}</li>
                        ),
                      )}
                    </ol>
                    <p>Deterministic before / after</p>
                    {result.proposal.facts.map((row) => (
                      <div className="preview-fact" key={row.blockId}>
                        <span>
                          Position {row.beforePosition ?? "new"} →{" "}
                          {row.afterPosition ?? "removed"}
                        </span>
                        <span>
                          {row.beforeSpan?.toFixed(3) ?? "new"} s →{" "}
                          {row.afterSpan?.toFixed(3) ?? "removed"} s
                        </span>
                        <span>
                          Saved spacing {row.beforeSpacing?.toFixed(3) ?? "new"}{" "}
                          → {row.afterSpacing?.toFixed(3) ?? "removed"} s (used
                          only between blocks)
                        </span>
                        <span>
                          Normalized MAD{" "}
                          {row.comparison
                            ? score(row.comparison)
                            : "added / removed"}
                        </span>
                      </div>
                    ))}
                    <div className="proposal-patterns">
                      {result.proposal.preview.blocks.map((b, i) => (
                        <Pattern
                          key={b.id}
                          block={b}
                          label={`Proposal block ${i + 1}`}
                        />
                      ))}
                    </div>
                    <div className="composer-actions">
                      <button onClick={() => void play("preview")}>
                        Play synthetic proposal
                      </button>
                      <button
                        className="primary"
                        onClick={() => {
                          if (result.binding === keyRef.current) {
                            operate(result.proposal!.operations);
                            setNotice("Proposal applied to your phrase. Play it, or Undo to restore the previous version.");
                            showPanel("edit");
                          }
                        }}
                      >
                        Apply & return to editor
                      </button>
                      <button onClick={() => { cancel(); setNotice("Proposal discarded. Your phrase is unchanged."); }}>Discard proposal</button>
                    </div>
                  </>
                )}
                {result.explanation && (
                  <details className="exact-answer" open>
                    <summary>Exact generated answer · unverified</summary>
                    <p>Computed comparisons above remain separate from this original answer. Evidence references do not fact-check every statement.</p>
                    {[
                      ...result.explanation.possibleInterpretations,
                      ...result.explanation.limitations,
                    ].map((row, i) => (
                      <p key={i}>
                        {row.text}
                        <small className="citation">
                          Evidence: {row.evidenceIds.join(", ")}
                        </small>
                      </p>
                    ))}
                  </details>
                )}
                <details>
                  <summary>
                    Tool actions, deterministic evidence & returned receipts
                  </summary>
                  <pre>{JSON.stringify(result, null, 2)}</pre>
                </details>
              </div>
            )}
          </section>
          <section hidden={panel !== "save"} className="keep-coda" aria-labelledby="keep-title">
            <div>
              <p className="eyebrow">Keep my coda / Downloads</p>
              <h3 id="keep-title">A rhythm worth keeping.</h3>
              <p>
                Save the project to edit again, the WAV to hear your phrase, or the card to keep a visual memento.
              </p>
              <div className="composer-actions">
                <button
                  className="primary"
                  onClick={() => void exportFile("wav")}
                >
                  Download synthetic WAV
                </button>
                <button onClick={() => void exportFile("card")}>
                  Download card image
                </button>
                <button onClick={() => void exportFile("json")}>
                  Download project JSON
                </button>
              </div>
              <div className="coda-card" data-testid="coda-card">
                <span className="eyebrow">CodaBridge / Coda Card</span>
                <h4>{draft.title || "Untitled coda"}</h4>
                {draft.intention && (
                  <p className="card-intention">
                    {draft.intention}
                    <small>Creator intention</small>
                  </p>
                )}
                {draft.blocks.map((b, i) => (
                  <div key={b.id}>
                    {b.meaning && (
                      <p className="card-meaning">
                        {b.meaning}
                        <small>Creator-assigned meaning</small>
                      </p>
                    )}
                    <Pattern block={b} label={`Saved phrase block ${i + 1}`} />
                    <small>
                      Block {i + 1} · {span(b).toFixed(3)} s · normalized
                      spacing
                    </small>
                  </div>
                ))}
                <p>
                  Selected block:{" "}
                  {timingChange(
                    seedBlock(active.seed.recordingId, active.id),
                    active,
                  )}
                </p>
                <p className="card-identity">{CREATION_IDENTITY}</p>
                <p className="card-credit">
                  Timing seeds:{" "}
                  {draft.ancestry.map((s) => s.recordingId).join(", ")} · DSWP ·
                  CC BY 4.0
                </p>
                <p className="card-identity">
                  Meaning to sperm whales: unknown.
                </p>
                <small>
                  Revision {draft.revision} · This image is not playable. Keep
                  its WAV + project JSON for sound, measurements and source
                  details.
                </small>
              </div>
              <label className="include-evidence">
                <input
                  type="checkbox"
                  checked={includeAnalysis}
                  onChange={(e) => setIncludeAnalysis(e.target.checked)}
                />
                Include analysis evidence in project (saved / unverified on
                reopen)
              </label>
              <p className="composer-meta">
                Project JSON always keeps deterministic measurements, source
                versions and full limitations. The option adds the current
                generated result.
              </p>
            </div>
            <aside className="codebook">
              <h3>My little codebook</h3>
              <p>
                Keep blocks with your personal labels, then reuse them in
                another phrase.
              </p>
              <p className="codebook-selection">Selected: block {draft.blocks.findIndex((b) => b.id === active.id) + 1}{active.meaning ? ` · ${active.meaning}` : " · no personal label yet"}</p>
              <button
                disabled={codebook.length >= COMPOSER_LIMITS.codebook}
                onClick={() => {
                  finishText();
                  setCodebook([
                    ...codebook,
                    { ...structuredClone(active), id: newId() },
                  ]);
                  setNotice(
                    "Block saved to your local codebook with its creator-assigned meaning.",
                  );
                }}
              >
                Save active block to codebook
              </button>
              <p className="composer-meta">
                {codebook.length} / {COMPOSER_LIMITS.codebook} saved blocks
              </p>
              {codebook.map((b, i) => (
                <div className="codebook-row" key={b.id}>
                  <strong>{b.meaning || `Saved block ${i + 1}`}</strong>
                  <span>Creator-assigned · {b.seed.recordingId} seed</span>
                  <button
                    disabled={draft.blocks.length >= COMPOSER_LIMITS.blocks}
                    onClick={() => reuseBlock(b)}
                  >
                    Reuse saved block {i + 1}
                  </button>
                  <button
                    onClick={() =>
                      setCodebook(codebook.filter((_, index) => index !== i))
                    }
                  >
                    Forget saved block {i + 1}
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  cancel();
                  historyRef.current = null;
                  setHistory(null);
                  setSavedAnalysis(null);
                  try {
                    localStorage.removeItem(STORAGE_KEY);
                  } catch {
                    setStorage(
                      "Storage could not be cleared. Close this browser to end the session.",
                    );
                  }
                }}
              >
                Start a new phrase
              </button>
              <p className="composer-meta">
                Your codebook stays available in this session.
              </p>
            </aside>
          </section>
          <details hidden={panel !== "save"} className="composer-limitations">
            <summary>Sources, limits & local project details</summary>
            <p>Engineering bounds: 1–4 blocks, 2–12 markers per block, 30 s phrase. Gap 0.04–5 s; space 0.05–5 s. These are editor limits, not whale biology.</p>
            {CREATION_LIMITATIONS.map((item) => (
              <p key={item}>{item}</p>
            ))}
            {sourceCredits(draft).map((s) => (
              <p key={s.id}>
                {s.id} · {s.attribution} <a href={s.licenseUrl}>{s.license}</a>{" "}
                · <a href={s.url}>Original {s.filename}</a>
              </p>
            ))}
            <p>{storage}</p>
            <button
              onClick={() => {
                cancel();
                historyRef.current = null;
                setHistory(null);
                setCodebook([]);
                setSavedAnalysis(null);
                try {
                  localStorage.removeItem(STORAGE_KEY);
                  setNotice("Local phrase and codebook cleared.");
                } catch {
                  setNotice(
                    "The session was cleared, but browser storage could not be removed.",
                  );
                }
              }}
            >
              Clear local phrase and codebook
            </button>
          </details>
        </>
      )}
      {!draft && codebook.length > 0 && (
        <div className="codebook">
          <h3>Reuse your saved blocks</h3>
          <p>Creator-assigned labels. Meaning to sperm whales: unknown.</p>
          {codebook.map((b, i) => (
            <button key={b.id} onClick={() => reuseBlock(b)}>
              Reuse saved block {i + 1}: {b.meaning || b.seed.recordingId}
            </button>
          ))}
        </div>
      )}
      {savedAnalysis != null && (
        <details className="saved-analysis">
          <summary>
            Imported / saved analysis · unverified historical content
          </summary>
          <p>
            This is inert saved evidence, not a current live result. Recomputed
            comparisons are shown separately.
          </p>
          <pre>{JSON.stringify(savedAnalysis, null, 2)}</pre>
        </details>
      )}
    </section>
  );
});
export default Composer;
