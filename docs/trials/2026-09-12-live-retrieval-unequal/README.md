# LIVE ASTRA: retrieval and unequal-count batch

**Both authorized cases completed and met their acceptance criteria. Two live investigations used three provider requests total.** Case 2 exercised an actual model-initiated retrieval and subsequent accepted answer; Case 3 correctly explained non-comparability. No retry, replacement, evaluator, health-check inference or repeat of Case 1 occurred.

Authority: [owner comment 5645342982](https://github.com/hynk-studio/CodaBridge/pull/3#issuecomment-5645342982), permitting at most two sequential investigations/eight provider requests. Executed source: **`bbddfcf268713fc8873cdaaef5534de03fed1f6c`**, matching local/remote head before execution; its unchanged application baseline is **`933ab107459fbff7c0a9e18447b7d5a5dcfe1b7f`**. No earlier record existed for this authorization. Each case was durably marked consumed before dispatch; Case 3 required a separate local record that Case 2's answer, retrieval and saved evidence had been inspected. Both case allowances are consumed.

## Per-case results

| Case | Selection and exact question | Outcome | Provider requests | Returned tokens: input / output / total | Application / browser request / click-to-UI packet |
| --- | --- | --- | --- | --- | --- |
| **2 — retrieval** | A=`dswp-1`, B=`dswp-2`. “Find another recording closest to A under the normalized interval metric.” | **Completed; criteria met** | **2** | **9,777 / 258 / 10,035** | **11,404 / 11,427.4 / 11,453 ms** |
| **3 — unequal counts** | A=`dswp-1`, B=`dswp-7`. “Can this pair be compared with the current normalized interval metric? Explain the limitation.” | **Completed; criteria met** | **1** | **2,860 / 205 / 3,065** | **5,670 / 5,682 / 5,720 ms** |

All three upstream responses were **HTTP 200**, observed only as the existing private DTO `{"kind":"PROVIDER_HTTP_RESPONSE","httpResponseObtained":true,"upstreamStatus":200}`. Both local application outcomes were HTTP 200 / `completed`, execution `provider`. No HTTP-error envelope/type/code applies. Counts agree between private diagnostics and accepted receipts; the browser observed one investigation request per case.

Application timestamps on **2026-09-12 UTC**: Case 2 **10:46:21.606 → 10:46:33.008**; Case 3 **10:48:44.390 → 10:48:50.060**. Application latency was measured around the handler in workerd. Browser request timing was read from resource timing without collecting headers/payloads. Click-to-UI timing ends at the first accepted evidence packet's generation, not an exact paint timestamp or the later manual inspection.

### Returned provider receipts

All returned model IDs were **`gpt-6-astra`**. These are actual bounded application receipts, not requested-model assumptions.

| Case/round | Response ID | Input / output / total tokens |
| --- | --- | --- |
| 2 / 1 | `resp_04f6c838f3262ace016aa52d7ebe7887d0a6152e808d17efda` | 2,791 / 28 / 2,819 |
| 2 / 2 | `resp_04f6c838f3262ace016aa52d83fed887d0b7a3c0e96ec0eaa8` | 6,986 / 230 / 7,216 |
| 3 / 1 | `resp_052ac0aee432f940016aa52e0ccfb887d0a99587ecfd185261` | 2,860 / 205 / 3,065 |

Batch usage: **12,637 input + 463 output = 13,100 tokens**. No pricing estimate or settled invoice was obtained; token usage is not a bill.

## Acceptance inspection

**Case 2 passed.** In addition to the three server-required recording/comparison actions, the accepted action record contains **`find_alternatives({"referenceId":"dswp-1","limit":1})`, initiated by `model`**, resolving to `retrieval:dswp-1:1`. Two accepted receipts and that action identify the real tool round. In the unchanged Worker loop, this dispatch returns the tool result, which is appended as `function_call_output` with supplied evidence before the next Responses request and final explanation acceptance. No provider payload was retained to establish this control-flow evidence.

The actual retrieval exactly matched a key-excluded deterministic recomputation. Both selected IDs were excluded. The remaining candidates were `dswp-11` and `dswp-7`: `dswp-11` has the required six estimated markers and the sole eligible distance **0.09835190471540153**; `dswp-7` has seven markers and was rejected with `UNEQUAL_CLICK_COUNTS`. The metric is `normalized-interval-mad v1.0.0`. Returned candidate hashes differ from the selected hashes. All four catalog files have distinct byte hashes, so **no duplicate candidate existed to exercise duplicate suppression live**; `excludedDuplicates` is correctly empty.

The accepted answer names `11.wav` / `dswp-11` as the closest eligible alternative in the pinned catalog, cites the issued retrieval, correctly explains the `7.wav` rejection, and limits the ranking to timing. Annotation uncertainty and unverified biological boundaries remain explicit. Every citation exists; no new numerical measurement claim or unsupported semantic/identity/biological conclusion was observed. Exact evidence and a LIVE ASTRA viewport were saved **before changing selection**. Server-prefilled actions alone were not counted as retrieval success.

**Case 3 passed.** The current catalog and UI confirmed six versus seven estimated markers. The accepted server comparison is **`not-comparable / UNEQUAL_CLICK_COUNTS`**, with no distance field. Astra explains the equal-count requirement and explicitly says that alignment, padding and truncation are not performed. It does not invent a distance or convert non-comparability into biological dissimilarity, shared meaning, identity or dialogue. All citations resolve. Only the three server-required actions ran; no additional model tool was needed or claimed. HTTP completion alone was not used as either quality verdict.

## Download delivery and retained evidence

Each in-app live page received **one** Download-button click and displayed its acknowledgement, but neither exposed a download event within the bounded wait. **In-app file delivery remains unconfirmed**, independently of model success. Exact displayed evidence JSON and readable LIVE ASTRA viewport captures succeeded for both executions.

The separately authorized **TEST ONLY saved-result replay** then used ordinary **Playwright Chromium 153.0.8010.12 (headless)**. The real built Worker remained `unavailable / NOT_CONFIGURED`, with no key or enabled live flags and outbound egress intercepted. Browser-only availability/result fixtures replayed each already accepted application result; no provider adapter was invoked. Each replay clicked the unmodified Download button once, received an actual file, parsed it and verified the selected sources, comparison, exact accepted investigation, original receipt IDs and investigation timestamps. **Both replay downloads passed; zero provider requests and zero outbound Worker calls occurred.** This is download-behavior evidence, not two new live investigations or proof of in-app delivery. The replay files' `generatedAt` values are export times; their investigations retain the original live timestamps.

| Artifact | Case 2 | Case 3 |
| --- | --- | --- |
| Sanitized execution, receipts, actions and timing | [Observation](case-2-observation.json) | [Observation](case-3-observation.json) |
| Exact live-page packet; its investigation equals the accepted application result | [Live evidence](case-2-current-evidence.json) | [Live evidence](case-3-current-evidence.json) |
| **LIVE ASTRA**, executed source `bbddfcf` / application `933ab107` | [UI capture](case-2-live-astra.png) | [UI capture](case-3-live-astra.png) |
| **TEST ONLY replay**: actual delivered Download-button file | [Replay download](case-2-replay-download.json) | [Replay download](case-3-replay-download.json) |

[Batch observation](batch-observation.json) records totals and cleanup. [Download replay observation](download-replay-observation.json) records file-delivery checks separately. Full accepted explanations and supporting evidence are retained in the live packets; raw provider responses, errors, headers, request payloads and opaque reasoning are not retained.

## Runtime, verification and cleanup

The proven loopback Miniflare/workerd launcher ran the actual built Worker and default real provider adapter with native Worker fetch and the existing private diagnostic observer. There was no provider-transport override, Node fallback, proxy, alternate endpoint/model or remote runtime in the live batch. Runtime: Node **v25.9.0**, Miniflare **5.20260911.0-alpha**, workerd **1.20260911.1**, compatibility date **2026-09-12**. Built artifact SHA-256 remained **`6857f305a59e2d6e0172d9d105ac1c32a879cdb10ed830eed8d701fb1f33877e`**—an artifact hash, never a key hash.

The existing canonical key was read only into the isolated server binding after preflight and removed from the launcher's inherited environment before subprocess startup. The original credential source and Augnes resources are unchanged; no unrelated credential store was inspected. Both operator flags were true only in the temporary live runtime. The existing Responses endpoint, `gpt-6-astra`, low reasoning, **manual redirects**, **20-second deadline**, **1800 output tokens/response**, **four provider/tool rounds per investigation** and every byte/source/evidence/final-answer bound were preserved. No code, prompt, schema, data or parameter changed. No live redirect occurred; the prior synthetic redirect regression remains separate evidence.

| Actual command/check | Result |
| --- | --- |
| `env -u OPENAI_API_KEY npm run build` | Passed; actual client/Worker artifacts and TypeScript check. |
| `env -u OPENAI_API_KEY npm run data:verify` | Four original byte hashes, PCM metadata, source-card hash and annotations reproduce. |
| `env -u OPENAI_API_KEY npm run test:server-build` | **12 passed** before live key loading. |
| `env -u OPENAI_API_KEY node --check .tmp/live-batch-launcher.mjs`, then `node .tmp/live-batch-launcher.mjs` | Syntax passed; guarded real runtime started; two sequential authorized submissions only. |
| Key-excluded deterministic retrieval/evidence assertions | Actual retrieval equals recomputation; selected/hash exclusions, count eligibility, citations and exact live packet/application equality passed. |
| `env -u OPENAI_API_KEY node --experimental-strip-types .tmp/live-batch-download-replay.ts` | **Two delivered files verified** in the explicitly offline replay; no model requests. |
| `env -u OPENAI_API_KEY npm run preview`, local availability GET | **HTTP 200 / unavailable / NOT_CONFIGURED**, **10:52:59.134 UTC**. Local Node HTTP client only; no provider fallback or inference. |
| Source/history, sanitation, cleanup and `git diff --check` | Passed. No application/history edits; both checked-in flags false. |

The live launcher/workerd, in-app tab, keep-awake lease, replay browser/runtime and normal cleanup preview were stopped. Temporary harnesses and live bindings were removed; the loopback port was confirmed closed. The original credential source is unchanged. No full-suite rerun was needed for this report-only closeout.

All historical [failed trials](../2026-09-12-private-astra/README.md), [diagnostic retry](../2026-09-12-private-astra-diagnostic-retry/README.md), [transport probes](../2026-09-12-worker-transport/README.md), [constructor diagnosis](../2026-09-12-request-constructor/README.md), [successful Case 1](../2026-09-12-post-fix-live-astra/README.md) and TEST ONLY screenshots remain unchanged. These two successes establish bounded local cases, not broad reliability, a latency/output guarantee, scientific validity, in-app download delivery or hosted Sites readiness. Public authentication and shared-budget decisions remain separate; existing flags supply neither. No merge, force-push, deployment/save, public enablement, account change, provisioning or new feature occurred.
