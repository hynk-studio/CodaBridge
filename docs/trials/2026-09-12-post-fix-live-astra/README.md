# LIVE ASTRA: single post-fix local validation

**One investigation completed through native workerd fetch with upstream HTTP 200 and an accepted `gpt-6-astra` explanation.** It used one provider request. The answer is useful and consistent with the supplied timing evidence for this case; completion alone was not used as the quality verdict. No second investigation or additional inference ran.

## Authority, source and case

The owner's direct task authorized exactly one new private local investigation, including its API charges, after [review 5186079185](https://github.com/hynk-studio/CodaBridge/pull/3#pullrequestreview-5186079185). That review alone did not authorize a call. Local and remote heads both matched **`933ab107459fbff7c0a9e18447b7d5a5dcfe1b7f`** before execution; no newer live report or consumed record existed. Draft PR #3 remains on `codex/mvp-02-grounded-investigation`, stacked on PR #2.

- **A:** `dswp-1` / `1.wav`.
- **B:** `dswp-2` / `2.wav`.
- **Exact question:** “What differs in the timing of A and B, and what cannot be concluded?”

The actual application UI submitted once. The trusted local wrapper checked this selection/question and durably consumed the authorization before invoking the handler. A guard was in place to refuse a second submission; none was attempted. The implementation's existing tool loop remained available, but the accepted final answer arrived in its first response. Unused rounds are not authorization for further work.

## Actual outcome and receipt

| Observation | Retained result |
| --- | --- |
| Upstream HTTP response obtained | **Yes — HTTP 200**. |
| Private diagnostic | `{"kind":"PROVIDER_HTTP_RESPONSE","httpResponseObtained":true,"upstreamStatus":200}`. No HTTP-error envelope/type/code applies. |
| Local application outcome | **HTTP 200 / `completed`**, execution **`provider`**; explanation accepted. |
| Provider requests observed within the investigation | **1** diagnostic and **1** accepted receipt; browser also observed **1** local investigation request. |
| Returned model | **`gpt-6-astra`**. |
| Returned response ID | **`resp_0596dc5c63be8677016aa52398b4b087d097592c684f01a9c1`**. |
| Returned token usage | **2,795 input + 288 output = 3,083 total**. |
| Browser click / authorization consumed | **2026-09-12 10:04:07.434 UTC** / **10:04:07.477 UTC**. |
| Application start / completion | **10:04:07.486 UTC** / **10:04:15.229 UTC**. |
| Observed latency | Browser request **7,766.9 ms**; wrapper application interval **7,745 ms**. Click to first accepted UI evidence-packet generation: **7,813 ms**, approximately **7.81 seconds**. |
| Tool actions | Server-required `recording_details(dswp-1)`, `recording_details(dswp-2)`, `compare_selected({})`. **Zero model-initiated tool calls**. |

The UI latency measure ends at the accepted packet's generation, not an exact screen-paint timestamp. Browser resource timing was read after completion without collecting network events, headers or payloads. The later visual inspection time includes observer delay and is not model latency. No settled charge or cost estimate was obtained; token usage is not an invoice.

## Answer-quality assessment

**Useful and consistent for this narrow question, with a wording caveat.** Manual inspection compared the accepted explanation with the deterministic evidence:

- It answers the main timing difference: A begins with a shorter estimated gap and its longest gap is near the middle; B begins with its longest gap. The evidence has A's first/third gaps at approximately **0.119/0.605 seconds**, and B's first gap at approximately **0.508 seconds**. These numbers are deterministic measurements, not generated claims.
- Its equal-marker-count/comparability statement is supported: both records have **six estimated markers** and the comparison result is `comparable`. All cited IDs—`recording:dswp-1`, `recording:dswp-2`, `comparison:dswp-1:dswp-2`—are present.
- The UI keeps deterministic observations separate and explicitly labels generated interpretation **unverified**. The accepted prose adds no numerical measurement claims. This inspection, not lexical screening alone, supports the assessment.
- It states that markers are machine estimates, not reviewed click onsets; detection can miss/merge events or count echoes/noise; whole files may contain multiple codas; biological boundaries are unverified. It explicitly rejects conclusions about translation, intention, speaker identity, dialogue turns, shared messages, meaning probabilities or biological categories.
- “Pauses” is reasonably read here as estimated inter-marker gaps; it does not establish silence or biological segmentation. The generated answer does not enumerate every interval or compare total spans, although those measurements remain available in the deterministic evidence. This is not an exhaustive scientific interpretation.

The three server-required tool results agree with the answer. There is no live model-initiated tool result to assess; multi-round function calling, retrieval and unequal-count cases remain untested live.

## Runtime and privacy

