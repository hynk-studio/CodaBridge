# Bounded usability follow-up · 2026-09-13

Continues Draft PR #9 on `codex/release-uiux-polish`, inspected at `0fa1e35f53167eecf8d94108001fc4c703eb08ba`. The local and remote heads matched; the existing untracked owner image was left alone. This was one focused inspect/fix/recheck cycle. The [original polish report and artifacts](../uiux-polish/README.md) remain unchanged.

| Concern | Finding | Small correction and recheck |
| --- | --- | --- |
| Find the requested explanation | **Reproduced** in Composer and Lab: successful answers arrived in closed disclosures. Lab repeated the pre-existing deterministic finding ahead of the closed answer. | Fresh current answers start open, with an “Answer ready” status. Removed only the repeated Lab summary inside the generated result. Exact text and citations remain unchanged; supporting evidence stays closed. Completion does not scroll or move focus. A disclosure deliberately closed by the reader stays closed across internal step navigation; a new request gets a fresh open answer. |
| Ask → preview → apply → audition → Undo | **Reproduced**: the ordinary editor offered no direct entry to natural-language editing; applying left the visitor in Compare & ask with the proposal gone and history in another step. | “Describe an edit with Astra →” enters the existing request form in edit mode. “Apply & return to editor” explicitly returns to the selected block and existing audition/history controls. Preview leaves the draft unchanged; Apply, selected-block playback, Undo, Redo and continued editing passed. No duplicate playback/history implementation. |
| Immediate context and request failure | **Already adequate** for field/seed/selected-block/phrase identity, selected block, fixed-segment vs pair/zoom, separate creation/investigation exports, and unavailable/restored wording. **Reproduced** for a failed Lab request: its notice was far above the form. | Request notices now stay beside the Composer/Lab request while that step is visible. Failure removes the prior generated result and leaves the creation and measured comparison usable. Other labels, persistence and export behavior were left alone. |

Explicit entry and Apply actions use the existing navigation/focus handler. Answer arrival does not navigate, focus, or force a scroll. A long answer can extend below the viewport and be read with ordinary scrolling; no disclosure must first be opened. The pending state offers cancellation and makes no progress or retry claims. Selection, revision, question and workspace invalidation continue rejecting obsolete results.

These are agent observations of controls and rendered output, not a human comprehension study. Human listening, physical-device and assistive-technology behavior, live Astra answer quality, and hosting remain **uncertain/unrun**.

All captures below are real viewport screenshots from a separate loopback-only context serving the production client and existing Worker with injected **TEST ONLY** transports. No real credential was used. Success requests were held for six seconds solely to inspect pending UI; that is imposed fixture timing, not Astra latency. A controlled failure and the ordinary empty-configuration/unavailable state were also inspected. The temporary harness and its TEST ONLY footer are not application features and are not shipped.

| State | Before | Recheck |
| --- | --- | --- |
| Composer explanation, 1440×1000 | [Arrival](before-composer-answer.jpg) | [Controlled pending](after-composer-pending.jpg), [open exact answer](after-composer-answer.jpg) |
| Lab explanation, 1440×1000 | [Closed answer beneath existing finding](before-lab-answer.jpg) | [Open exact answer](after-lab-answer.jpg), also [390×844](after-phone-lab-answer.jpg) |
| Lab failure, 390×844 | [No nearby failure notice](before-phone-failure.jpg) | [Failure beside the request](after-phone-failure.jpg) |
| Apply handoff | [Previous desktop state](before-applied.jpg) | Phone sequence: [unapplied proposal](after-phone-proposal.jpg) → [applied editor](after-phone-applied.jpg) → [selected-block audition](after-phone-audition.jpg) → [Undo](after-phone-undo.jpg) |

Open images at normal size. Scroll position follows the content being inspected; answer captures were framed using ordinary keyboard scrolling, not automatic answer navigation. The phone sequence shows a 1.wav-derived block changing from 1.973 s to 2.466 s and returning to 1.973 s on Undo. Display rounding is existing presentation only. The audition capture was taken after redoing that same applied edit; no human sound-quality judgment is implied.

Verification used macOS arm64, Node 25.9.0 and npm 11.12.1. Commands ran with `OPENAI_API_KEY`, `CODABRIDGE_INVESTIGATION_ENABLED` and `CODABRIDGE_ACCESS_REVIEWED` removed from the process environment. Browser tests use the existing injected test transports; the ordinary local Worker remains disabled.

| Actual command | Result |
| --- | --- |
| `npm run typecheck` | PASS, repeated after final test capture additions |
| `npm run lint` | PASS, repeated after final test capture additions |
| `npm run build` | PASS: production client and Worker compatibility build |
| `npx playwright test tests/browser/composer.spec.ts tests/browser/context.spec.ts tests/browser/polish.spec.ts --reporter=line` | 58 passed, desktop 1440×1000 and phone 390×844, 2.9 minutes |
| `npx playwright test tests/browser/composer.spec.ts tests/browser/context.spec.ts -g 'focused follow-up' --reporter=line` | 4 passed initially; 4 passed again after adding narrow-layout captures, 13.1 seconds |
| `git diff --check` | PASS |

Only two focused regressions were added. They check exact generated text/citations, initial disclosure state and deliberate closure, no arrival focus/scroll change, pending/failure handling, selected proposal Apply/Undo/Redo, playback ownership, continuity and stale rejection. The affected existing suites also exercised actual WAV/PNG/JSON downloads, project restoration, codebook/history continuity, deterministic comparisons, fixed control membership and default-disabled operation. The unchanged local journey recorded no model POSTs or page errors. At 320 px with 200% text, the affected forms and explicit keyboard entry fit without page overflow; the resulting screenshots were visually inspected. Existing broader 360/320 px, enlarged-text and reduced-motion checks also passed. Browser-rendered controls were inspected again after the passing suite; this is not broad accessibility certification.

Data verification, unit suites and native-workerd checks were **not rerun** for this presentation-only follow-up; their prior results remain historical evidence in the original report. The production Worker compatibility build did run. No server/provider, model/prompt/limit, dataset, calculation, ranking/control, renderer, project-schema, attribution, hosting or historical artifact file changed. Sources remain DSWP 1/2/7/11.wav and the same archived Sharma annotation segment; this visible edit sequence used the 1.wav seed and the unchanged Lab segment. No paid model call, credential/account change, merge, force-push, deployment or public app enablement occurred.
