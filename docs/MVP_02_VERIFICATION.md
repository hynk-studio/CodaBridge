# MVP-02 verification

September 12, 2026. Existing Draft [PR #3](https://github.com/hynk-studio/CodaBridge/pull/3), branch `codex/mvp-02-grounded-investigation`, remains stacked on PR #2 / `codex/mvp-01-listen-compare` at `4d09495f9bb31006d310402c8474a94df03d5086`. The unrelated, pre-existing root PNG is preserved and excluded from the change.

**Later authorized private trial:** one real-adapter investigation at `e28bedb` returned `PROVIDER_FAILURE`; cases 2 and 3 were left unrun. Provider request count, returned IDs and usage are unknown. See the [sanitized trial report and evidence](trials/2026-09-12-private-astra/README.md). The no-call statements and mocked checks below remain historical records of the implementation/correction, not the later trial.

## Review 5185693873 correction

Starting head: `afdd3fb5d14b56ee996e2b332a951fae83a57970`, matching the reviewed head and remote branch after fetch. [The review](https://github.com/hynk-studio/CodaBridge/pull/3#pullrequestreview-5185693873) identified two local adapter rejections: legitimate numeric source labels and an assistant message accompanying a function call. The correction changes only provider validation, its worker call site, test-only regression fixtures/tests and documentation. No recordings, measurements, production UI, dependencies, configuration or limits changed.

The two regression cases first failed at the reviewed implementation with HTTP 502 instead of 200:

```sh
node --experimental-strip-types --test --test-name-pattern='accepts supplied numeric|mixed assistant commentary' tests/provider-compatibility.test.ts
```

After correction, the following checks passed:

| Command | Result |
| --- | --- |
| `node --experimental-strip-types --test tests/provider-compatibility.test.ts tests/investigation.test.ts` | **47 passed**: 33 new compatibility cases plus 14 existing investigation cases. |
| `npm run typecheck` | Passed. |
| `npm test` | **70 passed**, no failures or skips. |
| `npm run data:verify` | Four original byte hashes, PCM metadata, source-card hash and deterministic annotations reproduce. |
| `npm run lint` | Passed. |
| `npm run build` | Client and actual Worker ESM built; Worker metadata copied. |
| `npm run test:server-build` | **4 passed**, including mixed output through the compiled adapter and fixture/credential-sentinel exclusion from the client bundle. |
| `npm run test:browser` | **20 passed**, no retries, across Chromium desktop 1440×1000 and mobile 390×844, retaining 320 px / enlarged-text checks. |
| `npm run test:browser -- --grep 'mixed provider commentary'` | **2 passed** on the final fixture, with distinct intermediate/final message IDs. The 47 focused cases, typecheck, lint and 4 built-server checks also passed again after that fixture refinement. |
| `git diff --check` | Passed. |

The realistic test-only transcript contains opaque reasoning, a completed assistant message with `phase: "commentary"`, and one `find_alternatives` call. The actual tool dispatch produces the next request's `function_call_output` before a final structured answer names `11.wav`, `dswp-11`, `7.wav` and the supplied metric version. Tests inspect original replay items and phase, actual retrieval evidence and the final export. Intermediate commentary and opaque reasoning never appear as the final explanation. Browser coverage holds the final response pending, then verifies the visibly unverified final interpretation and export.

Negative cases include unknown numeric filenames/IDs, known-label substring collisions, a forged numeric measurement beside an allowed filename, invented evidence IDs, malformed/refused mixed messages, duplicate/unknown calls and strict arguments. Existing tool-only, no-tool-final, credential protection, byte/deadline/round-limit and failure coverage remains. A deliberately spelled-out numerical assertion is accepted only as unverified prose while deterministic evidence stays unchanged: the lexical restriction does not certify factual correctness. See [the exact checks and limits](MVP_02.md#request-and-evidence-flow).

Official [mixed-output examples](https://developers.openai.com/api/docs/guides/latest-model?model=gpt-4.1), [function calling](https://developers.openai.com/api/docs/guides/function-calling) and [reasoning replay/phase documentation](https://developers.openai.com/api/docs/guides/reasoning) were checked for this correction. Current documentation says `store: false` returns `encrypted_content` by default; no older-behavior workaround was added. These fixtures demonstrate local adapter behavior, **not live Astra compatibility or hosted Sites operation**. The 20-second deadline, 1,800 output tokens per response, four rounds/tool calls and all byte bounds remain unchanged; live latency and output sufficiency are untested.

No credential acquisition, application-model call, Sites creation/save/deployment, public enablement, paid provisioning, merge or force-push occurred. A small authorized real Astra trial, public access/budget decision and hosted Sites verification remain separate. Existing flags are operator acknowledgements, not authentication or a shared spending cap. Earlier staging, manual browser and HTTP observations below are historical evidence from the original MVP-02 implementation, not reruns in this correction.

## Original MVP-02 verification at afdd3fb

The following original implementation record and screenshots are retained for stack continuity. Its earlier counts (37 unit, 3 built-server, 18 browser) are superseded by the correction results above.

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
