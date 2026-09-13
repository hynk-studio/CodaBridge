# UI/UX polish — local review, 2026-09-13

Implemented from `f5a68ceae973efe9295af144065fd977ee5920c9` on `codex/release-uiux-polish`, stacked on the still-open Draft PR #8 (`codex/mvp-04-context-lab`). [Owner dispatch](https://github.com/hynk-studio/CodaBridge/pull/8#issuecomment-5650212173). Earlier verification and live-trial artifacts remain unchanged.

The main journey is now Listen → make a synthetic version → edit and audition → compare real examples → explore an annotated exchange → save. Workspaces stay mounted so navigation retains the creation, codebook and Undo history. Advanced evidence and exact generated text remain accessible through disclosures.

## Short issue / change / recheck log

| Pass | Consequential friction | Implemented change and recheck |
| --- | --- | --- |
| 1 | The opening competed with several entry buttons; listening, editing, analysis and saving formed one long page. | Separate Listen, Composer and Context Lab navigation; Composer and Lab each have three purposeful steps. Walked visible controls at 1440×1000 and 390×844 with access disabled. |
| 1 | Three auditions were grouped without enough selected-block context; numbers and methods preceded useful findings. | Whole-phrase playback stays beside the phrase. Seed and edited auditions move into the selected editor. Quick edits explain their audible effect; precise controls are disclosed. Computed candidate cards precede optional Astra output. |
| 2 | Recheck found a bulky phone editor, unclear control distribution, and hidden playback / focus risks when switching steps. | Compact selectable blocks, direct auditions, stop-on-step navigation, explicit focus handoff, working return-to-recording controls and a selected-block codebook label. Repeated the desktop/phone journey and independent static review. |
| 2 | Control values were hard to compare; zoom, selected pair and fixed segment could be confused. Cards read like methods reports. | Shared-scale chart for observed + all 8 distinct controls, numeric row actions, full-segment overview and a separate reassigned-pair illustration. PNGs lead with the question/intention, pattern and finding; exact values, mappings and any exact model text remain in JSON. |
| 2 recheck | Enlarged text exposed timestamp/select overflow and broken chart numbers; local restoration lacked a clear notice; some disclosures were too short to tap comfortably. | Wrapping timestamps, bounded selects/statistics, stacked chart rows when text needs room, restoration notice, and 44 px Composer disclosures. Rechecked every step at 360/320 px with 200% text and repeated both complete journeys. |

These perspectives and the independent critique are agent self-review, not a human user study. No claim of measured first-time comprehension or demonstration effectiveness is made.

## Viewport comparisons

Open an image at normal size. These are real local app screenshots, not mockups or downscaled full-page captures. Each pair uses the same viewport and underlying visible state; scroll position follows the reorganized workspace.

| State | Before | After |
| --- | --- | --- |
| Desktop Listen, original 1.wav / 2.wav | [1440×1000](before-desktop-listen.jpg) | [1440×1000](after-desktop-listen.jpg) |
| Desktop Composer, one unchanged 1.wav seed | [1440×1000](before-desktop-composer.jpg) | [1440×1000](after-desktop-composer.png) |
| Desktop Lab, default 20 s view | [1440×1000](before-desktop-lab.jpg) | [1440×1000](after-desktop-lab.jpg) |
| Desktop controls, offset 1 | [1440×1000](before-desktop-controls.jpg) | [1440×1000](after-desktop-controls.jpg) |
| Phone Listen, original 1.wav | [390×844](before-mobile-listen.jpg) | [390×844](after-mobile-listen.png) |
| Phone Composer, two blocks; second ×1.25 then first gap +0.05 s | [390×844](before-mobile-composer.jpg) | [390×844](after-mobile-composer.png) |
| Phone Lab, default 20 s view | [390×844](before-mobile-lab.jpg) | [390×844](after-mobile-lab.png) |
| Phone controls, offset 1 | [390×844](before-mobile-controls.jpg) | [390×844](after-mobile-controls.png) |

