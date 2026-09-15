# Launch UX calibration · issue #26

Local implementation from accepted main `2d3eca0424360ea417890b74c8f2c1628b27e8b2` on `codex/launch-ux-calibration`. The Draft PR records the final head. This is UI verification, not a live-model or hosted release acceptance.

## Outcomes

- Home adds **Investigate with Astra** beside the existing quick-start actions. **Make my coda** remains the sole primary action. Entry opens the existing Context Lab → Descriptive pairing → Compare pairings, including after a previous Atlas/Prediction visit. Navigation retains the chosen local control and makes no application-model POST.
- A/B, Composer and Context Lab generated answers use readable labels derived only from accepted evidence kinds. Repeated kinds get stable ordinals; unknown kinds use result-position numbers. Missing/ambiguous IDs are noninteractive. Tab/Enter opens and focuses the exact original disclosure, which retains the raw ID and JSON. Generated text, IDs, ordering, accepted results and exports are unchanged.
- Confirmed `unavailable / NOT_CONFIGURED` uses “Astra isn't enabled for this deployment. Listening, creation, and local analysis still work.” Unknown availability checks use “Astra is unavailable” with the same local-work reminder. Request failures say “Astra couldn't complete this request. Your work is unchanged.” No server message is rendered as failure copy. Cancellation and stale-response guards remain unchanged.

Production files: `src/App.tsx`, `src/InvestigationPanel.tsx`, `src/astra/AstraEvidence.tsx`, `src/astra/citations.ts`, `src/astra/copy.ts`, `src/composer/Composer.tsx`, `src/lab/ContextLab.tsx`, `src/styles.css`, `src/useInvestigation.ts`.

PR #25's “Actions in this result”, initiator labels and exact same-result action lookup are unchanged. Citations reuse its existing disclosure focus behavior. No new progress stages, animations, workspaces, requests, retries or result schemas were added.

## Verification

macOS · Node **v25.9.0** · npm **11.12.1** · Playwright **1.63.0**. Built client and local Wrangler/workerd preview, with the real `OPENAI_API_KEY` excluded. Existing TEST ONLY transports exercise actual handlers; explicit client fault fixtures cover malformed/unresolved responses.

| Command | Result |
| --- | --- |
| `env -u OPENAI_API_KEY npm run typecheck` | Passed |
| `env -u OPENAI_API_KEY npm test` | 256 passed; 0 failed/skipped |
| `env -u OPENAI_API_KEY npm run lint` | Passed |
| `env -u OPENAI_API_KEY npm run build` | Client and Worker passed; client 504.83 kB / 150.43 kB gzip |
| `env -u OPENAI_API_KEY npm run test:browser -- tests/browser/launch-calibration.spec.ts --max-failures=3` | 30 passed across desktop and phone |
| `env -u OPENAI_API_KEY npm run test:browser -- tests/browser/launch-calibration.spec.ts tests/browser/workspace.spec.ts tests/browser/ux-02.spec.ts tests/browser/investigation.spec.ts tests/browser/composer.spec.ts tests/browser/context.spec.ts tests/browser/astra-whale.spec.ts` | 204 passed in 4.7 minutes: 102 desktop + 102 phone, including the 30 calibration checks |
| `git diff --check` | Passed |

Focused coverage includes zero model POSTs from home/rendering/navigation, local use while unavailable, retained Lab modes, Back/Forward, exact repeated citations, safe missing/ambiguous/unknown kinds, Tab/Enter and focused raw disclosures, unchanged full export bytes, and suppressed provider/network/parse details. Citations also remain operable without overflow at 320 px / 200% text / reduced motion on all three answer surfaces. The A/B export-byte test fixes the browser clock because that format includes a download timestamp; the accepted result itself is also compared with the exact response JSON.

Initial test development: an unused test helper stopped the first rebuild; the stale-build browser attempt was stopped (1 failed, 1 interrupted). After removing the helper, the desktop run had 13 passes and 2 fixture-assumption failures: a fresh export timestamp and existing server citation deduplication. Fixing the test clock and testing repeated citations across accepted rows produced the 30-pass run. No production contract or existing assertion was relaxed.

The existing 500 kB bundle warning remains; no threshold/dependency/code-splitting change. Expensive offline fitting/reproduction and unrelated standalone research/Atlas/Exchange/crypto browser suites were not rerun. Normal unit coverage and the affected existing navigation journeys still exercise preservation boundaries.

## Small inspected evidence set

The home entry is visible at 1440 × 1000 and 390 × 844. At 320 × 844 with 200% text it wraps and stays keyboard-operable after scrolling; Make remains visually primary. No page overflow was observed. Generated citations are quiet readable controls; the whale remains supporting status feedback.

| View | Capture |
| --- | --- |
| Accepted-build home | [Before](before-home.jpg) |
| Home desktop | [1440 × 1000](home-desktop.jpg) |
| Home phone viewport | [390 × 844](home-phone.jpg) |
| Home at 320 px / 200% text | [Enlarged](home-320-enlarged.jpg) |
| Generated answer, TEST ONLY | [Readable citations](answer-TEST-ONLY.jpg) |
| Same answer's exact disclosure, TEST ONLY | [Focused original ID and evidence](evidence-TEST-ONLY.jpg) |
| Real local unavailable state | [Public unavailable copy](unavailable.jpg) |
| TEST ONLY failed request | [Work-preserving failure copy](failed-TEST-ONLY.jpg) |

In-app Browser inspection independently observed the home entry, descriptive comparison, confirmed unavailable copy and a 1440 px viewport / 1425 px document width (scrollbar included). Tab-level CDP Network observed zero request events across activation. Automated captures/checks used Playwright Chromium. Screen inspection is not a timed naive-user discovery study, physical-phone test, screen-reader audit or human listening.

## Preserved boundaries / review stop

Only the nine production files listed above, focused tests and this small report/capture set changed. The original four DSWP clips (`1.wav`, `2.wav`, `11.wav`, `7.wav`) and archived Context annotation segment remain the existing sources; no audio or annotation acquisition, modification or new scientific claim occurred.

Whale SVG/body/palette/eye/effects/lifecycle, Preview/Apply/Discard/Undo/Redo, persistence/imports, exact action lookup, Atlas/Prediction, research/data/artifacts, Context calculations, audio ownership, Exchange/Sealed Coda/cryptography, file formats, provider prompts, tool schemas, model configuration, server contracts, access/budget gates, Worker routes, dependencies/lockfile and Sites linkage are unchanged.

No live/paid model request, inference access/configuration change, research regeneration, deployment, Sites create/save/publish, merge or auto-merge. The temporary inspection tab, viewport override and keep-awake lease were cleaned up. Keep the PR Draft and stop for review. Hosted/live/physical-phone/human acceptance remains separate.
