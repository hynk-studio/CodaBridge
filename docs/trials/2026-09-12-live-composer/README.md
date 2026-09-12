# LIVE ASTRA — first Composer validation batch

**Action 1 completed and met the compound-edit criteria. Action 2 failed final-content validation. The batch stopped without a retry or code change.** Exactly two Composer submissions produced three observed provider HTTP responses. Both action allowances are consumed.

Authority: [owner comment 5646519739](https://github.com/hynk-studio/CodaBridge/pull/5#issuecomment-5646519739), following [review 5186648829](https://github.com/hynk-studio/CodaBridge/pull/5#pullrequestreview-5186648829). Executed source: **`e20d12358dafe73610023cdda5ad189790d3d8e5`**, matching local and fetched remote head immediately before submission. Its application correction is **`0f9047aefd52e6619fd2f2c13a29140a7c064541`**; the intervening commit contains only reports/media. No prior execution record existed for this authorization. Each submission was durably marked consumed before the Worker handler ran.

## Observed outcomes

| Action | Application outcome | Provider requests observed | Returned tokens: input / output / total | Handler / browser resource / click-to-outcome latency |
| --- | --- | --- | --- | --- |
| 1 — compound edit | **Completed; accepted proposal and local checks passed** | **1** | **2,119 / 121 / 2,240** | **5,358 / 5,373.9 / 5,440 ms** |
| 2 — modified-copy investigation | **Failed: HTTP 502 / `UNSUPPORTED_GENERATED_CONTENT`** | **2** | **Unknown** | **13,402 / 13,410.3 / 13,467 ms** |

Every observed upstream response was **HTTP 200**, recorded through the existing private diagnostic shape:

```json
{"kind":"PROVIDER_HTTP_RESPONSE","httpResponseObtained":true,"upstreamStatus":200}
```

No upstream HTTP-error envelope/type/code applies. Action 2 is an application rejection after HTTP success, not `PROVIDER_TRANSPORT_FAILURE` or `PROVIDER_HTTP_FAILURE`. Its failed public result exposes no accepted receipt, tool-action record or final explanation. Those missing fields remain unknown; they were not recovered from internal provider payloads.

The unchanged Composer validator emits this fixed code when interpretation prose contains a URL or a digit remaining after supplied-label removal. The rejected text was not retained, so **the precise triggering content is unknown**. This lexical restriction is not a factual-correctness verdict. No validator change, content inspection through a new diagnostic, or replacement request was made.

Action 1 returned model **`gpt-6-astra`**, response **`resp_0e138bcba66a852b016aa56606e78487d09ccec9cbdd4045a4`**, with the usage above. Action 2's returned model/response IDs and usage are unknown. The configured model was unchanged. Known usage covers Action 1 only; no complete batch token total or settled cost is available. Failed requests are not presumed free.

On **2026-09-12 UTC**, the trusted wrapper measured Action 1 **14:47:33.814 → 14:47:39.173**, and Action 2 **14:48:21.005 → 14:48:34.407**. Handler latency surrounds the actual built Worker handler; browser resource timing surrounds `/api/composer` network activity. UI latency starts immediately before the one Ask-button click and ends when the button returns from its pending state; the accepted result is then checked separately. This is an automated UI observation, not an exact paint measurement. [Per-action execution and UI files](action-1-execution.json) retain the endpoints; [Action 2](action-2-execution.json) retains only its fixed failed outcome and sanitized diagnostics.

## Action 1 — accepted edit, then Apply / Undo / Redo

A fresh isolated browser context used **Make my version · 1.wav**. It had no prior draft/codebook. The initial phrase had exactly one dswp-1-seeded block at **revision 0**, active ID **`b-0a826ef7-01b4-4666-bfc3-045d1a08f775`**. Its source offset remained **0.3827891156462585 s**. The complete initial content and canonical binding are in [action-1-before.json](action-1-before.json).

Exact edit request:

> Duplicate the selected block once. Make only the new second block 1.25 times as long, preserving its relative gap proportions. Keep the original block unchanged.

The live provider returned these validated operations in order:

1. `duplicate_block` targeting the original, with new ID **`b-e6d3a950-654c-4779-a725-cba95b2d7e01`**.
2. `scale_duration` targeting that new block, factor **1.25**.

The normal server and browser both validated/recomputed the preview. The binding matched the submitted revision/content. The saved draft remained exactly unchanged before Apply. The original block—including timing, source, spacing and creator text—was unchanged. Every copied interval was 1.25 times its original duration, and normalized proportions were equal within floating-point tolerance. The copy's span was **1.9730158730158731 s**, versus the original **1.5784126984126985 s**. Its distinct stable ID and the later isolated gap edit corroborate independent editing.

The displayed labels were **“Duplicate Block 1 (position 1) → New block 2 at position 2.”** and **“Scale New block 2 (position 2) ×1.25.”** No block-zero label appeared. The [accepted application result and receipt](action-1-accepted.json), [deterministic preview](action-1-preview.json), and [same-run LIVE ASTRA screenshot](action-1-LIVE-ASTRA-outcome.png) were saved **before Apply**. They now document a historical accepted edit, not a proposal applicable to the current revision. Edit mode used no model tools; its sole action record is server-initiated `compare_creation`.

The actual UI then applied the proposal, undid it once and redid it once. Content matched the expected two-block, original one-block, and two-block states respectively; revisions advanced **1 → 2 → 3**. The new second block was selected after Redo. [Snapshots](action-1-local-apply-undo-redo.json) confirm content restoration, original-block immutability and **one** total Composer submission throughout these local actions. This concrete edit passes the case; HTTP completion alone was not used as the verdict.

## Local gap change and Action 2

The exact-gap UI set the second block's first gap to **0.300 s**, producing **revision 4**. Its other gaps and the entire original block remained unchanged. The new gaps were:

`[0.3, 0.51952947845805, 0.756122448979592, 0.22780612244897958, 0.32128684807256214]` seconds.

The selected block's span became **2.1247448979591836 s**. Normalized interval MAD versus its uniformly scaled previous revision became **0.02641760498587642**. This confirms changed proportions, not merely uniform duration scaling. [action-2-before.json](action-2-before.json) preserves the actual revision, active ID, previous block, canonical binding and recomputed measurements. No field catalog data changed.

Exact investigation request:

> Find the closest real recordings to my currently selected edited block under the normalized interval metric. Exclude its seed and explain the timing differences and limitations.

The deterministic recomputation for this actual edited block has **two eligible examples** in the four-recording catalog: `dswp-11` at **0.08740519967162448**, then `dswp-2` at **0.09969433121556079**, under `normalized-interval-mad v1.0.0`. `dswp-1` is excluded as ancestry. `dswp-7` has unequal counts and remains `not-comparable / UNEQUAL_CLICK_COUNTS`, without distance, alignment, padding or truncation. No byte-identical duplicate exists in this catalog, so duplicate suppression was not exercised by a live duplicate candidate.

These are **deterministic local observations**, not an accepted Astra ranking. Two upstream HTTP responses were observed, but final validation rejected the investigation. No accepted action record establishes the required `find_creation_alternatives` call, its arguments/evidence, or answer consistency. **The live creation-retrieval acceptance criteria therefore did not pass.** No answer-quality verdict, citation audit of a final answer, or whale-meaning claim is available. The [same-run failure screenshot](action-2-LIVE-ASTRA-outcome.png) shows the generic failure and unchanged revision-4 creation. No third submission or follow-up question occurred.

## Delivered creation files

All three original Download buttons delivered actual files in the isolated live-session Chromium context. No replay was needed for delivery. Each filename bound the download to **revision 4**:

- [Synthetic WAV](creation-synthetic.wav): **412,518 bytes**; exact byte equality with the unchanged renderer applied to the saved draft. Mono PCM16, **48 kHz**, **206,072 frames / 4.2931666667 s**, 12 scheduled clicks, peak absolute PCM **0.046356201171875**. The renderer's 90 ms framing explains the difference from the 4.2031666667 s phrase span. Synthetic identity, source credit and unknown meaning are retained in WAV metadata.
- [Coda Card image](creation-card.png): **150,130 bytes**, **1200 × 768**. Visually inspected: title and both timing patterns lead; human-created/synthetic identity, unknown whale meaning, DSWP/CC BY 4.0 credit and the accompanying WAV/project relationship are legible. Title remained “My first coda”; intention and personal meanings were intentionally empty.
- [Re-openable project JSON](creation-project.json): **13,819 bytes**. Parsed draft/selection exactly match the modified live state; deterministic evidence was independently recomputed. Its generated-analysis field is **null** because Action 2 was rejected. Action 1's accepted edit remains in its separate historical evidence file, not relabeled as current analysis.

[Download events, filenames and artifact hashes](downloads.json) and [content checks](file-content-verification.json) document delivery and parsing. A separate **OFFLINE**, key-excluded context then imported the delivered JSON through the ordinary UI. Content, selection, codebook and saved deterministic evidence restored; import advanced revision **4 → 5** as designed. [Restoration evidence](offline-restoration.json) records `NOT_CONFIGURED`, zero Composer/A/B submissions and no autoplay. This is saved-file restoration, **not another live model event**. No automated check constitutes human listening or physical-device audio coverage.

## Runtime, checks and cleanup

The proven loopback Miniflare/workerd execution shape loaded the actual built Worker and assets. The trusted wrapper installed only the existing private diagnostic observer, with a local consume/result guard. **No provider transport override** was supplied: outbound provider requests used the native Worker fetch. There was no Node fallback, proxy, alternate model/endpoint, remote Worker or redirect following. Artifact SHA-256: **`f019f1f5d98a3559298d27b10938ef98f7b9c36dc9c3a2d824aaba90c80fad4a`**; this is an artifact hash, not credential-derived evidence. Node **v25.9.0**, Miniflare **5.20260911.0-alpha**, workerd **1.20260911.1**, Chromium **153.0.8010.12**, compatibility date **2026-09-12**.

The existing inherited canonical key was read only after preflight, removed from subprocess inheritance, and supplied only to the temporary server binding. No credential source was changed or copied into the repository. Both operator flags were true only inside that runtime. **`gpt-6-astra`, low reasoning, manual redirects, 20 s/action, 1,800 output tokens/response, four rounds/action, and every smaller tool/operation/byte/validation bound stayed unchanged.** No upstream redirect occurred; synthetic redirect tests remain separate evidence.

| Actual command/check | Result |
| --- | --- |
| `git fetch origin`; local/remote/PR head, base, Draft state and authorization/execution-record inspection | Exact reviewed head; #2 → #3 → #5 preserved; no prior submission record. |
| `env -u OPENAI_API_KEY npm run build` | Passed TypeScript, client and actual Worker build. |
| `env -u OPENAI_API_KEY npm run data:verify` | Passed all four original byte hashes, PCM metadata, source-card hash and deterministic annotations. |
| `env -u OPENAI_API_KEY npm run test:server-build` | **13 passed**, including native-workerd Composer/tool and manual-redirect fixtures. These remain TEST ONLY. |
| `env -u OPENAI_API_KEY node --check .tmp/live-composer-launcher.mjs`, then `node --experimental-strip-types .tmp/live-composer-launcher.mjs` | Syntax passed; actual private runtime performed exactly the two authorized UI submissions, three observed provider requests. Temporary launcher removed afterward. |
| Key-excluded Node content checks; key-excluded Playwright import journey | Exact WAV/project/deterministic evidence checks and actual UI restoration passed; zero additional model submissions. |
| Ordinary loopback GET `/api/investigation/status` after disposal | **HTTP 200 / `unavailable` / `NOT_CONFIGURED`**, confirmed **14:50:02.685 UTC**, and again during offline restoration. |
| Final report privacy/history/source checks and `git diff --check` | Passed; no application/config/data changes and no historical evidence edits. |

The trial Worker/launcher and isolated browser context were closed. The offline restoration context was also closed. Transient live bindings and the temporary launcher were removed. Both checked-in flags remain false; the user's ordinary preview, existing drafts/codebook/tabs and pre-existing untracked image were preserved. [Cleanup record](cleanup.json) documents the disabled status. No full-suite rerun was needed for this report-only closeout.

The [first generic failure](../2026-09-12-private-astra/README.md), [diagnostic retry](../2026-09-12-private-astra-diagnostic-retry/README.md), [transport probes](../2026-09-12-worker-transport/README.md), [redirect diagnosis](../2026-09-12-request-constructor/README.md), [post-fix A/B trial](../2026-09-12-post-fix-live-astra/README.md), [A/B batch](../2026-09-12-live-retrieval-unequal/README.md), and all Composer TEST ONLY media remain unchanged. This batch establishes one accepted local live Composer edit with functioning local controls and delivered files. **Live Composer investigation remains unresolved.** Broader reliability, latency/output sufficiency, human listening/usability, scientific validity, public access/shared budgeting and hosted Sites remain separate. Any further paid request needs fresh authorization. No code patch, merge, force-push, account change, public enablement or Site operation occurred.