The actual built Worker used the default real adapter and **native Worker fetch**, with `redirect: "manual"`. No mocked transport, outbound fixture, Node fallback, proxy, alternate endpoint/model or remote Worker entered this live runtime. Node controlled local runtime/collection only. The trusted wrapper installed the existing private diagnostic observer; it did not change its fields or access raw provider data.

Runtime: Node **v25.9.0**, Miniflare **5.20260911.0-alpha**, workerd **1.20260911.1**, compatibility date **2026-09-12**, loopback only. Built artifact SHA-256: **`6857f305a59e2d6e0172d9d105ac1c32a879cdb10ed830eed8d701fb1f33877e`** (artifact identity, never a credential hash). Browser: Codex in-app Browser.

The existing canonical environment key was reused read-only after build/test work, solely in the temporary server binding. It was removed from the launcher's inherited environment before subprocess/runtime startup. No credential value, prefix, length, hash, locator, source file copy or browser binding was recorded. Both operator flags were true only in this runtime. No prompt, schema, tool, recording, metric, model or provider parameter changed.

The endpoint remained `https://api.openai.com/v1/responses`; model **`gpt-6-astra`**, reasoning **low**, deadline **20 seconds**, output maximum **1800 tokens per response**, provider/tool limits **four**, and every byte/source/evidence/final-answer validation bound were preserved. No 3xx occurred in this live case; the existing offline regression remains the evidence that manual redirects fail without following or forwarding Authorization.

## Evidence, checks and cleanup

- [Sanitized observation and receipt](observation.json): source, consumed authorization, fixed diagnostic, actual usage/timing, quality assessment and cleanup.
- [Exact current-page evidence JSON](current-evidence.json): accepted investigation, source provenance, deterministic measurements and final interpretation. Its `investigation` was verified equal to the accepted application result. The exact displayed JSON string was saved to preserve numeric serialization; the earlier structured WebMCP read was not used as the final file.
- [LIVE ASTRA UI capture — source 933ab107](live-astra-933ab107.png): readable viewport of the same completed answer, showing the exact question and measured/generated distinction. A full-page capture had stitching duplication and was replaced with this viewport capture. No investigation was rerun for evidence.

The evidence-download button was clicked **once** and displayed its acknowledgement. Its download event timed out, so delivery of a downloaded file is **unconfirmed**. The independently saved current-page JSON and UI screenshot succeeded. Existing TEST ONLY screenshots were not changed or relabeled.

| Actual command/check | Result |
| --- | --- |
| `env -u OPENAI_API_KEY npm run build` | Passed: TypeScript, client and actual Worker artifacts. |
| `env -u OPENAI_API_KEY npm run data:verify` | Passed: four original byte hashes, PCM metadata, source-card hash and deterministic annotations reproduce. |
| `env -u OPENAI_API_KEY npm run test:server-build` | **12 passed** before loading the key. Synthetic tests remain separate from this live result. |
| `env -u OPENAI_API_KEY node --check .tmp/post-fix-live-launcher.mjs` | Passed before `node .tmp/post-fix-live-launcher.mjs` started the isolated trial. |
| Normal cleanup preview: `env -u OPENAI_API_KEY npm run preview` | Local GET `/api/investigation/status` returned **HTTP 200 / `unavailable` / `NOT_CONFIGURED`** at **10:08:24.652 UTC**. Browser navigation to the JSON endpoint was blocked by the browser client; a local Node HTTP client read only the availability response. This was not a provider transport fallback or investigation. |
| Final evidence/source/cleanup checks and `git diff --check` | Passed: exact accepted-result equality, citations, one-request counts, original source/history unchanged, both checked-in flags false, launcher removed and loopback port closed. |

After the final application outcome, the trial launcher/workerd processes were stopped and transient bindings ended with that runtime. The trial browser tab, cleanup preview and bounded keep-awake lease were closed/stopped. The original credential source is unchanged. No further full unit/browser suite was run for this report-only closeout; the reviewed correction's earlier suite results remain separately recorded.

## History and remaining boundaries

The [first generic failure](../2026-09-12-private-astra/README.md), [diagnostic retry](../2026-09-12-private-astra-diagnostic-retry/README.md), [non-inference transport probes](../2026-09-12-worker-transport/README.md) and [Request-constructor diagnosis](../2026-09-12-request-constructor/README.md) remain unchanged. This new success does not retrospectively classify either failed attempt or its charges. Their authorizations remain consumed; this new single-investigation authorization is also consumed.

This establishes one accepted local Astra case through the corrected path, not general reliability, latency/output sufficiency across cases, model-initiated tool-loop compatibility, scientific validity or hosted Sites operation. Public authentication and shared-budget decisions remain separate; the existing flags are neither authentication nor a shared spending cap. No cases 2/3, second investigation, retry, replacement, health-check inference, alternate/evaluator model, account change, provisioning, public enablement, Site creation/save/deployment, merge or force-push occurred.
