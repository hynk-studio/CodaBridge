# MVP-04 · Context Lab

Implementation of [issue #6](https://github.com/hynk-studio/CodaBridge/issues/6), with the key-free listening/release preparation in [issue #7](https://github.com/hynk-studio/CodaBridge/issues/7). The reviewed foundation is integrated; this Lab remains a separate Draft PR. [Audit](CONTEXT_DATA.md), [verification](MVP_04_VERIFICATION.md), [release handoff](RELEASE_HANDOFF.md).

## Connected journey

Composer → **Context Lab** → selected annotated coda and its neighbors → user-initiated timing reconstruction → observed/control comparison → optional explicit Ask → investigation PNG/JSON → preserved Composer.

Composer remains mounted with its draft, codebook, selection and Undo history. Navigation flushes text transactions and stops obsolete playback/model work; it does not add blocks, play audio or submit a model request. No creation is inserted into the research exchange or field catalog.

The two-lane view uses actual file-relative onsets, ICI-derived end times and clicks. It opens around the first overlapping pair within the independently selected segment. A/B are local annotation labels. Source rows are inspectable. Keyboard-accessible selection/window controls accompany a horizontally scrollable timeline on small screens.

Reconstruction uses the existing `click-pulse-1` renderer and playback owner. Original event times remain unchanged for every control offset. Stop, caller mute/solo and bounded 10/20/30-second audition windows use Web Audio buffers, not UI timers. Overlapping pulses share conservative gain. Lab engineering bounds are 60 calls, 29 markers per call, 120 seconds and 1,740 events; Composer's stricter bounds remain unchanged. No original exchange-audio mapping is claimed.

## Exact descriptive control

`paired-duration-gap-v1` forms every positive-overlap A/B pair from the original annotated spans; endpoint touching is excluded. It freezes that list. The score is mean `abs(A duration − assigned B duration)` in seconds over these same slots. Unequal click counts are allowed for this duration question; the equal-count normalized-rhythm metric is unchanged.

For offset `k`, ordered B slot `i` uses the duration from B row `(i+k) mod n`. All B durations in this same segment participate in the rotation inventory, including calls outside the overlap pairs. Zero reproduces observed assignments exactly; nonzero rotations are controls. Pair membership, timeline, clicks and sound never change. Original slot and reassigned source rows are retained.

Distinct controls are distinct full ordered duration assignments, excluding equivalence to observed zero. Equal scalar scores do not alone make rotations equivalent. Equivalent row mappings are still inspectable. Range/median summarize distinct useful nonzero assignments. No pairs, fewer than two B calls, or no distinct controls produce explicit insufficient-data reasons; unavailable scores are `null`, not manufactured zero effects.

The selected real segment has 23 calls (14 A / 9 B), seven pairs and 14 unique participating calls. Observed: **0.1328669571 s**. Offset 1: **0.1438996286 s**. Eight distinct controls: **0.0837865857–0.1940878000 s**, median **0.1652622571 s**. The observed value lies inside the control range; two controls are closer than observed. This is descriptive sensitivity in one selected window, with no forced positive conclusion.

Rotation has a seam and can mix types/settings; calls may be reused in pairs. Own persistence, shared setting, annotation uncertainty, type composition and selection remain alternative accounts. No p-value, causal/independence claim, biological category, translation or meaning inference is supplied. This is neither the paper's type-conditioned permutation test nor the planned predictive Context / Dialogue Transfer experiment. That deeper follow-on remains planned.

## Optional Astra boundary

`POST /api/lab` is real server code with three bounded tools: `exchange_info`, `compare_observed_pairing`, `control_result`. The server resolves pinned IDs and recomputes facts; it accepts no client scores, sources, URLs or arbitrary operations. Binding includes dataset/release/CSV revision, derived and selection versions, segment, caller pair, method, offset and selected source row. UI generations also obsolete answers after question, window, mute or navigation changes.

The shared adapter retains native Worker fetch, manual redirects, `gpt-6-astra`, low reasoning, 20 seconds, 1,800 output tokens and four provider/tool rounds with existing smaller byte/tool limits. Structured output, exact evidence-reference resolution, refusals and secret protection remain. Quantitative prose is allowed; URLs remain rejected. Valid citations do **not** verify every statement or embedded source name. Incorrect narrative cannot change deterministic values, mappings or sources, but may still pass the prose validator. Generated interpretation is visibly unverified, separate from computed results.

Both operator flags default false and no key is bound. Direct model POSTs refuse server-side. Tests use an explicit TEST ONLY transport and actual dispatch/replay; no fixture response ships in the artifact. No live Lab call was made. Earlier A/B/Composer live results do not establish this new contract's live compatibility, output sufficiency or latency.

## Saved investigation

The PNG contains the question, comparison, source/method, limitations and the first generated interpretation verbatim only when present, clearly labeled unverified. The full exact answer/citations and all pair assignments accompany versioned JSON, bounded to 128 KiB. The image is not audio. Saved analysis is historical, not a new execution. This slice exports Lab snapshots; it does not add a Lab snapshot import workflow. Composer project restoration remains supported and tested.

Primary files: `src/lab/{model,parse,catalog,ContextLab,sound,export,contract}`, `server/lab.ts`, `scripts/prepare-context.ts`; the shared Worker routing, App navigation and sound renderer have small integration changes. Source audit inputs are under `data/context/`; the versioned selected data is `src/data/context.json`.
