# UX-02 · guided conversation files

Base: `985c883bb6b8cd5bc9084ce77142dc8d6768b17c`. Application/test candidate: `03ab94dac974b2311bfcb1e724358a65f03c8b75`. The following evidence commit changes documentation/captures only. Build hashes, actual download identities, network observations and preserved paths: [verification.json](verification.json).

The hosted baseline remains [codabridge-android-check](https://codabridge-android-check.hynk1240.chatgpt.site/), commit `a6c79b6265033521f423f5884322c1d6b177b7cb`. Draft #23 remains separate and unchanged.

## Before and after

**Owner report:** an Android file was downloaded and selected, but its opening result and the next action were unclear. This proves neither parser failure nor successful import. Earlier assistant guidance obscured the existing **Composer → Save & codebook → Make a transmission** action. Resetting is a diagnostic workaround, not a normal receiving step.

**Observed:** desktop 1440×1000 and mobile 390×844/touch inspection confirmed that entry, Exchange’s **Start a transmission**, and remote opening feedback among competing controls. A retained PUBLIC TEST ONLY plain file opened in this inspection, independently of the owner’s attempt.

| Baseline | Implemented task flow |
| --- | --- |
| Discover Composer or Exchange through workspaces | Home → **Make my coda** / **Open a coda file**, including received and saved copies |
| Transmission entry below secondary exports | Composer playback/editing → explicit selected-block/whole-phrase preview → **Use this coda in a message** |
| Composition, preview and handoff mixed | Rhythm/protection → **Write a note → Review message → Finalize → Save and share** |
| File input clears; outcome elsewhere | **Choose coda file** → persistent local checking/opened/already-open/locked/replacement/failure result |
| Next alternating role competes with sending | Exact requested filename → browser Downloads → pass file → open returned reply; same-device writing is secondary |

**Design inference:** local outcomes and fewer competing actions should improve orientation. This is not measured human comprehension. [WAI grouped-form guidance](https://www.w3.org/WAI/tutorials/forms/multi-page/) and [status-message guidance](https://www.w3.org/WAI/WCAG21/Understanding/status-messages) informed the changes; no WCAG conformance claim is made.

## Behavior and safety

Protection precedes note entry. Review shows the exact note/pattern, block count and included history; Back does not commit, and finalized turns remain immutable. Plain finalization leads to download. Sealed finalization leads to preparation, separate key retention/acknowledgement and download. **Resume saving file and key** restores unfinished key retention; **Create a new seal** is secondary. Repeated downloads remain stable. Preparing a different seal clears the previous download result so its filename cannot be paired with the new key.

File outcomes stay beside the chooser. Same-file reopening explicitly says **No messages were added. Unfinished work was kept.** Sealed candidates show only safe outer information. Wrong-key feedback stays beside Unlock; successful unlock focuses **File opened.** Local filenames are bounded/inert and distinguished from the canonical sealed identifier. Wrong project/Atlas files receive guidance without weakening parsing.

`SessionOwner`, crypto, strict parsers, Exchange formats, parent chains, limits and timing/download/audio owners are unchanged. New presentation state holds only stages and bounded filename/outcome metadata. Lock/reset/replacement clear outcomes and pending focus; locked content is unmounted. Composer project/WAV/card exports remain separate. Home creation resumes existing work, and workspace Back/Forward preserves it.

## Executed acceptance

| Case | Result on actual local candidate |
| --- | --- |
| A | Home → edit/Undo/Redo → message without opening exports; existing draft and selection retained. |
| B | Cold isolated recipient opens a real plain file, sees confirmation and replies without a Composer project. |
| C | Same file visibly confirmed; unfinished Korean/emoji note retained without Reset or duplication. |
| D | Three isolated profiles exchange actual A1/B1/A2 files; prefixes and fresh reopen are byte-identical. |
| E | Real sealed A1/B1/A2: fresh keys/IVs, wrong/earlier-key UI rejection, masked Copy, acknowledgement, stable downloads, lock cancellation/re-unlock and refresh recovery. |
| F | Empty chooser selection, malformed/wrong-format files and cancelled replacement retain current work. |
| G | Presentation Back, browser Back/Forward and Composer/Atlas visits preserve note, Undo/Redo, selection, codebook and analysis. Exclusive audio and Prediction resets pass. |
| H | Actual downloads match identifiers and truthful requested-download feedback. Share regressions preserve cancellation/denial and explicit download without plaintext fallback or false delivery claims. |

Computer Use followed visible labels; file selection used automated chooser plumbing. Playwright provided isolated profiles and explicitly simulated fault/clipboard/share/visibility/provider cases. No application state was injected to complete the Computer Use walkthrough. This is agent-operated testing, not a naive-human or physical Android study.

Two inspect/change/recheck passes corrected touch-button styling, redundant navigation, unlock feedback, preparation/outcome focus and key-retention Resume. Checked 390×844 and 320 px/200% text surfaces had zero page overflow; long filenames, Korean/emoji and full selected Atlas references remain readable. Long histories still require forward scrolling. Checked file/key/download feedback required no backward discovery scroll; no fixed task footer covers controls.

## Checks and evidence

Every command excluded `OPENAI_API_KEY` with `env -u OPENAI_API_KEY`.

| Command / coverage | Result |
| --- | --- |
| `npm run typecheck`, `npm run lint`, `npm run build` | Pass |
| `npm test` / `npm run sealed:test` | 249 / 12 passed |
| `npm run test:server-build` | 15 passed; provider transports are TEST ONLY mocks |
| `npm run sealed:test:browser -- --max-failures=1` | 58 passed |
| Composer, Exchange, workspace/navigation, polish, Atlas and both Prediction browser suites | 102 passed |
| Final build: sealed + Exchange + UX-02 browser suites | 78 passed |
| Additional earlier-key UI and reseal-handoff assertions, both profiles | 2 round trips + 2 reseal cases passed; also included in the final 78 |
| Existing independent Node sealed and Python Exchange/WAV checkers | Actual downloads in both profiles passed; Computer Use Downloads files separately authenticated/validated |

The unchanged `tests/research-analysis.test.ts` passed four tests on the inspected base here and in the full unit run. The earlier Sites result (66 log-target differences, maximum `2.220446049250313e-16`) remains a separate environment qualification. Its assertion/results were not changed or skipped.

Computer Use: Chrome 152/Mac user agent, 1440×1000 desktop; 390×844 portrait, scale 1, one emulated touch point. Playwright: Chromium 153.0.8010.12, desktop/mobile plus 320 px and 200% text. Read-only local CDP confirmed `http://127.0.0.1:4173`, secure context and native random/subtle/encrypt/decrypt/importKey/digest. The inspected desktop console was clean. Isolated plain/sealed journeys had no page errors or detected message/key leaks: only local GET assets/audio/status and in-memory blob downloads. Astra stayed unavailable. No real model calls or credential access occurred.

Captures: [home/mobile](captures/candidate-home-mobile.png), [Composer/desktop](captures/candidate-composer-desktop.png), [review/desktop](captures/candidate-review-desktop.png), [opened/mobile](captures/candidate-file-opened-mobile.png), [already-open/mobile](captures/candidate-already-open-mobile.png), [sealed handoff/mobile](captures/candidate-sealed-handoff-mobile.png). Baseline: [Composer entry](captures/baseline-composer-send.png), [receive area](captures/baseline-receive-mobile.png). Keys are never exposed. Raw regenerated test artifacts stay in ignored `test-results/`; the compact record retains identities, not key files.

## Owner walkthrough and later Sites handoff

1. **Make my coda**, edit/listen, then **Use this coda in a message**. Choose timing scope there; keep editable project backups in **Save & codebook**.
2. Choose **File protection → Write a note → Review message → Finalize**. Download the conversation file. For sealed files, **Prepare sealed file**, retain the separate key, acknowledge it, then **Download sealed file**.
3. Find the file in browser Downloads and pass it using your chosen app. The other person opens it and returns a new file with their reply. Pass sealed keys separately.
4. **Open a coda file → Choose coda file** for a received file or saved copy. Check **File opened.** / **already open.** Unlock when required, then **View / listen to conversation → Reply**, or **Continue your unfinished reply**.

For a separately authorized Sites rollout, use UX source `03ab94dac974b2311bfcb1e724358a65f03c8b75` from `codex/ux-02-guided-exchange`. Reconcile the reviewed UX with genuine registration/test adaptation in Draft #23, retain that Site identity, and verify the exact resulting deployment revision before saving/deploying. No registration, hosted version, deployment, merge or new permanent code freeze was created here.

Remaining physical Android checks: Downloads discoverability, real clipboard/share sheet, app background/document visibility, keyboard/IME and audio comfort/perceptibility. Emulation and local Web Crypto establish none of these. Owner evaluation of comprehension remains due after a separately approved deployment.
