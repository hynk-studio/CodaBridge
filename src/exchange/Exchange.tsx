import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { recordings } from "../domain/catalog.ts";
import { applyOperations, commitDraft, newId, travel, type History, type Operation } from "../composer/model.ts";
import { Pattern, NumberEdit } from "../composer/TimingControls.tsx";
import { ExchangeDownloads } from "./downloads.ts";
import { renderClickSchedule, SyntheticPlayer } from "../composer/sound.ts";
import { appendTurn, changeArrangement, preparedFile } from "./format.ts";
import { editorDraft, EXCHANGE_LIMITS, humanText, phraseFromBlocks, phraseSpan, seedPhrase, type Phrase } from "./model.ts";
import { exchangeSchedule, exchangeWav, schedulePhrases } from "./sound.ts";
import { cryptoAvailable, decryptEnvelope, encryptEnvelope, readExchangeFile, type SealedArtifact } from "./sealed.ts";
import { SessionOwner, type OpenContent } from "./session.ts";
import "./exchange.css";

interface Outgoing { history: History; activeId: string; alias: string; label: string; message: string; id: string; exchangeId: string }
type Session = OpenContent<Outgoing>;
export interface ExchangeHandle { start(phrase: Phrase): void }
const turnName = (i: number) => `${i % 2 ? "B" : "A"}${Math.floor(i / 2) + 1}`;
const seconds = (value: number) => `${value.toFixed(3)} s`;
function Sources({ phrase }: { phrase: Phrase }) {
  const sources = [...new Map(phrase.blocks.map(b => [b.source.recordingId, b.source])).values()];
  return <details className="exchange-sources"><summary>Source credits · {sources.map(s => s.filename).join(", ")}</summary>
    {sources.map(s => <div key={s.recordingId}>
      <strong>{s.dataset} / {s.filename} · {s.license}</strong><p>{s.attribution}</p>
      <p>Machine-estimated seed markers; human review not performed. Original offset {s.originalOffsetSeconds} s. Source link does not authenticate edit history.</p>
      <p>Revision <code>{s.sourceRevision}</code> · SHA-256 <code>{s.audioSha256}</code> · {s.audioBytes} bytes.</p>
      <p>Annotation {s.annotationMethod} / {s.annotationVersion}. Transformations: {s.transformations.join(", ") || "none"}.</p><p>{s.citation}</p>
    </div>)}
  </details>;
}
function Timing({ phrase }: { phrase: Phrase }) {
  const draft = editorDraft(phrase);
  return <div className="exchange-timing">{draft.blocks.map((b, i) => <div key={b.id}>
    <Pattern block={b} label={`Block ${i + 1}, ${b.times.length} synthetic clicks`} />
    <details><summary>Block {i + 1} · {seconds(b.times.at(-1)!)} · numeric timing</summary>
      <p>Click positions (seconds): {b.times.map(String).join(", ")}</p>
      {i < draft.blocks.length - 1 && <p>Gap to next block: {b.spacingAfter} s.</p>}
    </details>
  </div>)}</div>;
}

