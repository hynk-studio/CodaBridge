# MVP-02 verification

September 12, 2026. Branch `codex/mvp-02-grounded-investigation` starts at PR #2 head `4d09495f9bb31006d310402c8474a94df03d5086`; PR #2 remained open and Draft on final recheck. The new PR is stacked on `codex/mvp-01-listen-compare`. The unrelated, pre-existing root PNG was preserved and excluded from the change.

## Outcomes kept separate

| Boundary | Observed result |
| --- | --- |
| Real server/provider adapter | Implemented: built Workers ESM handler, actual Responses HTTP adapter for documented `gpt-6-astra`, finite tool loop, recomputed evidence and validation. Disabled by default. |
| Mocked integration | Passed through source handler, actual bundled handler and browser UI with injection only at provider transport. Explicit test receipts/labels; no live model inference. |
| Live Astra | **Not run.** No application-model calls, key acquisition or credential-value inspection. Account entitlement, provider behavior and explanation quality remain unknown. |
| Hosted Sites | **Not run.** Local artifact shape/staging and workerd preview passed; no Site creation, save, upload or deployment. |

## Executed checks

| Command / check | Result |
| --- | --- |
| `npm ci` | Passed with updated lockfile; 69 packages audited, zero reported vulnerabilities. |
| `npm run typecheck` and build's `tsc -b` | Passed over app, server, scripts and tests. |
| `npm test` | **37 passed.** Existing arithmetic/export/audio checks plus real-handler mocked transport, malformed/oversized/streamed input, unknown IDs, stale binding, forged measurements/refs, tool validation, duplicates, no-match, unequal counts, refusal/failure/timeout, body-stream deadlines, caller cancellation, round limits and absent metadata. |
| `npm run data:verify` | All four original hashes, source LFS metadata, PCM, source-card hash and unchanged detector estimates reproduce offline. |
| `npm run lint` | Passed without findings. |
| `npm run build` | Client assets and actual `dist/server/index.js` ESM built; Worker metadata copied to `dist/.openai/hosting.json`. |
| `npm run test:server-build` | **3 passed.** Imports the actual built artifact, exercises default disabled fetch/static delegation and successful mocked provider tool loop, scans all client text artifacts for server configuration/endpoint and test sentinels. |
| Sites plugin 0.1.66 `prepare-site-build.cjs` | Local staging accepted the build as **`worker`** into ignored `.tmp/mvp02-sites-stage`. No hosted/account claim. |
| `npm run test:browser` | **18 passed** across Chromium desktop 1440×1000 and mobile 390×844, including existing 320 px / 200% text checks. No retries. |
| Focused failure/timeout browser checks | Rerun after removing diagnostic codes from the public status text; desktop/mobile passed. |
| Direct local workerd HTTP | `/` → 200 HTML; availability → 200 `unavailable`; a valid investigation POST → 503 `NOT_CONFIGURED`; unknown API → 404. |
| Vite development proxy | Same-origin request from port 5173 → expected 503 `NOT_CONFIGURED`; foreign Origin → 403. A discovered dev-origin forwarding mismatch was fixed and rechecked without relaxing production origin validation. |
| Local WAV HTTP | `dswp-11.wav` served as `audio/wav`, 146562 bytes. A Range request returned the full file with 200, not 206. Browser playback/seek uses the verified local Blob and passed; hosted range delivery is unverified. |
| `git diff --check` | Passed. |

The first browser run had four failures from a test selector matching the recording region and several controls. Exact select labels fixed the test ambiguity; the affected cases then passed, followed by the complete 18-test run. This was not a provider/API success claim.

Browser tests route requests through the real request handler with a mocked Responses transport; they do not replace it with hardcoded successful API responses. They cover completion/export, visible deterministic retrieval and cited generated interpretation, pending selection changes with deliberately late completion, return to the old selection without reviving results, completed-selection invalidation, explicit failure/timeout and no-match UI. Original audio checks retain load/decode, original-speed playback, exclusive playback, pause/seek/volume, keyboard controls, source visibility, download precision, missing/corrupt/unsupported audio and retry recovery. Ordinary and mocked success journeys observed no external-origin requests or page errors.

The in-app Browser additionally loaded the production preview and selected `11.wav` / `7.wav`: both showed source-byte checks and decoded waveforms, six/seven markers, deterministic first intervals, **Not comparable**, and a missing interval cell displayed as a dash. Investigation stayed disabled, page overflow was false, and warning/error logs were empty. Raw tab-level CDP `Runtime.enable` succeeded; visible AX, DOM and screenshot observations were used for the UI conclusions. No model invocation or hidden reasoning was exposed. The temporary browser tab and 30-minute keep-awake lease were closed/stopped after inspection.

## Screenshots

Provider-disabled screenshots show the real built workspace after the existing playback/selection journey. Mocked screenshots are panel captures from the real UI/handler path and visibly say **TEST ONLY · Mocked provider transport**. They are runtime captures, not generated mockups or live Astra results.

- Provider disabled: [desktop](screenshots/desktop-chromium-mvp02-unavailable.png), [mobile](screenshots/mobile-chromium-mvp02-unavailable.png).
- Mocked investigation: [desktop](screenshots/desktop-chromium-mvp02-mocked-investigation.png), [mobile](screenshots/mobile-chromium-mvp02-mocked-investigation.png).
- Historical MVP-01 captures remain unchanged.

## Remaining gaps

No human listening/annotation review, biological coda verification, translation/identity/intent inference or scientific validation. No Safari/Firefox/physical mobile-device coverage. Minimum Node 22.18 was not independently run. Generated prose can still be factually wrong despite valid evidence IDs; live latency/output bounds and explanation quality have not been exercised.

No real credential/access/budget path was enabled. Per-request bounds and operator flags are not a global spending cap or public abuse-control system. Hosted Sites secret injection, routing, assets and visitor access still need separately authorized acceptance. No account/database/GPU service, WhAM/dialogue-transfer work, broader WebMCP tools, other repository/Site changes, merge, force-push or deployment occurred.
