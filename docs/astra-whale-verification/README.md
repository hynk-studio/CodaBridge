# Astra pixel whale · implementation and verification

Continues [Draft PR #25](https://github.com/hynk-studio/CodaBridge/pull/25) on `codex/astra-whale-indicator`. Implemented from the corrected reference head `3299bd48131508d8c12f3a2d87c18155f20e69c8`, fast-forwarded from `fd2bf7c`. The PR body records the final implementation head.

## Runtime behavior

One shared React/inline SVG body uses square cells and the approved teal palette, raised tail, lower fin and blue square eye. The artboard stays 88 × 88 CSS px on desktop and 72 × 72 below 620 px. The reference PNG is documentation only; it is absent from the built client and Worker artifacts. No dependencies were added.

The indicator sits beside the existing Composer edit/investigation, descriptive Context Lab and A/B request status. Answers and proposals retain their existing presentation and values. Ordinary editing, Atlas, Prediction and Exchange have no visible mascot.

| Client state | Presentation |
| --- | --- |
| Unavailable/checking access | Static, subdued whale; existing availability text |
| Ready | Static whale; ready/question text |
| Pending | Gentle local float and sparse square shimmer; “Astra request in progress…” |
| Accepted investigation | Pending motion stops immediately; “Answer ready”; brief square accent |
| Accepted edit | “Proposal ready — review before applying”; existing Preview/Apply/Discard controls |
| Failed | Motion stops; existing generic failure message; no result or actions |
| Cancelled/invalidated | Motion stops immediately; cancellation text or ready state; obsolete responses cannot become completed results |

Motion uses CSS, with no animation timers or per-frame React updates. Intersection and document-visibility observation pause decoration; hiding a request panel does not restart inference. Reduced motion disables all animation and retains the text and static square effects. The SVG is `aria-hidden` and non-focusable. Existing status/alert conventions carry the text, with completion announced once.

All existing generation, binding and AbortController guards remain. A/B question changes now also use its existing cancellation owner, matching the other request areas. No result is delayed for animation; no edit auto-applies. No live reasoning/tool stages, percentages or ETAs are presented.

“Actions in this result” reads only the accepted result's ordered action list. Known tools use allowlisted labels. `initiatedBy:"model"` means “Requested by Astra”; `initiatedBy:"server"` means “Performed by CodaBridge”. A result with no model tool actions says so without implying no model answer was generated. The disclosure makes no citation claim about retrieved items. Unknown names get a generic label; arguments are never inspected by the summary.

The Composer/Lab evidence disclosure now selects deterministic evidence, exact explanations and returned receipts instead of dumping the entire result, private draft binding or proposal preview. Generated text, evidence IDs, measurements, rankings, proposals, source attribution, validators and existing exports remain unchanged. Browser tests obtain complete protocol results from the TEST ONLY HTTP response when checking fields intentionally omitted from the UI.

## Approved reference check

Before implementation, the PNG opened successfully at **1200 × 420**; `docs/astra-whale` contained only `README.md` and `astra-whale-reference.png`.

- Git blob: `af06d4207c57d3d07beabf57b98e2cd2578a3e49`
- SHA-256: `0962b0112f7fb4ae14936b14acfef518c051282a7fefecbf123fa874f7e039a5`
- Body palette: `#0c8f7f`, `#0b6f67`, `#11aa8e`, `#2cdab4`; eye: `#3978c6`

The body and palette were compared with that reference at actual desktop and phone UI size. The approved PNG remains unchanged.

## Verification · 2026-09-15

Environment: macOS, Node **v25.9.0**, npm **11.12.1**, Playwright **1.63.0**, Vite **8.3.0**. Tests served the production client through the local Wrangler/workerd preview. API fixtures inject the existing TEST ONLY provider transport into the production request handlers; they never use a real credential or a live model.

| Exact command | Outcome |
| --- | --- |
| `env -u OPENAI_API_KEY npm run typecheck` | Passed ([log](typecheck.txt)) |
| `env -u OPENAI_API_KEY npm test` | 251 passed, 0 failed/skipped ([log](unit-tests.txt)) |
| `env -u OPENAI_API_KEY npm run lint` | Passed ([log](lint.txt)) |
| `env -u OPENAI_API_KEY npm run build` | Client and Worker passed ([log](build.txt)); client chunk 502.27 kB / 149.53 kB gzip triggers Vite's 500 kB warning |
| `env -u OPENAI_API_KEY npm run test:browser -- tests/browser/astra-whale.spec.ts --project=desktop-chromium --max-failures=3` | Initial 32 focused desktop cases passed |
| `env -u OPENAI_API_KEY npm run test:browser -- tests/browser/astra-whale.spec.ts tests/browser/composer.spec.ts tests/browser/context.spec.ts tests/browser/investigation.spec.ts` | 130 passed on desktop and phone ([log](browser-all.txt)) |
| `env -u OPENAI_API_KEY npm run test:browser -- tests/browser/astra-whale.spec.ts --grep 'unavailable\|disclosures exclude\|stay outside\|visual evidence\|reduced motion keeps'` | 14 passed after adding privacy/scope checks and refining captures ([log](browser-final-focused.txt)); includes four new cases and ten repeated checks |
| `env -u OPENAI_API_KEY npm run test:browser -- tests/browser/astra-whale.spec.ts --grep 'arrives after abort\|disclosures exclude'` | 34 passed after strengthening late-response checks to await delivery and rendering, and checking keyboard Tab/Enter through proposal controls and the action disclosure ([log](browser-late-keyboard.txt)) |
| `git diff --check` | Passed |

The first video-test launch stopped during test collection because Playwright disallows worker-scoped video settings inside a describe group. Moving the setting to file scope resolved it before the passing runs above.

Coverage includes every lifecycle state for all four flows, explicit cancellation, question/binding/workspace invalidation, responses delivered even after abort, no added network traffic during animation/completion, no model POST from rendering, zero model tool actions, exact model/server action order, inert imported/restored analysis, hidden-panel motion, keyboard submission/Tab order/disclosure activation and focus retention, and unchanged Preview/Apply/Undo/Redo, answers, measurements and downloads. Additional privacy tests verify that accepted private creator text and tool arguments do not appear in the result disclosure. The actual local server's status endpoint still returned `unavailable / NOT_CONFIGURED`.

Independent in-app-browser inspection used DOM/screenshots and available tab CDP Runtime/Network access at desktop and 390 px, confirming 88/72 px artboards and no horizontal overflow. Its user agent reported Chrome 152; inspected error logs were empty. `Browser.getVersion` is unsupported by that CDP bridge, so the displayed user agent was read instead. The temporary tab, viewport override, preview and keep-awake lease were cleaned up.

## Running-app evidence · TEST ONLY

- [Desktop pending](desktop-pending.png) · [completed answer](desktop-completed.png) · [unavailable](desktop-unavailable.png)
- [Phone pending](phone-pending.png) · [completed answer](phone-completed.png) · [unavailable](phone-unavailable.png)
- [320 CSS px, 200% root text](320-enlarged.png): no horizontal page overflow; fixed 72 px artboard
- [Reduced-motion pending in Lab](phone-reduced-pending.png) · [desktop Lab](desktop-reduced-pending.png) · [completed Composer](desktop-reduced-completed.png)
- [Silent pending → completed clip](pending-to-completed-TEST-ONLY.mp4): actual Playwright video, trimmed to 2.12 seconds, H.264 1440 × 1000, no audio stream; start/end frames inspected. Controlled fixture delay and camera pacing exist only in tests.

## Preservation and limits

Tests used the existing attributed `1.wav`, `2.wav`, `11.wav` and `7.wav` recordings (DSWP / orrp/DSWP pinned revision `a2e5d6dd02fc60343e1288c33314e14e8b7aa5be`, CC BY 4.0) and the existing Context Lab segment `sw061b001_124-from-row-2-60s-v1`, CSV lines 2–24, from the pinned CC BY 4.0 archive. No recordings, markers, annotations or provenance were changed; no new human listening/review is claimed.

The diff against the corrected reference head leaves server/provider code, prompts, schemas/contracts, credentials/access gates, data/research artifacts, Atlas/Prediction artifacts, Exchange/crypto, package/lock files and hosting/build configuration unchanged. No research artifacts were regenerated. No live model call, inference enablement, deployment, hosting change, PR merge, force-push or new branch/PR occurred. The unrelated pre-existing image remains untracked and untouched.

This is local automated and visual UI evidence. Live-provider behavior, hosted Sites acceptance, physical-phone and screen-reader validation, and human listening were not performed. PR #25 remains Draft for review.