const Exchange = forwardRef<ExchangeHandle, {
  active: boolean; stopField: () => void; hasComposer: () => boolean;
  copyComposer: (scope: "selected" | "phrase") => Phrase | null;
}>(function Exchange({ active, stopField, hasComposer, copyComposer }, ref) {
  const [owner] = useState(() => new SessionOwner<Outgoing>());
  useSyncExternalStore(owner.subscribe, owner.snapshot);
  const session = owner.current, latest = owner, generation = { current: owner.generation };
  const player = useRef<SyntheticPlayer | null>(null);
  const [candidate, setCandidate] = useState<SealedArtifact | null>(null);
  const candidateRef = useRef<SealedArtifact | null>(null);
  const keyInput = useRef<HTMLInputElement>(null), displayedKey = useRef<HTMLInputElement>(null);
  const [reveal, setReveal] = useState(false);
  const [source, setSource] = useState("composer-selected");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [downloads] = useState(() => new ExchangeDownloads());
  const busy = owner.pending;
  const [sharing, setSharing] = useState(false);
  const [sound, setSound] = useState("Synthetic playback stopped");
  const [playStarted, setPlayStarted] = useState<number | null>(null);
  const [activeTurn, setActiveTurn] = useState("");
  const ranges = useRef<ReturnType<typeof schedulePhrases>["ranges"]>([]);
  const [confirmation, setConfirmation] = useState<{ title: string; detail: string; action: () => void; token: number; accept?: string } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  function working(value: boolean, phase: SessionOwner<Outgoing>["phase"] = "hashing") { owner.setPhase(value ? phase : "idle"); }
  function invalidate() { generation.current.next(); player.current?.stop(); ranges.current = []; setActiveTurn(""); working(false); setSharing(false); setConfirmation(null); }
  function clearSecrets() {
    invalidate(); downloads.clear(); candidateRef.current = null; setCandidate(null); setReveal(false);
    if (keyInput.current) keyInput.current.value = "";
    if (displayedKey.current) displayedKey.current.value = "";
    setSource("composer-selected"); setError(""); setNotice("");
  }
  function lockNow() { clearSecrets(); owner.lock(); setNotice("Locked. Open with the file and its key again. Composer work is unchanged."); }
  function lock() {
    const unsealed = owner.unsavedChanges(), keyUnsaved = owner.current.prepared && !owner.current.keySaved;
    if (unsealed || keyUnsaved) confirm("Lock and discard unsaved work?", `${unsealed ? "Changes since the last sealed file will be discarded. " : ""}Keep both the encrypted file and its opening key first. A lost key cannot be recovered. Lock does not encrypt unfinished work.`, lockNow, "Discard unsaved work and lock");
    else lockNow();
  }
  function reset() { clearSecrets(); owner.reset(); }
  function setCandidateFile(value: SealedArtifact | null) { candidateRef.current = value; setCandidate(value); if (keyInput.current) keyInput.current.value = ""; }
  function install(next: Session) {
    invalidate(); owner.install(next); setError(""); setNotice("");
  }
  function attempt(action: () => void) { try { action(); } catch (e) { setError(e instanceof Error ? e.message : "This change could not be made."); } }
  function confirm(title: string, detail: string, action: () => void, accept?: string) {
    invalidate(); setConfirmation({ title, detail, action, token: generation.current.next(), accept });
  }
  function begin(phrase: Phrase, reply: boolean) {
    if (owner.current.mode === "locked") { reset(); }
    if (owner.current.prepared && !owner.current.keySaved) throw new Error("Retain the current opening key and acknowledge it before editing the snapshot.");
    const previous = reply ? latest.current.envelope : null;
    if (reply && (!previous || previous.turns.length >= EXCHANGE_LIMITS.turns)) throw new Error("An exchange can contain up to 8 turns.");
    const draft = editorDraft(phrase);
    install({ envelope: previous, outgoing: { history: { present: draft, past: [], future: [] }, activeId: draft.blocks[0].id,
      alias: "", label: "", message: "", id: newId(), exchangeId: previous?.exchangeId ?? `e-${crypto.randomUUID()}` } });
  }
  useImperativeHandle(ref, () => ({ start: phrase => {
    if (latest.current.outgoing || latest.current.envelope || latest.current.mode === "locked") confirm("Start a new exchange?", "This replaces the opened exchange and discards any unfinished outgoing draft. Save a file first if you want to keep it.", () => { reset(); begin(phrase, false); });
    else begin(phrase, false);
  } }));
  useEffect(() => {
    player.current = new SyntheticPlayer(state => {
      setSound(state);
      setPlayStarted(state === "Playing synthetic clicks" ? performance.now() : null);
      if (state !== "Playing synthetic clicks") setActiveTurn("");
    });
    const leave = () => {
      clearSecrets();
      if (owner.current.mode !== "plain") owner.lock(); else owner.reset();
    };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) leave(); };
    const unload = (event: BeforeUnloadEvent) => {
      if (latest.current.envelope || latest.current.outgoing) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("pagehide", leave); window.addEventListener("pageshow", restore);
    return () => { leave(); window.removeEventListener("beforeunload", unload); window.removeEventListener("pagehide", leave); window.removeEventListener("pageshow", restore); };
  }, []);
  useEffect(() => { if (!active) { invalidate(); setReveal(false); } }, [active]);
  useEffect(() => {
    if (confirmation) dialog.current?.showModal(); else dialog.current?.close();
  }, [confirmation]);
  useEffect(() => {
    // A closing modal can restore focus after the new input's autoFocus.
    // Run after dialog.close(), without queuing a callback past a lock/edit.
    if (!confirmation && active && (session.mode === "locked" || candidate)) keyInput.current?.focus();
  }, [confirmation, active, session.mode, candidate]);
  useEffect(() => {
    if (active && session.prepared && !session.outgoing) displayedKey.current?.focus();
  }, [active, session.prepared, session.outgoing]);
  useEffect(() => {
    if (playStarted === null) return;
    const tick = () => {
      const elapsed = (performance.now() - playStarted) / 1000;
      setActiveTurn(ranges.current.find(r => elapsed >= r.start && elapsed <= r.end)?.id ?? "");
    };
    tick(); const timer = window.setInterval(tick, 35); return () => clearInterval(timer);
  }, [playStarted]);

  const { envelope, outgoing } = session;
  const privateMode = session.mode !== "plain";
  const keyRetained = !session.prepared || session.keySaved;
  const file = useMemo(() => session.mode === "plain" && envelope ? preparedFile(envelope) : null, [envelope, session.mode]);
  const exportFile = privateMode ? owner.readyArtifact()?.file ?? null : file;
  let shareSupported = false;
  try { shareSupported = Boolean(exportFile && typeof navigator.share === "function" && navigator.canShare?.({ files: [exportFile] })); } catch { /* Download remains available. */ }
  const schedule = useMemo(() => envelope ? exchangeSchedule(envelope) : null, [envelope]);
  const hasLocal = hasComposer();
  const nextIndex = envelope?.turns.length ?? 0;
  const fallbackSource = hasLocal ? "composer-selected" : "seed:dswp-1";
  // An earlier-turn choice belongs to one role in one opened snapshot. Do not
  // carry it invisibly into the other role's slot or a replacement file.
  const validEarlier = envelope?.turns.some(t => `turn:${t.id}` === source && t.role === (nextIndex % 2 ? "B" : "A"));
  const selectedSource = (!hasLocal && source.startsWith("composer-")) || (source.startsWith("turn:") && !validEarlier) ? fallbackSource : source;
  function chosenPhrase(): Phrase {
    if (selectedSource.startsWith("composer-")) {
      const copy = copyComposer(selectedSource === "composer-phrase" ? "phrase" : "selected");
      if (!copy) throw new Error("Choose a supported seed, or make a Composer draft first.");
      return copy;
    }
    if (selectedSource.startsWith("seed:")) return seedPhrase(selectedSource.slice(5));
    const earlier = latest.current.envelope?.turns.find(t => `turn:${t.id}` === selectedSource);
    if (!earlier || earlier.role !== (nextIndex % 2 ? "B" : "A")) throw new Error("Choose a pattern for this turn.");
    return phraseFromBlocks(editorDraft(earlier.phrase).blocks, true);
  }
  function edit(update: (draft: Outgoing) => Outgoing) {
    attempt(() => { const current = latest.current; if (current.outgoing) install({ ...current, outgoing: update(current.outgoing) }); });
  }
  function operate(operation: Operation) {
    edit(d => ({ ...d, history: commitDraft(d.history, applyOperations(d.history.present, [operation])) }));
  }
  async function open(file: File) {
    invalidate(); setCandidateFile(null); const token = generation.current.next(); working(true); setError(""); setNotice("Checking the complete file locally…"); owner.setPhase("reading");
    try {
      const incoming = await readExchangeFile(file);
      if (!generation.current.current(token)) return;
      const current = latest.current;
      if (incoming.kind === "sealed") {
        if (current.encrypted?.wrapper.ciphertext === incoming.artifact.wrapper.ciphertext && current.encrypted.wrapper.iv === incoming.artifact.wrapper.iv) {
          setNotice("This encrypted file is already open. Unfinished work and protection intent are unchanged."); return;
        }
        if (current.envelope || current.outgoing) { setCandidateFile(incoming.artifact); setNotice("A locked candidate is ready below. Current work remains open until successful unlock and explicit replacement."); }
        else { clearSecrets(); owner.acceptLocked(incoming.artifact); }
        return;
      }
      if (incoming.envelope.digest === current.envelope?.digest) { setNotice("This exact snapshot is already open. No turns were added; unfinished work and protection intent are unchanged."); return; }
      const apply = () => { clearSecrets(); owner.acceptPlain(incoming.envelope); setNotice("Opened plaintext snapshot. Checksums consistent; authorship unverified. No audio was started."); };
      if (current.envelope || current.outgoing || current.mode !== "plain") confirm("Open a different snapshot?", `This unencrypted file contains ${incoming.envelope.turns.length} turns. Explicit replacement discards current Exchange work and starts a plain session. Files are never merged or ordered by timestamps. Keep any previous sealed file and key first.`, apply);
      else apply();
    } catch (e) { if (generation.current.current(token)) { setNotice(""); setError(e instanceof Error ? e.message : "The coda file could not be opened."); } }
    finally { if (generation.current.current(token)) working(false); }
  }
  async function unlock() {
    const artifact = candidateRef.current ?? (owner.current.mode === "locked" ? owner.current.encrypted : null);
    if (!artifact || owner.pending || !keyInput.current) return;
    let code = keyInput.current.value; keyInput.current.value = "";
    invalidate(); const token = generation.current.next(); working(true, "unlocking"); setError("");
    try {
      const incoming = await decryptEnvelope(artifact, code); code = "";
      if (!generation.current.current(token)) return;
      const apply = () => { clearSecrets(); owner.acceptUnlocked(incoming, artifact); setNotice("Unlocked on this device. Replies include all prior turns and use a new opening key."); };
      if (owner.current.envelope?.digest === incoming.digest) { setCandidateFile(null); owner.acceptUnlocked(incoming, artifact); working(false); setNotice("Same snapshot; unfinished reply preserved. Sealed export intent retained."); }
      else if (owner.current.envelope || owner.current.outgoing) confirm("Replace current work with unlocked snapshot?", "The file authenticated and its complete Exchange content passed validation. Replacing discards current Exchange work. Keep any previous encrypted file and opening key first.", apply);
      else apply();
    } catch (e) { if (generation.current.current(token)) { setNotice(""); setError(e instanceof Error ? e.message : "Could not unlock: wrong key or damaged file."); } }
    finally { code = ""; if (generation.current.current(token)) working(false); }
  }
  async function prepareSeal() {
    if (owner.pending || owner.current.mode !== "private" || owner.current.outgoing || !owner.current.envelope || !keyRetained) return;
    invalidate(); const token = generation.current.next(), current = owner.current.envelope; working(true, "sealing"); setError(""); setReveal(false);
    try {
      const prepared = await encryptEnvelope(current);
      if (owner.prepared(prepared, current.digest, token)) { setNotice("Sealed file prepared. Retain its opening key separately before downloading."); working(false); }
    } catch (e) { if (generation.current.current(token)) setError(e instanceof Error ? e.message : "Sealing is unavailable; current work is unchanged."); }
    finally { if (generation.current.current(token)) working(false); }
  }
  async function copyKey() {
    const prepared = owner.current.prepared; if (!prepared) return;
    invalidate(); const token = generation.current.next();
    try {
      if (!navigator.clipboard?.writeText) throw new Error();
      await navigator.clipboard.writeText(prepared.code);
      if (generation.current.current(token)) setNotice("Opening key copied. Pass it through a separately trusted route.");
    } catch { if (generation.current.current(token)) { setReveal(true); setError("Clipboard copy was unavailable. Reveal the opening key, select it and copy manually."); } }
  }
  function unencryptedExport(kind: "json" | "wav") {
    if (!envelope || outgoing || owner.pending) return;
    const digest = envelope.digest;
    confirm("Export an unencrypted copy?", kind === "json" ? "This separate plaintext file reveals all included messages, labels, source and timing. Encryption cannot recall it. This permission applies only to this snapshot and this download." : "This separate audible WAV is not encrypted. It reveals the timing and source attribution. Messages and aliases are excluded. This permission applies only to this snapshot and this download.", () => {
      const current = owner.current;
      if (current.mode !== "private" || current.envelope?.digest !== digest || current.outgoing) return;
      if (kind === "json") { const plain = preparedFile(current.envelope); downloads.deliver(plain, plain.name); }
      else downloads.deliver(new Blob([exchangeWav(current.envelope)], { type: "audio/wav" }), `codabridge-${current.envelope.exchangeId}-${current.envelope.turns.length}.wav`);
      setNotice("Explicit unencrypted copy download requested. This session still requires sealed exports by default.");
    }, kind === "json" ? "Download this unencrypted JSON" : "Download this unencrypted WAV");
  }
  async function finalize() {
    const current = latest.current, draft = current.outgoing;
    if (!draft || owner.pending || !keyRetained) return;
    invalidate(); const token = generation.current.next(); working(true); setError("");
    try {
      const parent = current.envelope?.turns.at(-1);
      const value = await appendTurn(current.envelope, { id: draft.id, exchangeId: draft.exchangeId, role: nextIndex % 2 ? "B" : "A",
        alias: draft.alias, label: draft.label, message: draft.message, createdAt: null,
        phrase: phraseFromBlocks(draft.history.present.blocks), parent: parent ? { turnId: parent.id, digest: parent.digest } : null });
      if (generation.current.current(token)) { install({ envelope: value, outgoing: null }); setReveal(false); setNotice(`${turnName(nextIndex)} finalized. Download the file to keep and share this snapshot.`); }
    } catch (e) { if (generation.current.current(token)) setError(e instanceof Error ? e.message : "Finalization failed; your draft is unchanged."); }
    finally { if (generation.current.current(token)) working(false); }
  }
  async function arrange(index: number, value: number) {
    const previous = latest.current.envelope; if (!previous || !keyRetained) return;
    invalidate(); const token = generation.current.next(); working(true); setError("");
    try {
      const updated = await changeArrangement(previous, index, value);
      if (generation.current.current(token)) { install({ ...latest.current, envelope: updated }); setNotice("Playback gap updated. Committed turns and their parent links are unchanged."); }
    } catch (e) { if (generation.current.current(token)) setError(e instanceof Error ? e.message : "Playback gap could not be changed."); }
    finally { if (generation.current.current(token)) working(false); }
  }
  async function play(which?: number | "draft") {
    invalidate(); stopField(); setError(""); const token = generation.current.next();
    try {
      let selected = schedule;
      if (which === "draft" && outgoing) selected = schedulePhrases([{ id: outgoing.id, role: turnName(nextIndex), phrase: phraseFromBlocks(outgoing.history.present.blocks) }], []);
      else if (typeof which === "number" && envelope) selected = schedulePhrases([envelope.turns[which]], []);
      if (!selected) return;
      ranges.current = selected.ranges;
      await player.current?.playRendered(renderClickSchedule(selected.events, selected.duration));
    } catch { if (generation.current.current(token)) setError("Synthetic audio is unavailable. Visual history remains available."); }
  }
  const fileForPlain = () => owner.current.mode === "plain" ? file : null;
  async function share() {
    const file = privateMode ? owner.readyArtifact()?.file : fileForPlain();
    if (!file || sharing || owner.pending) return;
    invalidate(); const token = generation.current.next(); setSharing(true); setError("");
    try {
      if (!navigator.canShare?.({ files: [file] })) throw new Error("File sharing is unavailable. Use the explicit file download.");
      await navigator.share({ files: [file] });
      if (generation.current.current(token)) setNotice("Share completed / handed to another app. Recipient delivery and reading are unknown.");
    } catch (e) {
      if (generation.current.current(token)) {
        if (e instanceof Error && e.name === "AbortError") setNotice("Share cancelled. Your exchange is unchanged; no download was started.");
        else setError("Sharing could not complete. Your exchange is unchanged; The explicit file download remains available.");
      }
    } finally { if (generation.current.current(token)) setSharing(false); }
  }
  const selectedBlock = outgoing?.history.present.blocks.find(b => b.id === outgoing.activeId);
  const outgoingPhrase = outgoing ? phraseFromBlocks(outgoing.history.present.blocks) : null;
  return <section className="exchange" hidden={!active} aria-labelledby="exchange-title" data-testid="exchange" data-has-turns={Boolean(envelope)} data-composing={Boolean(outgoing)} data-mode={session.mode} data-operation={owner.phase}>
    <div className="exchange-heading"><div><p className="eyebrow">Personal Coda / Exchange</p><h1 id="exchange-title">A rhythm. A note. Your reply.</h1>
      <p>Send a human message alongside a synthetic pattern. Pass the file back to grow a two-person exchange.</p></div><span className="exchange-badge">{session.mode === "locked" ? (session.encrypted ? "Locked · encrypted file" : "Locked · no retained file") : privateMode ? (session.encrypted ? "Unlocked on this device" : envelope ? "Finalized · not yet sealed" : "Private draft · not yet sealed") : "Plaintext · local files"}</span></div>
    <p className="exchange-warning">{session.mode === "locked" ? "Contents are locked. Only encrypted bytes are retained here; the file format and size remain visible." : privateMode ? "Sealed files need a separate opening key. Anyone with the key can read all included history. Content shown here is plaintext on this device." : "Not encrypted — anyone with this file can read the included messages."}</p>
    <div className="exchange-filebar"><label>Open a coda file<input type="file" accept=".coda.json,.coda.sealed.json,application/json" aria-label="Open a coda file" onChange={e => { const selected = e.target.files?.[0]; e.target.value = ""; if (selected) void open(selected); }} /></label>
      {(envelope || outgoing || session.mode === "locked") && <button onClick={() => confirm("Reset Exchange?", "Discard this snapshot and any unfinished outgoing draft? Retain the file and, for sealed files, its separate opening key first. A lost opening key cannot be recovered.", reset)}>Reset Exchange</button>}
      {privateMode && session.mode !== "locked" && <button onClick={lock}>Lock and forget key</button>}</div>
    <p className="exchange-retention">{session.mode === "locked" ? "After refresh, reopen the saved file and supply its opening key. The app cannot recover a lost key." : privateMode ? "Save the file and opening key to keep this exchange after refresh. Unlocked content stays in memory; a browser exit warning is best effort." : "Save a file to keep this exchange after refresh. Messages stay in memory; a browser exit warning is best effort."}</p>
    {error && <p className="exchange-error" role="alert">{error}</p>}<p className="exchange-status" role="status">{busy ? "Working locally… " : ""}{notice}</p>
    <dialog ref={dialog} className="exchange-confirm" aria-labelledby="exchange-confirm-title" onCancel={e => { e.preventDefault(); invalidate(); }}>
      {confirmation && <><h2 id="exchange-confirm-title">{confirmation.title}</h2><p>{confirmation.detail}</p><div className="exchange-actions">
        <button autoFocus onClick={() => invalidate()}>Keep current work</button>
        <button onClick={() => { const pending = confirmation; if (generation.current.current(pending.token)) attempt(pending.action); setConfirmation(null); }}>{confirmation.accept ?? "Discard current work and continue"}</button>
      </div></>}
    </dialog>
    {(candidate || session.mode === "locked") && <div className="exchange-panel sealed-locked" data-testid="sealed-locked">
      <h2>{candidate ? "Locked candidate · current work is still open" : "Locked file"}</h2>
      {(candidate ?? session.encrypted) ? <><p>Sealed Coda v1 · {(candidate ?? session.encrypted)!.file.size} bytes. Contents appear only after authenticated decryption and complete validation.</p>
        <label>Opening code<input ref={keyInput} autoFocus type="password" autoComplete="off" spellCheck={false} autoCapitalize="none" maxLength={80} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void unlock(); } }} /></label>
        <button className="primary" disabled={busy || !cryptoAvailable()} onClick={() => void unlock()}>Unlock file</button>
        {!cryptoAvailable() && <p role="alert">Sealed files are unavailable here. A secure context and native Web Crypto are required. No plaintext fallback.</p>}
        {candidate && <button onClick={() => { invalidate(); setCandidateFile(null); setError(""); setNotice("Candidate cancelled. Current work is unchanged."); }}>Cancel candidate</button>}
        {session.mode === "locked" && busy && <button onClick={lockNow}>Cancel unlock and stay locked</button>}
      </> : <p>No encrypted snapshot was retained. Open a saved file and provide its key, or reset to start again.</p>}
    </div>}
    {session.mode !== "locked" && <>
    <div className="sealed-mode"><label>File protection<select aria-label="File protection" value={privateMode ? "sealed" : "plain"} onChange={e => { invalidate(); if (e.target.value === "sealed") owner.privateMode(); else reset(); }}>
      <option value="plain" disabled={privateMode && Boolean(envelope || outgoing)}>Plain file</option><option value="sealed">Sealed with an opening key</option></select></label>
      {privateMode && <p>{outgoing ? "Write your note, then finalize it to prepare a sealed file. The recipient can read all included history." : "Finalize, then prepare an encrypted file. Reset explicitly to start a plain exchange."}</p>}
    </div>
    {privateMode && envelope && !outgoing && <div className="exchange-panel sealed-tools">
      <h2>{session.prepared ? "Your sealed file and separate key" : "Prepare a sealed snapshot"}</h2>
      <p>{outgoing ? "Finalize or cancel the outgoing draft before exporting. The next recipient can read every included turn." : "Encrypt the complete finalized history. A new seal uses a fresh independent opening key."}</p>
      {!cryptoAvailable() && <p role="alert">Sealed files are unavailable here. A secure context and native Web Crypto are required. No plaintext fallback.</p>}
      {session.prepared && <>
        <label>Opening key<input ref={displayedKey} autoFocus readOnly type={reveal ? "text" : "password"} value={session.prepared.code} autoComplete="off" spellCheck={false} autoCapitalize="none" /></label>
        <div className="exchange-actions"><button onClick={() => setReveal(v => !v)}>{reveal ? "Hide opening key" : "Reveal opening key"}</button><button onClick={() => displayedKey.current?.select()}>Select opening key</button><button onClick={() => void copyKey()}>Copy opening key</button></div>
        <label className="sealed-ack"><input type="checkbox" checked={session.keySaved} onChange={e => owner.acknowledge(e.target.checked)} />I have saved the opening key</label>
        <p>Keep the file and key separately. The app cannot recover a lost key. Use a separately trusted route; two messages on one compromised service do not create that separation.</p>
      </>}
      <div className="exchange-actions"><button className="primary" disabled={!envelope || Boolean(outgoing) || busy || !keyRetained || !cryptoAvailable()} onClick={() => void prepareSeal()}>{session.encrypted && session.sealedDigest === envelope?.digest ? "Create a new seal" : "Prepare sealed file"}</button>
        <button disabled={!owner.readyArtifact() || busy} onClick={() => attempt(() => { const artifact = owner.readyArtifact(); if (!artifact || owner.pending) return; downloads.deliver(artifact.file, artifact.file.name); setNotice("Encrypted download requested. Its opening key is not included."); })}>Download sealed file</button>
        <button disabled={!shareSupported || sharing || busy} onClick={() => void share()}>Share sealed file</button></div>
      {!shareSupported && <p>File sharing is unavailable here. Download the encrypted file, then choose how to pass it on.</p>}
      <details><summary>What sealing and local lock protect</summary><p>Lock drops app-owned plaintext and key references. JavaScript strings, engine buffers, clipboard, downloads and device memory cannot be securely erased or recalled by this app. Keys do not authenticate a sender; lost keys cannot be recovered. A compromised device or app can read unlocked content.</p></details>
    </div>}
    <div className="exchange-layout">
      <div className="exchange-compose">
        {!outgoing ? <div className="exchange-panel">
          <p className="eyebrow">{envelope ? `Your next turn · ${turnName(nextIndex)}` : "01 / Make a transmission"}</p>
          <h2>{envelope ? "Reply with your own pattern" : "Choose the timing to send"}</h2>
          <p>Copy only timing and source credits. Your message starts blank.</p>
          <label>Pattern for this turn<select aria-label="Pattern for this turn" value={selectedSource} onChange={e => { invalidate(); setSource(e.target.value); }}>
            {hasLocal && <><option value="composer-selected">My selected Composer block</option><option value="composer-phrase">My whole Composer phrase</option></>}
            {recordings.map(r => <option key={r.id} value={`seed:${r.id}`}>Supported seed · {r.source.filename}</option>)}
            {envelope?.turns.map((t, i) => t.role === (nextIndex % 2 ? "B" : "A") ? <option key={t.id} value={`turn:${t.id}`}>Explicit copy of earlier {turnName(i)} pattern</option> : null)}
          </select></label>
          {!hasLocal && <p>No Composer draft is needed. Supported seeds retain their machine-estimate provenance.</p>}
          <button className="primary" disabled={nextIndex >= EXCHANGE_LIMITS.turns || busy || !keyRetained} onClick={() => attempt(() => begin(chosenPhrase(), Boolean(envelope)))}>{envelope ? "Reply with my style" : "Start a transmission"}</button>
          {nextIndex >= EXCHANGE_LIMITS.turns && <p>This file has reached the 8-turn limit. Save it before starting a new exchange.</p>}
        </div> : <div className={`exchange-panel ${activeTurn === outgoing.id ? "is-playing" : ""}`} data-testid="outgoing-draft">
          <p className="eyebrow">Outgoing draft · {turnName(nextIndex)} · independent timing copy</p><h2>A note for the other person</h2>
          <label>Message to include<textarea spellCheck={!privateMode} autoComplete="off" value={outgoing.message} rows={4} onChange={e => edit(d => ({ ...d, message: humanText(e.target.value, EXCHANGE_LIMITS.message) }))} /></label>
          <small>{outgoing.message.length} / 2000 · carried by this file, never decoded from audio.</small>
          <div className="exchange-labels"><label>Display alias (optional)<input spellCheck={!privateMode} autoComplete="off" value={outgoing.alias} onChange={e => edit(d => ({ ...d, alias: humanText(e.target.value, EXCHANGE_LIMITS.alias) }))} /></label>
            <label>Style label (optional)<input spellCheck={!privateMode} autoComplete="off" value={outgoing.label} onChange={e => edit(d => ({ ...d, label: humanText(e.target.value, EXCHANGE_LIMITS.label) }))} /></label></div>
          <p className="exchange-note">Self-declared labels. A/B are alternating conversation roles, not authenticated people or biological styles.</p>
          <label>Outgoing block<select aria-label="Outgoing block" value={outgoing.activeId} onChange={e => edit(d => ({ ...d, activeId: e.target.value }))}>
            {outgoing.history.present.blocks.map((b, i) => <option key={b.id} value={b.id}>Block {i + 1} · {b.seed.recordingId}</option>)}
          </select></label>
          {selectedBlock && <><Pattern block={selectedBlock} label="Outgoing selected block timing" />
            <div className="exchange-actions">
              <button onClick={() => operate({ op: "scale_duration", blockId: selectedBlock.id, factor: .8 })}>Shorten ×0.8</button>
              <button onClick={() => operate({ op: "scale_duration", blockId: selectedBlock.id, factor: 1.25 })}>Lengthen ×1.25</button>
              <button disabled={!outgoing.history.past.length} onClick={() => edit(d => ({ ...d, history: travel(d.history, "undo") }))}>Undo timing</button>
              <button disabled={!outgoing.history.future.length} onClick={() => edit(d => ({ ...d, history: travel(d.history, "redo") }))}>Redo timing</button>
            </div>
            <details className="exchange-gap-editor"><summary>Adjust individual gaps</summary>
              {selectedBlock.times.slice(1).map((t, i) => <NumberEdit key={`${selectedBlock.id}:${i}`} label={`Outgoing gap ${i + 1} (seconds)`} value={t - selectedBlock.times[i]} min={.04} max={5} onCommit={seconds => operate({ op: "set_gap", blockId: selectedBlock.id, gapIndex: i, seconds })} />)}
              {selectedBlock.id !== outgoing.history.present.blocks.at(-1)!.id && <NumberEdit label="Outgoing spacing after this block (seconds)" value={selectedBlock.spacingAfter} min={.05} max={5} onCommit={seconds => operate({ op: "set_spacing", blockId: selectedBlock.id, seconds })} />}
            </details>
          </>}
          <div className="exchange-actions"><button onClick={() => void play("draft")}>Audition outgoing pattern</button><button onClick={() => player.current?.stop()}>Stop Exchange audio</button></div>
          <div className="exchange-preview"><h3>Preview · {turnName(nextIndex)}</h3><p className="exchange-message">{outgoing.message || "(No message)"}</p>
            <p>{outgoing.alias || "No alias"} · {outgoing.label || "No style label"}</p>
            <p>{outgoingPhrase!.blocks.length} {outgoingPhrase!.blocks.length === 1 ? "block" : "blocks"} · {seconds(phraseSpan(outgoingPhrase!))}. Includes {nextIndex} prior turns/messages, shown in Included history.</p>
            <Sources phrase={outgoingPhrase!} /></div>
          <p className="exchange-warning">{privateMode ? "Sealed files need a separate opening key. Anyone with the key can read all included history. Content shown here is plaintext on this device." : "Not encrypted — anyone with this file can read the included messages."}</p>
          <div className="exchange-actions"><button className="primary" disabled={busy} onClick={() => void finalize()}>Finalize {turnName(nextIndex)}</button>
            <button onClick={() => confirm("Discard outgoing draft?", "Discard only this unfinished timing copy and message? The opened exchange and Composer work stay intact.", () => install({ ...latest.current, outgoing: null }))}>Cancel outgoing draft</button></div>
        </div>}
      </div>
      <div className="exchange-history">
        <div className="exchange-panel"><p className="eyebrow">{envelope ? "Included history / Read-only turns" : "02 / Save, pass, reply"}</p>
          <h2>{envelope ? `${envelope.turns.length} ${envelope.turns.length === 1 ? "turn" : "turns"} in this file` : "One file carries the conversation"}</h2>
          <p>{envelope ? "Every reply includes this complete history. Checksums check consistency; a rewriter can recompute them. They do not verify the sender." : "Download A1. The other person opens it and adds B1. Open their file and add A2. A fresh browser can reopen every included turn."}</p>
          {envelope && schedule && <>
            <p>A/B mark alternating turns. Timestamps and delivery delays never set playback timing.</p>
            <div className="coda-turn-timeline" aria-label="Exchange playback timeline">{schedule.ranges.map((r, i) => <button key={r.id} className={activeTurn === r.id ? "is-playing" : ""} onClick={() => { player.current?.stop(); document.getElementById(`exchange-${r.id}`)?.scrollIntoView({ block: "center" }); }}>
              <strong>{turnName(i)}</strong><span>{seconds(r.start - schedule.renderer.leadSeconds)} → {seconds(r.end - schedule.renderer.leadSeconds)}</span>
            </button>)}</div>
            <div className="exchange-actions"><button className="primary" onClick={() => void play()}>Play complete exchange</button><button onClick={() => player.current?.stop()}>Stop Exchange audio</button></div>
            <p>First-to-last-click span {seconds(schedule.span)}. One 0.05 s lead and 0.04 s tail for the complete rendering.</p>
            <div className="exchange-actions">{!privateMode ? <><button onClick={() => attempt(() => { downloads.deliver(file!, file!.name); setNotice("Download requested. Save this .coda.json file to keep and share all included messages."); })}>Download coda JSON</button>
              <button onClick={() => attempt(() => { downloads.deliver(new Blob([exchangeWav(envelope)], { type: "audio/wav" }), `codabridge-${envelope.exchangeId}-${envelope.turns.length}.wav`); setNotice("Synthetic Exchange WAV download requested. Audio does not carry the human messages."); })}>Download Exchange WAV</button>
              <button disabled={!shareSupported || sharing} onClick={() => void share()}>Share file</button>
              <button onClick={() => { invalidate(); owner.privateMode(); }}>Seal this finalized exchange</button></> : <>
              <button disabled={Boolean(outgoing) || busy} onClick={() => unencryptedExport("json")}>Export unencrypted copy</button>
              <button disabled={Boolean(outgoing) || busy} onClick={() => unencryptedExport("wav")}>Export audible WAV (not encrypted)</button></>}</div>
            {!privateMode && !shareSupported && <p className="exchange-note">File sharing is unavailable here. Download the coda JSON, then choose how to pass it on.</p>}
            <p className="exchange-note">WAV is a secondary synthetic rendering, not a reversible acoustic message. Its metadata includes source credit, never messages or aliases.</p>
          </>}
        </div>
        {envelope?.turns.map((turn, i) => <article className={`exchange-turn role-${turn.role} ${activeTurn === turn.id ? "is-playing" : ""}`} key={turn.id} id={`exchange-${turn.id}`} data-testid="exchange-turn" data-turn-id={turn.id} data-digest={turn.digest}>
          <div className="exchange-turn-heading"><h3>Turn {i + 1} · {turnName(i)}</h3><span>{activeTurn === turn.id ? "Playing this turn" : "Immutable snapshot"}</span></div>
          <p>{turn.alias || "No alias"}{turn.label ? ` · ${turn.label}` : ""} <small>· self-declared</small></p>
          <p className="exchange-message">{turn.message || "(No message)"}</p>
          <button onClick={() => void play(i)}>Play {turnName(i)} only</button><Timing phrase={turn.phrase} /><Sources phrase={turn.phrase} />
          <details className="exchange-identity"><summary>Turn identity and parent link</summary><p>ID: {turn.id}</p><p>Content SHA-256: {turn.digest}</p><p>Parent: {turn.parent ? `${turn.parent.turnId} / ${turn.parent.digest}` : "none (first turn)"}</p><p>Self-declared creation time: {turn.createdAt ?? "not supplied"}. Authorship unverified.</p></details>
          {i < envelope.turns.length - 1 && <fieldset disabled={!keyRetained || busy}><NumberEdit label={`Gap after ${turnName(i)} (seconds)`} value={envelope.arrangement.gaps[i]} min={.05} max={5} onCommit={seconds => void arrange(i, seconds)} hint={() => "Human-authored gap: last click of this turn to first click of the next. Prior turns are unchanged."} /></fieldset>}
        </article>)}
      </div>
    </div>
    <p className="exchange-sound" role="status">{sound}{outgoing && activeTurn === outgoing.id ? " · outgoing draft" : activeTurn && envelope ? ` · ${turnName(envelope.turns.findIndex(t => t.id === activeTurn))}` : ""}</p>
    </>}
    <p className="exchange-note">Human-created synthetic timing. Meaning to sperm whales is unknown. No animal playback use.</p>
  </section>;
});
export default Exchange;