Additional inspection: [computed candidates](after-desktop-candidates.png), [saving](after-desktop-save.png), [320 px / 200% chart text](edge-320-enlarged-controls.png), [TEST ONLY proposal](TEST-ONLY-proposal.png), [TEST ONLY exact answer](TEST-ONLY-exact-answer.png). Fixture images are isolated browser-test output; they are not live Astra evidence or a visitor-accessible mode.

## Running-app walkthrough and delivered files

[Play the 70-second local walkthrough](local-walkthrough.webm) — 1440×1000, deliberately paced browser automation using visible controls. It shows original recording playback, seed/edited/phrase auditions, two timing edits, real candidates, the annotated exchange, all controls, actual downloads, Undo/Redo and return to saved work. **Silent video; no model fixture, replay or model request.** The playback controls and browser audio engine were exercised; sound quality was not judged by a human.

Actual browser downloads: [creation card](creation-card.png), [synthetic phrase WAV](creation-synthetic-timing.wav), [restorable creation project](creation-project.json), [investigation card](investigation-card.png), [full investigation JSON](investigation.json). The named “Room to breathe” creation comes from the local export/restoration regression; the walkthrough uses the default phrase title. [WAV decoding/restoration check](creation-download-verification.json), [desktop journey](journey-desktop.json), [phone journey](journey-mobile.json).

## Verification

macOS arm64; Node 25.9.0; npm 11.12.1; Playwright 1.63.0 / Chromium 153.0.8010.12. The production client and native local Worker ran at `127.0.0.1:4173`. Commands ran with `OPENAI_API_KEY` removed from the process environment; preview also removed both access-gate environment variables. The local Worker config retains disabled gates and returned `NOT_CONFIGURED`.

| Actual command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm test` | 175 passed |
| `npm run data:verify` | PASS: 4 original hashes/PCM/source-card/annotations; fixed context selection and 7 pairs reproduced |
| `npm run build` | PASS: production client and Worker compatibility build |
| `npm run test:server-build` | 15 passed in native workerd; injected test transports only |
| `npm run test:browser -- --reporter=line` | 78 passed, desktop + phone, 3.1 minutes |
| `npx playwright test tests/browser/polish.spec.ts --reporter=line` | 4 passed after the final disclosure-height correction; final build and lint also passed |

Regressions retain semantic checks for draft/codebook/Undo continuity, exclusive audio and stopping, Apply/Discard and stale proposals, exact generated prose/evidence, unchanged comparisons and control membership, actual WAV/PNG/JSON delivery, browser WAV decoding and project restoration. Controlled test fixtures cover pending, unavailable/error and generated states; no paid transport was called. Both fresh local journeys recorded zero POST requests and zero page errors. Final screenshots and exported PNGs were visually inspected after passing tests.

Every workspace step fit 360/320 px at 200% text without page overflow; the annotated timeline and detailed evidence table retain intentional internal scrolling. Keyboard navigation moved focus to the entered workspace and then its first control; chart rows expose names, values and selected state, and keyboard focus had a 3 px outline. Reduced motion was emulated. Sampled contrast ratios were 8.44:1 for muted page text, 13.45:1 for selected navigation text, and 9.66:1 for the lime focus outline against its panel. This is bounded browser evidence, not broad accessibility compliance.

## Preserved scope and remaining checks

Sources remain the DSWP/Orr Paradise CC BY 4.0 clips `1.wav`, `2.wav`, `7.wav`, `11.wav` with machine-estimated markers, and Sharma et al.'s archived CC BY 4.0 annotations ([DOI](https://doi.org/10.5281/zenodo.10817697)), fixed segment `sw061b001_124-from-row-2-60s-v1`, source lines 2–24. The visible journey uses 1.wav and compares with 11.wav. No new recording, human annotation review, speaker mapping or animal-meaning claim was introduced.

Datasets, formulas, rankings/exclusions, pairing membership, renderer timing, project schema, provenance, provider prompts/contracts/limits and default-disabled access are unchanged. Display rounding affects computed summaries only. Exact generated answers are disclosed unchanged and retained in their accompanying evidence; cards do not substitute shortened model prose for the original.

Human listening, physical-device testing, assistive-technology review, live Astra evaluation and hosted acceptance remain unrun. No paid model request, credential/account change, Sites activation, hosted version, deployment, public app enablement or merge occurred.
