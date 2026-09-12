# LIVE ASTRA — restored Composer investigation

**Application/tool path: PASS. Answer quality: PASS FOR THIS CASE.** One UI submission produced two native Worker provider requests, both HTTP 200, and an accepted explanation. The actual model requested creation-to-catalog retrieval for the restored modified second block. Independent arithmetic and manual inspection found no material discrepancy in the answer. This is a case-specific assessment, not automated factual verification or general reliability evidence.

[Owner authorization 5647779910](https://github.com/hynk-studio/CodaBridge/pull/5#issuecomment-5647779910) is **consumed**. No second submission, edit request, replacement, retry, probe or evaluator call occurred. Executed source: **`aa250a98607a61bd9892fd6d9aa0d251fd5ca933`**, production correction **`5703cfd94905c97c10996936409d28a680b7e103`**, [review 5187457832](https://github.com/hynk-studio/CodaBridge/pull/5#pullrequestreview-5187457832). Local, fetched remote and PR heads matched; no newer execution record existed. PR #5 remains Draft on #3 on #2. This closeout changes only documentation/evidence.

## Restored input

An isolated Chromium context imported the historical [delivered project](../2026-09-12-live-composer/creation-project.json) through **Open project**. Normal import advanced revision **4 → 5** and established a fresh binding with `previous: null`. Both blocks, order, title, empty creator text, codebook, timestamps, source references and original file offset **0.3827891156462585 s** matched that file. Nothing played or called Astra during restoration; the successful edit was not repeated.

Selected block **2**, ID **`b-e6d3a950-654c-4779-a725-cba95b2d7e01`**, retained times:

`[0, 0.3, 0.8195294784580499, 1.575651927437642, 1.8034580498866215, 2.1247448979591836]` seconds.

Its first gap is **0.300 s**, span **2.1247448979591836 s**. The original first block is unchanged. [Input and current binding](input.json), [restoration checks](restoration.json) and [fresh deterministic comparison](recomputed-before.json) preserve the actual state. Imported analysis remained historical; its scores were not used as authoritative input.

Mode: **investigate**. Exact question:

> Find the closest real recordings to my currently selected edited block under the normalized interval metric. Exclude its seed and explain the timing differences and limitations.

## Application and actual tool loop

The trusted local wrapper durably recorded [consumption](submission.json) before invoking the actual built handler. The one investigation returned **HTTP 200 / completed / execution: provider** with its exact submitted binding and unchanged draft. [Accepted application result](accepted-result.json) equals the result displayed in the UI.

1. Server-prefilled `compare_creation` targeted the selected block.
2. The model initiated **`find_creation_alternatives`**, arguments `{"blockId":"b-e6d3a950-654c-4779-a725-cba95b2d7e01","limit":3}`. Its recorded evidence equals current deterministic recomputation and includes the resolved real sources.
3. The unchanged handler dispatches that call, appends its result and issued evidence as `function_call_output`, then makes the second provider request. The subsequently accepted explanation cites this tool evidence. This is supported by the normal accepted action/evidence record, two receipts and the executed handler control flow; raw wire payloads and opaque reasoning were not retained.

All structured citations resolve to supplied evidence. The source records match the pinned catalog, not imported narrative. No proposed operation or mutation occurred. Both existing private diagnostics were exactly:

```json
{"kind":"PROVIDER_HTTP_RESPONSE","httpResponseObtained":true,"upstreamStatus":200}
```

No upstream error-envelope/type/code applies. [Execution record](execution.json) contains only the accepted bounded result, existing sanitized diagnostics and local timing.

## Independent answer-quality assessment

Offline arithmetic recalculated gaps, normalized proportions and mean absolute normalized interval differences from the restored timing and pinned catalog, separately from the application's comparison helper. The [assessment](assessment.json) includes full calculations and the separate case verdict. Manual inspection covered free-text source names and comparative statements as well as structured references.

| Accepted claim | Independently checked result |
| --- | --- |
| Current synthetic block and revision | Exact selected stable ID at revision 5; that ID is block 2. No seed/current-block confusion. |
| Six markers, span 2.124745 s; gaps 0.300, 0.520, 0.756, 0.228, 0.321 s | All correct at the stated rounding precision. |
| Closest: DSWP / 11.wav (`dswp-11`), then 2.wav (`dswp-2`) | Actual MAD values **0.08740519967162448**, then **0.09969433121556079**; prose rounds correctly to 0.087405 / 0.099694. Unit is dimensionless. |
| Current block's third gap longest; 11.wav's second and 2.wav's first longest | Correct from each ordered interval sequence; the comparison describes relative timing differences. |
| Four-recording catalog, three candidates after seed exclusion, two eligible | Correct. `dswp-1` is ancestry; `dswp-7` has seven markers versus six and has no distance. All named files/IDs exist. |
| No identical-byte duplicates found | Correct for this catalog. Exclusion/deduplication logic remains in force; this case does not exercise an actual duplicate candidate. |

The answer explicitly limits the result to the small catalog, identifies machine-estimated peaks and absent human review/verified coda boundaries, and explains detection uncertainty. It distinguishes normalized spacing from absolute duration/context and denies meaning, identity, intent and semantic-confidence conclusions. The selected creation remains synthetic. **No material unsupported statement was found.** The UI/export still label generated interpretation unverified; this manual assessment does not change that trust boundary or make citations proof of prose truth.

## Receipts, latency and delivered evidence

Both accepted receipts returned model **`gpt-6-astra`**:

| Response ID | Input / output / total tokens |
| --- | --- |
| `resp_0bf1093032542b81016aa5995bb64087d0aea93e97fe278e9f` | **2,314 / 49 / 2,363** |
| `resp_0bf1093032542b81016aa5995dfd7887d09c5088fd4b87e03f` | **6,865 / 593 / 7,458** |
| Total for this single investigation | **9,179 / 642 / 9,821** |

No settled cost is claimed. Usage for historical failed attempts remains unknown and is not presumed free.

Execution occurred **2026-09-12 UTC / September 13 Asia/Seoul**. Wrapper handler timing was **18:26:34.561 → 18:26:48.527 UTC**, **13,966 ms**. Accepted application timestamps were **18:26:34.562 → 18:26:48.524 UTC**. Browser resource duration was **13,984 ms**. UI timing was **18:26:34.526 → 18:26:48.563 UTC**, **14,037 ms**, from immediately before the sole Ask click until the button returned from pending; it is not an exact paint measurement. [UI observation](ui-observation.json) records the endpoints and one Composer/zero A/B submissions.

- [Same-run LIVE ASTRA screenshot](LIVE-ASTRA-outcome.png): actual accepted question/answer and generated-unverified labels, visually inspected; no replay or resubmission.
- [Actual downloaded project](creation-project.json): **42,816 bytes**, delivered as `codabridge-synthetic-timing-r5-project.json` by **Download project JSON**, with **Include analysis evidence** checked. Parsed contents exactly match the current draft/selection, recomputed deterministic evidence and new accepted result/binding. [Delivery verification](download.json) records the actual event/file and checksum.
- The historical file still has revision 4 and `generated: null`; its accepted edit remains separate. The new download contains revision 5/current investigation and retains the saved-unverified-on-reopen label, synthetic identity, attribution and full limitations. No offline delivery replay was needed. WAV/card regeneration was not run.

## Runtime, checks and cleanup

The proven loopback Miniflare/workerd wrapper loaded the actual built Worker and client assets. Only the existing private observer and local consume/result guard were installed. **No provider transport override, outbound interception, Node fallback, proxy, alternate model/endpoint or hosted runtime.** Native Worker fetch used manual redirects. No 3xx occurred. Model, low reasoning, **20 seconds**, **1,800 output tokens/response**, **four provider rounds** and all smaller validation/byte/tool limits stayed unchanged.

Artifact SHA-256 **`5847d674d35cda724f4fca03ffa463d54ddc6e13bd7fd6bbdfbb3f4f2bbf6dd5`** identifies the built server, not a credential. Node **v25.9.0**, Miniflare **5.20260911.0-alpha**, workerd **1.20260911.1**, Playwright **1.63.0**, Chromium **153.0.8010.12**, compatibility date **2026-09-12**.

| Actual command/check | Result |
| --- | --- |
| `git fetch origin`; authorization/review/history/head/base/Draft inspection | Reviewed head matched; allowance unused; stack preserved. |
| `env -u OPENAI_API_KEY npm run build` | TypeScript, client and Worker build passed. |
| `env -u OPENAI_API_KEY npm run data:verify` | Four original byte hashes, PCM metadata, source-card hash and deterministic annotations reproduce. |
| `env -u OPENAI_API_KEY npm run test:server-build` | **14 passed**, including TEST ONLY native-workerd quantitative-prose/tool and redirect cases. No paid calls in preflight. |
| `env -u OPENAI_API_KEY node --check .tmp/live-composer-investigation.mjs`; `node --experimental-strip-types .tmp/live-composer-investigation.mjs` | Syntax passed; normal UI import and one live submission. Initial noninteractive stdin closed after preparation with **zero submissions**; setup was relaunched interactively before consuming the allowance. [Zero-submission record](setup-without-submission.json). |
| `env -u OPENAI_API_KEY node --experimental-strip-types .tmp/verify-composer-live.mjs` | Independent arithmetic, actual actions/evidence, source equality, bindings, rounding and delivered-project checks passed. Temporary script removed afterward. |
| `env -u OPENAI_API_KEY npm run preview`; loopback GET `/api/investigation/status` | **HTTP 200 / unavailable / NOT_CONFIGURED** at **18:29:41.855 UTC**. No provider probe. |
| Final source/history/privacy checks and `git diff --check` | Application/config/data and historical trial files unchanged; only this evidence and current README pointer added. |

The existing inherited credential was read only after preflight, removed from subprocess inheritance, and supplied only in memory to the isolated server. Both flags were enabled only there. No credential source or Augnes resource was modified; no raw provider payload/header/error/reasoning or credential-derived evidence was retained.

[Trial runtime/context cleanup](runtime-cleanup.json) and [default-disabled check](cleanup.json) confirm disposal and removed transient bindings/harnesses. Port 4173 initially had no reachable ordinary preview, so a key-excluded normal preview was started for the status check and then stopped. The user's ordinary drafts/codebook/tabs, unrelated work and pre-existing untracked image were preserved. The one-shot consumed ledger remains to prevent repetition. No merge, force-push, Site operation, public enablement or account change occurred.

The [first Composer edit and failed investigation](../2026-09-12-live-composer/README.md), prior generic failure, diagnostic retry, no-inference probes, redirect diagnosis, A/B live trials and every TEST ONLY artifact remain unchanged. This success neither recovers nor reclassifies the historical rejected text. **Broader live reliability/latency/output sufficiency, human listening/usability, physical devices, annotation/scientific validity, hosted audio/downloads and Sites readiness remain unverified.** Public authentication/shared budgeting remain separate decisions; operator flags establish neither. Any additional paid request requires new authorization.
