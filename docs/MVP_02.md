# MVP-02: grounded investigation

Depends on MVP-01 Draft PR #2, reviewed head `4d09495f9bb31006d310402c8474a94df03d5086`, review `5185590969`. This slice branches from that head and targets `codex/mvp-01-listen-compare` as a separate stacked Draft PR. Parent issue #1 is not closed by this work.

## Request and evidence flow

The browser submits only an 800-character question, two allowlisted recording IDs and an ordered version binding. The server rejects extra fields, resolves IDs from catalog `2.0.0`, verifies source revision/hash, annotation method/version and metric ID/version binding, and recomputes timing with the shared functions. The binding describes pinned catalog bytes; per-request resolution does not redownload or decode WAVs. `data:verify` checks those originals and annotations offline.

Before the first provider request, the handler executes and records mandatory details for A/B and their comparison. The model can then call exactly three tools:

| Tool | Accepted arguments | Server result |
| --- | --- | --- |
| `recording_details` | Catalog `sourceId` | Original source/audio/annotation provenance and recomputed timing |
| `compare_selected` | Empty object | The bound A/B comparison, including explicit incompatibility, plus deterministic first-interval observation |
| `find_alternatives` | Selected `referenceId`, `limit` of 1 or 2 | Ranked candidates under normalized-interval-mad v1.0.0; selected IDs/hashes and candidate byte duplicates excluded; unequal-count rejections retained |

Tools have no URL fetching, filesystem, shell, browsing or general agent capability. All original recordings are already in the versioned catalog. Retrieval has no similarity threshold or semantic meaning claim. With default A/B it returns `11.wav` and rejects `7.wav` for unequal counts. With `7.wav` as reference it can truthfully return no comparable alternative. A different ID with selected/duplicate bytes cannot become “another example.”

Each successful result contains the request/binding, local timestamps, provider-supplied receipts, actual tool actions and evidence, and generated interpretations/limitations. Every generated paragraph must cite issued evidence IDs. Exact output fields, section/text bounds and actual evidence-ID resolution are checked; authoritative measurements remain in deterministic server evidence.

Generated prose may name exact, case-sensitive filenames, recording IDs and display labels from supplied recording evidence, plus the supplied metric's `id vVERSION`, `name vVERSION` and `vVERSION` labels. The lexical check exempts those complete labels, then rejects remaining ASCII digits and HTTP(S) URLs. A sentence-ending period is allowed; a label embedded in a different filename/identifier is not. Thus `11.wav` and `dswp-11` pass after their recording evidence is supplied, while `99.wav`, `dswp-99`, `11.wav.backup` and a new measurement such as `0.09` fail. Merely appearing in the initial catalog-ID list does not supply a recording's evidence; bare measurement values and numerical label fragments are never exemptions.

These checks establish bounded output shape, reference resolution and a narrow lexical restriction, **not factual correctness**. They do not parse natural-language numbers, validate semantic claims, resolve every possible prose identifier or prove that a cited item supports its paragraph. Spelled-out numerical claims and false statements about known labels can still pass. Generated interpretation remains visibly unverified and needs review; it cannot overwrite deterministic measurements.

One completed assistant message may accompany one allowed function call. Its envelope and text size are validated, but that text is intermediate even if it looks like final JSON or carries `phase: "final_answer"`. The complete original response items, including optional/null assistant phase and opaque reasoning, are replayed internally alongside the actual function result. Only a later no-tool message with absent/null or `final_answer` phase can supply the final structured explanation; commentary-only text is not accepted as final. Tool-only rounds and no-tool final responses remain supported. Refusals and malformed messages fail closed; intermediate text and opaque reasoning are absent from results and exports.

Estimated markers are amplitude-peak transient groups, not biological coda boundaries, identified speakers or dialogue turns. The provider instructions prohibit translations, intentions, identity and semantic confidence. The UI labels deterministic observations and generated interpretations separately and repeats the traceability limitation.

## Bounds and failure behavior

- Request body: 8,192 UTF-8 bytes, including streamed bodies; question: 800 characters.
- End-to-end deadline: 20 seconds, including body reading, provider transport and response streaming; client disconnect/cancel also aborts the request.
- At most 4 Responses requests and 4 distinct model tool calls; one call per response, no automatic retries. A last-round tool request fails without dispatching another round.
- At most 1,800 output tokens requested per provider response; provider body 65,536 bytes, complete outbound JSON context 98,304 bytes and returned result 131,072 bytes. Oversize/incomplete output fails closed. Encrypted reasoning counts against body/context bounds.
- Strict same-origin JSON POST, exact request/tool fields, finite numeric receipts and allowlisted IDs. Availability is a no-store GET; error bodies use fixed messages and expose neither credentials nor raw provider output.

These are per-request bounds, **not a global spending cap**. Live public access stays disabled pending actual access/budget review. No persistent counters, accounts or database were added.

## UI and export

The existing listening/comparison layout remains. Subtitle says “real sperm whale recordings”; the initial ready state says “source bytes checked.” The first estimated interval contrast is labeled measured/not AI-generated. Unequal-count interval tables show missing cells as a dash without fabricating or aligning measurements.

The investigation panel offers guided questions and an editable bounded question, with pending/cancel, unavailable, failed and completed states. Retrieval summaries are visible with deterministic observations. Citations open inspectable source/tool evidence; provider receipts/binding are separate from tool actions. Hidden reasoning is absent.

Changing either recording aborts pending requests and invalidates completed results immediately for display and export. A generation counter prevents a late response from reviving an obsolete answer, including when the user switches back. Timing-view changes preserve the same source-bound investigation. Evidence format `codabridge-comparison-evidence` **2.0.0** adds `investigation`, either the actual current completed result or `null`; full-precision original measurements remain intact. The existing optional WebMCP read tool exposes that current packet without adding tools or execution authority.

Test injection exists only through a source-level factory/transport seam. No HTTP parameter, environment switch or ordinary visitor mode generates fixture success. Mocked completions are explicitly labeled `mock-transport-test`; no mocked outcome is live Astra evidence. See [verification](MVP_02_VERIFICATION.md).
