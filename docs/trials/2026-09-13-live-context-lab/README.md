# LIVE ASTRA — first Context Lab investigation

**Application/tool path: PASS. Answer quality: PASS FOR THIS CASE.** One UI submission produced two native Worker provider requests, both HTTP 200, and an accepted explanation. Astra requested the actual offset-1 control. Independent CSV arithmetic and manual inspection found no material factual discrepancy. This is a case-specific assessment, not automated factual verification or general reliability evidence.

[Owner authorization 5649832093](https://github.com/hynk-studio/CodaBridge/pull/8#issuecomment-5649832093) is **consumed**. No second investigation, retry, replacement, probe, evaluator call or other model request occurred. Executed head **`6e83e7681ce705a4d052df517b9abdc118b135e3`**; application source **`8cc61f7f240ce007c3263a13721edd2d06550606`**; [review 5188851539](https://github.com/hynk-studio/CodaBridge/pull/8#pullrequestreview-5188851539). Local, fetched remote and PR heads matched, with no newer execution record. Changes after application source were report/artifact-only. This closeout changes documentation/evidence only; PR #8 remains Draft on integrated main.

## Actual input and execution

A fresh isolated Chromium context opened the normal Context Lab UI and selected **row-12**, local caller A, onset **152.9482 s**, and **offset 1**. Registered dataset **`zenodo-10817697`**, segment **`sw061b001_124-from-row-2-60s-v1`**, REC **`sw061b001_124`**, full interval **126.0372–186.0372 s**. The normal UI generated the [current input/binding](input.json); no fixture result or binding was reused. The comparison covers all 60 seconds, independent of the inspected row and timeline viewing window. Composer state in ordinary browser contexts was untouched.

Exact default question, submitted once through `/api/lab`:

> Does the similarity depend on the pairing? Compare the observed calls with reassigned pairings and explain other possible explanations.

The trusted local guard durably recorded [consumption](submission.json) **before invoking the built handler**. The [accepted application result](accepted-result.json) has `execution: provider`, the exact current binding, and these actions:

1. Server-prefilled `exchange_info` for row-12 and `compare_observed_pairing` for the full segment.
2. Model-initiated **`control_result`**, arguments `{"segmentId":"sw061b001_124-from-row-2-60s-v1","offset":1}`.
3. Actual tool evidence, followed by the second provider response and accepted final explanation citing that evidence.

Replay is supported by the accepted action/evidence record, two receipts, and the unchanged handler's `function_call_output` replay before its next request. Raw wire data and opaque reasoning were not retained. All structured citations resolve; source rows, timings, hashes, callers, method and selection match. Both [private diagnostics](execution.json) are exactly `{"kind":"PROVIDER_HTTP_RESPONSE","httpResponseObtained":true,"upstreamStatus":200}`. No HTTP error type/code applies and no redirect occurred.

## Independent answer assessment

[Independent calculation](independent-calculation.json) parsed the original CSV with Python `csv`/`Decimal`, summing the true `nClicks−1` ICIs without using the application parser/comparison helper. It derives the positive-overlap pairs and rotates all nine ordered B durations over those fixed slots. The [assessment](assessment.json) checks the delivered comparison and generated prose separately.

| Checked fact | Result |
| --- | --- |
| Full segment / fixed pairs | 23 calls: 14 A, 9 B; seven pairs involving 14 unique calls |
| Observed / offset 1 | **0.1328669571 / 0.1438996286 s** |
| Distinct nonzero controls | Eight; no equivalent rotations |
| Control range / median | **0.0837865857–0.1940878000 / 0.1652622571 s** |
| Controls closer than observed | **Offsets 4 and 8**; the answer correctly says two of eight are closer |
| Row-12 example | A duration **0.8275417 s**; original B row-11 **0.967213 s**, reassigned row-13 **0.946011 s**; pair difference falls **0.1396713 → 0.1184693 s** while the overall mean rises |

All nine free-text B assignment mappings are correct, including inventory rows outside the overlap pairs. The answer describes **call-duration differences**, not response latency, silence or normalized rhythm. It keeps original slots/timing/audio fixed, identifies controls as analytical comparisons, and gives alternative accounts without asserting causes or independent samples. It distinguishes annotated reconstruction from original audio, local labels from identities, and this control from the paper's test and planned predictive Dialogue Transfer experiment. It neither proves nor disproves communication, synchrony, meaning or intention. It does not invent a source-count reconciliation.

No material discrepancy was found. Excessive floating precision is a readability limitation; the answer itself warns that annotation precision does not establish accuracy. Generated prose remains visibly unverified and cannot replace computed facts.

## Receipts, timing and actual downloads

Both accepted receipts returned model **`gpt-6-astra`**:

| Response ID | Input / output / total tokens |
| --- | --- |
| `resp_0949a5370a05d5b7016aa5f892d09087d088a3be18a978a38d` | **4,714 / 37 / 4,751** |
| `resp_0949a5370a05d5b7016aa5f895995887d090d9f61c51911cae` | **10,882 / 846 / 11,728** |
| This investigation total | **15,596 / 883 / 16,479** |

No settled cost is claimed. Historical failed-request usage remains unknown, not presumed free.

Handler timing was **2026-09-13 01:12:49.743 → 01:13:07.183 UTC**, **17,440 ms**. Application timestamps were **01:12:49.745 → 01:13:07.182 UTC**. [UI timing](ui-observation.json) was **01:12:49.697 → 01:13:07.208 UTC**, **17,511 ms**, from immediately before the sole Ask click to the non-pending button and visible accepted result; this is not exact paint timing. Browser resource duration was **17,479.1 ms**.

- [Same-run LIVE ASTRA screenshot](LIVE-ASTRA-outcome.png): exact displayed question/result, visually inspected; no replay or rewritten answer.
- [Delivered investigation JSON](investigation.json): **89,990 bytes**, obtained by **Download investigation JSON**. Parsed binding, full source segment, observed/selected pair and assignment mappings, all control scores and exact new generated result match. Saved analysis is labeled historical on reopen.
- [Delivered investigation card](investigation-card.png): **531,484 bytes**, obtained by **Download investigation card**. Visually inspected: reconstruction identity, non-playable image label, generated/unverified distinction, source credit and CC BY 4.0 are legible. It shows the first interpretation verbatim and points to complete JSON evidence.

[Delivery record](downloads.json) includes actual browser download events, filenames and file checksums. No offline replay, extra inference, Lab import feature, WAV regeneration or listening test was used.

## Preflight, privacy and cleanup

[Exact commands/results and runtime binding](verification.json): key-excluded `npm run data:verify`, `npm run build` and **15 passing `npm run test:server-build` checks** preceded credential loading. Built Worker SHA-256 **`1c55d2d7f4f46b224bb6f73a9dff480e4812d17ff3a3f32c0b1a05109db742d9`** matches the reviewed artifact. Node **25.9.0**, Miniflare **5.20260911.0-alpha**, workerd **1.20260911.1**, Chromium **153.0.8010.12**, Playwright **1.63.0**, compatibility date **2026-09-12**. Full implementation suites were not redundantly rerun for this report-only closeout. An initial offline export checker assumed control-summary entries also contained pair arrays; its assertion was corrected to the actual shape, with no application change or new model request.

The proven loopback Miniflare shape loaded the actual built client/Worker with only the existing private observer and local consumption/result guard. **No transport override, outbound interception, Node provider fallback, proxy, alternate model/endpoint or hosted runtime.** Low reasoning, manual redirects, **20 seconds**, **1,800 output tokens per response**, four rounds and all smaller bounds remained unchanged.

The approved inherited credential was read after preflight, removed from child-process inheritance and bound only in memory to the private server. Both operator flags were true only there. No credential value, derived identifier, location, headers, raw provider payload/error or opaque reasoning was retained.

[Runtime cleanup](runtime-cleanup.json) confirms the trial browser/context and Worker closed at **01:13:07.640 UTC**. The temporary harness was removed and the consumed ledger preserved. A task-owned key-free ordinary preview returned **HTTP 200 / unavailable / NOT_CONFIGURED** at **01:15:04.266 UTC**, then was stopped. [Cleanup evidence](cleanup.json) confirms disabled checked-in flags and preserved source, ordinary user work, credential source and historical evidence. No merge, force-push, Site operation, public enablement or account change occurred.

Earlier A/B trials, the [accepted Composer edit and failed investigation](../2026-09-12-live-composer/README.md), [later accepted Composer investigation](../2026-09-13-live-composer-investigation/README.md), and all TEST ONLY media remain unchanged. **General reliability, latency/output sufficiency across other cases, human listening, physical-device behavior, annotation/scientific validity and hosted Sites delivery remain unverified.** Operator flags are not authentication or a shared spending cap. Any additional paid investigation requires fresh authorization.
