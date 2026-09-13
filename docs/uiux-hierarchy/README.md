# Visual hierarchy and enlarged-layout refinement · 2026-09-13

Continues Draft PR #9 from `41ed66c92e24af24843b73786d97e9b2d0d89142`, still stacked on open Draft PR #8. The current branch matched the reviewed head. Historical [polish](../uiux-polish/README.md) and [follow-up](../uiux-followup/README.md) evidence, and the owner's untracked image, remain unchanged.

## Inspect / change / recheck

| Current-build finding | Implemented correction and recheck |
| --- | --- |
| **Reproduced:** 320 px / 200% text split workspace names inside words; a roughly 276 px sticky header covered the request entry. | Measure the full navigation labels. Keep three buttons where they fit; otherwise show a labeled native Workspace select. All narrow and compact headers scroll away. The final enlarged header is 173 px, with no sticky offset or reserved gap; the focused form is exposed. Desktop sticky offsets follow actual header height. Resizing preserves the workspace, creation and playback state; focus transfers only when the focused navigation control changes presentation. |
| **Reproduced:** repeated synthetic labels, equally prominent selection/actions, nested comparison boxes and a sparse explanatory column beside a dense form. | One **Synthetic playback** group uses existing seed/block/phrase/Pause/Stop handlers. Selected navigation uses a quiet background and underline; selected blocks use blue and explicit selected text. Lime emphasizes the local action. Flattened candidate and question containers; purpose → request type → question → action → answer now follows one readable column. Recording names replace technical IDs in candidate cards and selectors; exact source IDs and metrics stay available. |
| **Reproduced:** closely spaced type sizes and routine notices styled like warnings. | Shared body (1rem), secondary (.875rem), panel (1.375rem) and introductory (2–2.5rem) roles; relative sizing and readable prose widths. Removed redundant touched overrides. Explicit notice state selects neutral information/status or warning/alert treatment; no message-string classification. Download notices still say “requested.” |
| **Already adequate:** fresh exact answers, deliberate closure, explicit edit entry, Apply-to-editor and stale rejection. | Preserved these behaviors. Exact prose/citations remain unchanged, and arrival does not scroll or take focus. Rechecked pending/cancel, failure, Apply, selected audition, Undo/Redo and continued editing. |

Two purposeful passes: baseline inspection and implementation, then recheck/correction. The recheck corrected a text-width measurement feedback loop, clipped recording/control selector values, an unintended typography override and a duplicated storage warning. No further redesign was pursued.

The browser rendered **`.SF NS`**, a local macOS fallback, for sampled prose and navigation; Inter is declared but was not the rendered font. The introductory emphasis rendered local Georgia Italic. No font service or package was added. Composer and Lab text entry remain 1rem; 200% tests retain a 32 px root. Sampled contrast: selected navigation 10.44:1, selected block 11.56:1, primary action 11.99:1, neutral notice 7.35:1 and warning notice 9.81:1. These samples are not an accessibility certification.

## Matching viewport captures

All before images were captured from the current `41ed66c` build, not older foundation screenshots. All after images were visually inspected after passing checks. Open at normal size; these are viewport captures with ordinary scrolling, not tall downscaled pages.

| State | Before | After |
| --- | --- | --- |
| Phone editing/playback · 390×844, unchanged 1.wav seed | [Playback](before-phone-playback.jpg) | [One playback group](after-phone-playback.jpg) |
| Desktop question · 1440×1000, default explanation request pending | [Split panel](before-desktop-question.jpg) | [Single sequence](after-desktop-question.jpg) |
| Desktop current exact answer · same request | [Already open](before-desktop-answer.jpg) | [Open answer retained](after-desktop-answer.jpg) |
| 320×844 / 200% text, focused edit request | [Covered form and split words](before-320-enlarged-focus.jpg) | [Exposed focused form](after-320-enlarged-focus.jpg), [full viewport with focused switcher](after-320-enlarged-header.jpg) |
| 1440×1000 / 200% text, Composer comparison step | [Hierarchy](before-wide-enlarged.jpg) | [Whole labels and quieter selection](after-wide-enlarged.jpg) |
| Phone project-download notice | [Warning-colored information](before-phone-info.jpg) | [Neutral requested-download notice](after-phone-info.jpg) |
| Phone Apply handoff, seed ×1.25 | [Applied editor](before-phone-applied.jpg) | [Applied editor](after-phone-applied.jpg) |
| Phone controlled Lab failure, observed assignment | [Failure](before-phone-failure.jpg) | [Warning remains beside request](after-phone-failure.jpg) |

The phone edit sequence is [unapplied proposal](after-phone-proposal.jpg) → [Apply](after-phone-applied.jpg) → [selected-block audition](after-phone-audition.jpg) → [Undo](after-phone-undo.jpg): 1.578 s → 1.973 s → 1.578 s. Redo and another manual edit also worked. The [Lab answer](after-phone-lab-answer.jpg) retains exact fixture text and opens immediately; deliberate closure survives save/compare steps. Long answers still use ordinary scrolling.

Captures use an isolated loopback app serving the production client and existing Worker with injected **TEST ONLY** transports. The six-second hold is artificial pending-state timing, not observed Astra latency. Controlled failure and empty-configuration/unavailable states were also inspected. The temporary harness and fixed TEST ONLY footer are not shipped product UI and did not drive application styling.

## Actual verification and limits

macOS arm64, Node 25.9.0, npm 11.12.1, Playwright 1.63.0. Commands removed `OPENAI_API_KEY` and both access-gate variables. No real credential was accessed and no paid transport ran.

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS, production client and Worker compatibility build; repeated after final CSS consolidation |
| `npm run test:browser -- --reporter=line` | 84 passed, desktop and phone, 3.5 minutes |
| `npx playwright test tests/browser/workspace.spec.ts tests/browser/polish.spec.ts -g 'layout\|enlarged\|responsive' --reporter=line` | 6 passed after final CSS consolidation, 12.8 seconds |
| `git diff --check` | PASS |

[Measured navigation/focus observations](responsive-navigation.json) cover 1440×1000, 390×844 and 320×844 at default text, plus 320, 900 and 1440 px at 200% text. Tests check full label width, actual text size and focus position, alongside overflow, reduced motion, unchanged draft and zero incidental POSTs. Native keyboard typeahead exercised all three destinations. macOS headless Chromium did not expose the native arrow-key popup reliably; physical keyboard/popup and assistive-technology review remain unrun.

Existing semantic regressions verify exact answers/citations, deliberate closure and stale rejection; proposal preview/Apply/Undo; exclusive audio and stopping; draft/codebook continuity; unchanged calculations and fixed controls; actual WAV/PNG/JSON bytes and project restoration. The visible journey also rechecked field versus synthetic playback, the full Lab segment versus zoom/pair/reassignment, separate creation/investigation exports, and local restoration. Failure leaves editable/measured state usable and removes obsolete generated output.

Unit/data/native-workerd suites were not rerun: their implementations are untouched, and prior results remain historical. No dataset, annotation, formula, ranking, exclusion, control membership, renderer timing, project schema, export renderer, provider prompt/contract/payload/limit, seeded question, or disabled-default change. Sources remain DSWP 1/2/7/11.wav and the same archived Sharma annotation segment with existing attribution.

Human listening, physical devices, assistive technology, live Astra and hosting acceptance remain unrun. Agent walkthroughs are not a human study. No credential/account change, paid inference, public enablement, merge, force-push or deployment occurred.
