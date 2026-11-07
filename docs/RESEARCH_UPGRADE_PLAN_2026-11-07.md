# CodaBridge research upgrade plan — 2026-11-07

**Status: U1–U4 implementation staged for review; offline source, DSP, simulation and fixture checks executed. Browser acceptance and actual model evaluation remain incomplete.** Planning baseline: [main at 9de9469](https://github.com/hynk-studio/CodaBridge/tree/9de946988020125218a9496ca49e3f8769577497). The plan was merged in PR #30 before implementation. The original empirical studies remain unchanged; new fitted results below are synthetic diagnostics only.

## Goal and sequence

Extend CodaBridge so a visitor can compare timing, spectral properties and available environmental context, then inspect which explanations the evidence can distinguish. Reuse Composer, Context Lab and their evidence machinery.

| Package | Deliverable | Dependencies |
| --- | --- | --- |
| **U1 — Spectral and environmental sources** | Reproducible CETI table join, source manifest and descriptive context view | Pinned source bytes; documented field meanings and reuse conditions for distributed assets |
| **U2 — Timing and spectrum comparison** | Separate, source-bound comparisons and a bandwidth sensitivity report | Native-audio work can start now; CETI context views use U1; any cross-source waveform join needs its own evidence |
| **U3 — Event simulation** | Extend existing diagnostics through the full event-selection and prediction pipeline | Existing parser/cohort/model owners; no new field data |
| **U4 — Research-assistant evaluation** | Composer-derived cases, task-specific scores and next-evidence suggestions | Deterministic measurements; U2/U3 evidence where relevant; waveform evaluation only with a verified audio-capable route |

U2's native-audio measurements and U3 can progress independently if external metadata or reuse questions delay U1. U4 begins with structured evidence and provider-free fixtures; actual model evaluations are separately bounded runs. Each package has its own focused PR in dependency order.

## Execution status — 2026-11-07

| Package | Delivered evidence | Remaining acceptance or conditional work |
| --- | --- | --- |
| U1 | [Importer and local-file explorer](../analysis/spectral-context-v1/README.md); independently verified 1,375 one-to-one joins, zero disagreements across 13 shared fields; raw special codes and unknown values retained | External-row redistribution remains unresolved, so no rows are bundled. Browser import/download and layout checks have not run successfully. |
| U2 | [Native-spectrum comparison](../analysis/native-spectrum-v1/README.md); original/32/16 kHz reports for all four existing clips; independent recomputation of 75 marker windows and spectral rankings | Browser selection/download and desktop/phone inspection remain unverified. Four clips establish engineering behavior only. |
| U3 | [Frozen event study and results](../analysis/event-simulation-v1/RESULTS.md); 600 realizations and 6,000 fits, zero fit failures; separate mechanism and observation-variant summaries | No empirical replication or interval-coverage claim. Common-driver flags (30/100 clean runs) cannot identify direct influence. |
| U4 | [Structured evaluation harness](../analysis/research-assistant-v1/README.md); 10 fixed cases, five development/five evaluation families; real adapter/tool dispatch with TEST ONLY transport; deterministic scores and review rubric | Actual model runs: zero. Audio perception and interpretation/next-check usefulness remain unscored. |

Final assembled validation: typecheck, lint, production client/Worker build, all 15 built-artifact tests, original data verification and recorded-history audit passed. All 15 new focused unit tests passed. The full suite has 292 passes and one unchanged-main failure: the frozen v0.2 exact-log replay differs at machine precision (maximum observed core-target difference 2.22e-16). Historical files and their tests were preserved.

Browser acceptance was attempted but this executor rejects Chrome sockets (`Operation not permitted`) and Wrangler interface enumeration (`uv_interface_addresses`). Desktop/phone journeys are committed, including actual download checks, but no successful browser run, listening check, deployment or paid model request is claimed. The implementation PRs remain drafts for these outstanding acceptance checks.

## Existing foundation and limits

Do not duplicate completed work:

| Existing capability | Evidence and implication |
| --- | --- |
| Four original field clips, Composer, local exports and Exchange | [README](../README.md), [audio methods](DATA_METHODS.md). Original clips are 44.1 kHz; their markers are machine estimates, not verified coda boundaries. |
| Full-source timing Atlas | [MVP-06](MVP_06.md), [feature implementation](../src/atlas/model.ts). It already covers 3,790 retained rows from 3,840 raw rows, with 50 exclusions. Spectral features would be new. |
| Dialogue Transfer v0.1 | [MVP-05](MVP_05.md). Pooled gain +0.00220 bits/coda; conditional 95% interval [-0.05468, +0.06934]. |
| Executed v0.2 | [MVP-05B](MVP_05B.md). All 55 fits completed. Primary pooled duration gain +0.00331711 squared log units, interval [+0.00049893, +0.00566578]; equal-root macro interval spans zero. Count gain is negative; gap and expanded-coverage pooled intervals span zero. These units are not bits. |
| Metadata linkage audit | [Audit](METADATA_LINKAGE_AUDIT.md). No additional independent sample was established. None of the 723 core examples has all used events linked to identified producers. Candidate names/dates expose possible dependencies across root-held-out folds. |
| Synthetic positive/negative diagnostics | [v0.1 tests](../analysis/dialogue-transfer/test_experiment.py), [v0.2 tests](../analysis/dialogue-transfer-v02/test_experiment.py). Known coupling versus independence is already tested from generated feature vectors. Extend this work to event generation and selection. |
| Deterministic rendering and answer checks | [Renderer](../src/composer/sound.ts), [answer contract](context-lab-answer-completeness.md). Timing sonification and answer completeness are implemented; neither establishes biological acoustics or factual interpretation quality. |

The old studies, splits, sources, metrics, results and historical exports remain their own versioned evidence. Any follow-up empirical fitting gets a new protocol and artifact namespace. Recording roots are not established independent encounters or animals.

## Research decisions

These sources motivate work; their findings are not CodaBridge results.

| Source | Status checked in this review | Decision for CodaBridge |
| --- | --- | --- |
| [DCCE, October 2026][dcce] | DCASE workshop proceedings | Compare timing-only, spectrum-only and simple combined representations with matched inputs/partitions before learned fusion. Raw ICI is a strong reference. Dates are session proxies; pretrained-data overlap remains possible. |
| [Coda vowel phonology, April 2026][phonology] | Proceedings B article; official tables already used in our audit | Add attributed spectral annotations. Public internal audio-array indices do not map those records to DSWP WAVs. |
| [Shipping noise, June 2026 online][noise-paper] | Ecological Informatics article and official data repositories | Enrich the same spectral records with environmental annotations. Associations remain observational; source reuse and special-code semantics need checking. |
| [Cordivari, September 2026][surrogates] | Unreviewed EcoEvoRxiv v1; not independently reproduced here | Candidate surrogate, segmentation and arrival-delay checks. Treat as a competing analysis, not a settled reversal of earlier work. |
| [BEANS-Next, October 2026][beans] | Preprint and official benchmark | Evaluate counts, order, overlap, acoustic comparisons and evidence use separately. Use its task design; do not adopt ROOTS-scale training. |
| [Beyond the Baseband, April 2026][bands] | Preprint; experiments on other taxa | Audit preprocessing/bandwidth sensitivity. Higher-band information may or may not help coda tasks. |
| [Perch 2.0 marine transfer][perch] / [WhAM][wham] | Transfer study / NeurIPS 2025 work | Optional frozen representations for retrieval or bounded comparison, after simple features. No semantic authority or independent evaluation implied by local holdouts. |
| [Birth-event study, March 2026][birth] | Scientific Reports article | Conditional single-event multimodal case study once synchronization, assets and reuse are verified. |
| [Continuous-time transfer entropy][te] | PLOS Computational Biology methods article | Inform surrogate calibration and distinguish conditional predictive dependence from direct causal influence. No automatic addition of a TE score. |

## Evidence boundaries

Maintain four explicit source classes:

1. **Original field audio:** exact recording ID, revision, original bytes and source sample rate; derived markers/features retain their method and uncertainty.
2. **Timing archive:** original source row, REC/local caller, full valid ICI sequence and exclusions. Audition remains a synthetic timing reconstruction.
3. **CETI spectral/context tables:** their own coda-ID namespace, published annotations and source rows. An exact table join does not establish an original-timing-row or waveform join.
4. **Synthetic cases:** recipe, seed, renderer version and known generated truth. Results measure software or inference behavior, not animal communication.

Keep manual source annotations, machine measurements, imported labels and generated explanations distinguishable. Do not assign public DSWP clips using private-array indices such as audidx or by timing resemblance. Unknown identity, behavior, sound origin and environmental codes stay unknown.

## U1 — Spectral and environmental source integration

### Inputs and planning-time observation

Use the complete pinned sources:

| Role | Repository / revision | File / Git blob |
| --- | --- | --- |
| Spectral baseline | [Project-CETI/coda-vowel-phonology][spectral-file], be751b8761c87813754dba10ad7068a9e71367c0 | codasp.csv / d3713078091116066a15f91c906abff9b9efef33 |
| Environmental extension | [Project-CETI/Database-for-ship-noise][noise-file], 3c0fe9dc49c08c315995ae92e4de9045e07f2b82 | codasp_w_urn.csv / a134cc79555c96450f05692585d5c394afc74dc9 |
| Field definitions | [Phonology README][phonology-readme], same spectral revision | README.9t6qu.md |
| Analysis reference | [Project-CETI/Analysis-for-ship-noise][noise-code], cc526321b417b67655dcc9a8aa5dda240fbc370f | vowelNoiseAnalysisR2.R; inspect as source, not automatic execution |

The planning-time CSV comparison found **1,375 unique IDs in each file, all IDs matched and zero disagreements across 13 shared fields**. The three added columns are **Duration, URN and AIS_Data**. This is a source observation to reproduce in U1, not a committed pipeline result.

Observed URN values/counts were 0:873, 1:471 and -1:31. AIS_Data included 0, 1, -1 and 1*. Preserve these raw tokens. A filter in an upstream script is not a complete field dictionary; do not coerce special values to booleans.

### Implementation and deliverables

- Create a versioned source/import contract and complete-file join report, for example under analysis/spectral-context-v1/. Reuse the existing bounded retrieval/hash approach where appropriate.
- Record source URL, revision, path, bytes, checksum, attribution, reuse evidence, ID namespace and source row. Include explicit waveform-mapping status.
- Join by codanum, preserve both source rows and every shared-field disagreement, and report duplicates/unmatched IDs. Do not silently select a convenient match or drop conflicts.
- Resolve field definitions and units from authoritative material. Retain raw and interpreted values separately, including an unresolved state.
- Provide a small descriptive view of reported spectral annotations, duration, coda type and available environmental context. Show denominators, missingness and known grouping support. Keep unknown producers as unknown.
- For any extension to the original timing corpus, retain the prior audit's candidate-link status and conflicts. Do not propagate identities or declare an official crosswalk.
- Check reuse conditions before shipping external rows or audio. If unresolved, deliver the importer, manifest, join verification and explicit unavailable state without bundling the external data; U2 native-audio work and U3 can continue.

### Completion criteria

A clean run reproduces the expected 1,375 one-to-one matches and zero shared-field differences against the pinned manifest. Any discrepancy produces an explicit failed or blocked integration report; affected rows do not enter the descriptive view until the discrepancy is resolved or a revised source version is reviewed. Include focused cases for duplicate IDs, mismatched fields, missing values and special tokens; independently recompute join counts and equality. Export source IDs and field provenance. A successful table join must never enable unavailable original-audio playback.

U1 is descriptive source integration. It adds no new empirical prediction fit, causal conclusion or independent-sample claim.

## U2 — Timing, spectrum and preprocessing comparison

### Two bounded paths

**Native field clips:** begin with the four already distributed original WAVs. Compute versioned spectral summaries from original samples and inspect per-event windows where marker quality permits. Report unreliable/overlapping windows as such. Four clips are suitable for engineering checks, not a generalization benchmark.

**Published CETI annotations:** expose the U1 spectral/context records in their own view. Use only supplied timing/type/duration information. A full ICI distance or original-waveform comparison remains unavailable until the corresponding mapping is verified.

### Behavior and measurement contract

- Keep absolute duration, normalized timing shape and spectral measurements separate, with named units and methods. Retain the original timing metric and its equal-count rule.
- Let users inspect similarity under each available criterion and cases where criteria disagree. The UI must say which features supported a ranking; avoid an unexplained combined similarity percentage.
- Fix windowing, amplitude handling, channels, frequency bands and eligible events before deriving results. Distinguish source sample rate from usable recording/filter bandwidth.
- Compare native measurements with explicitly derived 32 kHz and 16 kHz versions. Preserve original bytes; record resampling parameters. Upsampling cannot restore absent information.
- Measure changes in event detection/timing, spectral summaries and candidate rankings. Report failures and unchanged results, including cases where higher bands add no useful distinction.
- Initially use deterministic DSP. A frozen encoder is a later comparator only when a specific retrieval/measurement question warrants it.

### Completion criteria

Add hand-computable and synthetic paired cases for uniform timing scale, interval rearrangement at constant span, pulse-shape changes and added background. Reuse existing synthesis where possible; version any new pulse family and label it synthetic. Separate within-click spectral measures from whole-clip spectra, which can also change with rhythm.

Verify source bindings, finite values, selection-change cancellation, unavailable-data behavior, actual downloads and desktop/phone readability. Keep Composer state and existing playback ownership intact. A test-only timing reconstruction must not be presented as a measured spectral reproduction.

No learned type classifier, waveform-to-whale identity assignment or new empirical fitting is required to complete U2.

## U3 — Extend synthetic diagnostics through complete event processing

### Question and scope

Determine which generated mechanisms and observation errors the existing analysis can distinguish. Retain the feature-level diagnostics; add synthetic annotation/event streams that traverse the production parser, eligible-history selection, feature extraction, grouping, fitting and uncertainty calculation. Isolate their inputs/outputs from all historical observations and reports.

Start with the existing duration endpoint and small scenario families:

| Generated mechanism | Perturbations / truth to retain |
| --- | --- |
| Independent, internally autocorrelated callers | Per-caller persistence, rate and duration distributions |
| Shared environmental/activity driver without direct coupling | Driver trajectory, session changes and what is or is not observed |
| Directed responder process | Direction, effect strength and response delay |
| Observation variants of the above | Missed clicks/codas, arrival-time error, segmentation and recording-boundary censoring |

Freeze the generator, estimand, parameter grid, metrics, seeds and compute budget before examining results. A starting budget is **100 deterministic realizations per primary scenario**; increase only to resolve a stated Monte Carlo precision question. Expand endpoints only for a concrete uncovered failure.

### Interpretation that the benchmark must preserve

**Predictive dependence and direct influence are different targets.** A common driver can create genuine incremental predictive information from partner history even when there is no direct coupling. That is confounding sensitivity, not automatically a statistical false positive for the predictive estimand.

Report rejection/error rates only for a predeclared rule and its matching null. Separately assess unsupported attribution of direct influence. Where generated observational data cannot distinguish mechanisms, the correct result is an explicit identifiability limit.

Do not treat the old conditional descriptive bootstrap interval as an automatically calibrated significance test. Evaluate interval coverage only against an explicitly defined known/reference estimand.

### Deliverables and completion criteria

- A versioned, reproducible scenario report with per-scenario predictive gain, defined error/detection rates, Monte Carlo uncertainty, exclusions and failures.
- Verify the generated mechanism independently on small cases. Ensure latent truth, target outcomes and future events cannot enter allowed predictors.
- Exercise real eligibility barriers, strict completion cutoffs, grouping and missing-history handling rather than injecting final feature vectors alone.
- Freeze recording/event selection independently of the desired effect. Label arrival times versus emission times explicitly.
- Preserve fixed historical studies and basic diagnostics; reuse their implementation owners.
- Deliver informative failures or inability to distinguish scenarios. Completion does not require favorable biological or predictive findings.

This is a simulation study of the analysis, not new empirical confirmation.

## U4 — Composer cases and research-assistant evaluation

### Evaluation modes

Create a small fixed development/evaluation collection with variation in count, tempo, interval order, overlap, noise and ambiguous metadata. Record recipes, seeds and ground truth. Separate case families across development and evaluation so paraphrases of the same recipe do not masquerade as new test evidence.

1. **Structured-evidence mode:** the agent receives the deterministic tool evidence. Evaluate tool choice, arithmetic/interpretation, citations, changed-input handling and justified uncertainty.
2. **Waveform mode, conditional:** evaluate perception plus reasoning only after verifying that the configured route actually receives and processes audio. Log the modality supplied; never call a timing-only result audio understanding.

Keep expected answers, recipe identifiers that disclose labels, latent truth and creator-assigned meanings out of model-visible inputs. Synthetic ground truth validates these tasks; separately reviewed field examples are needed for real-audio performance.

### Next-evidence behavior

For an uncertain observation, return a compact proposal containing:

- Competing explanations supported or left open by the available evidence.
- The observation or control that would separate them.
- Whether that evidence is already available, requires an unresolved linkage or needs new observation.
- The possible outcomes that would change the assessment.

Do not invent a causal answer when the available inputs cannot identify one. Suggested acquisition remains a proposal; it does not contact authors or trigger collection.

### Completion criteria

Publish separate scores for measurable accuracy, source/evidence binding, unsupported biological claims, appropriate abstention and usefulness of the proposed next check. Define deterministic checks where possible and a reviewed rubric for interpretation. Schema completeness alone is insufficient; a second unconstrained model's agreement is not ground truth.

Provider-free fixtures verify orchestration only. Actual agent-quality claims require recorded model runs with model/configuration, actual input evidence, output, case set, budget and failures. Reuse explicit invocation, cancellation/stale-result handling and existing provider boundaries. No private Exchange text, keys or codebook content enters these evaluations.

## Conditional follow-ups

| Candidate | Trigger and bounded next step |
| --- | --- |
| Dependency-aware empirical follow-up | Use the existing metadata audit to enumerate plausible dependency/grouping alternatives. Resolve what can be resolved; keep uncertain links visible. Freeze a new study's cohorts, partitions and estimand before fitting. Old folds/results remain historical. |
| Order-preserving timing representation | Current [features](../analysis/dialogue-transfer-v02/features.json) compress most ICI order into summaries. Compare a simple order-preserving representation only under the new study protocol, with train-only transformations and matched support. |
| Frozen Perch/WhAM comparison | Require a demonstrated measurement/retrieval need, verified input requirements and reusable weights. Compare raw ICI/simple spectra on the same events; disclose pretraining overlap and supported classes. |
| Birth-event Context Lab | Verify synchronized audio/video/annotations, provenance and reuse. Begin with one sourced case, retaining its single-event scope. |
| Human-defined communication game | Use Composer/Exchange for a separate task with known human-assigned referents. Measure learning, transfer and robustness; keep these scores separate from whale evidence. |

Neither pretrained embeddings nor candidate metadata supply missing biological identities or semantic labels. Repeated evaluation on the same archive remains exploratory; richer models do not create independent replication.

## Implementation and review

Follow [AGENTS.md](../AGENTS.md) and read the existing owner documents for each affected component. ChatGPT plans/reviews; Codex implements and verifies focused PRs.

For each package:

1. Recheck current main and matching work; state exact touched paths and input revisions.
2. Fix the small contract/protocol before generation or scoring. Prefer browser/static assets and offline scripts; add no infrastructure without a demonstrated need.
3. Run targeted numerical/data checks. For application changes, run the relevant typecheck/build and affected browser journeys, with actual downloaded artifacts and visible source labels.
4. Keep document validation separate from implementation, numerical reproduction, real-device listening, deployed behavior and live-model evidence.
5. Report delivered behavior, sources, actual commands/results, limitations and the next unblocked package. Record unsuccessful comparisons; do not search until a favorable result appears.

The original plan-only change required document/link/scope checks. Actual implementation evidence and remaining gaps are now recorded in the execution table and package READMEs. Application deployment, model enablement and new empirical-study execution remain separate assignments under the existing repository workflow.

[dcce]: https://dcase.community/documents/workshop2026/proceedings/DCASE2026Workshop_Quintanilha_70.pdf
[phonology]: https://doi.org/10.1098/rspb.2025.2994
[noise-paper]: https://doi.org/10.1016/j.ecoinf.2026.103881
[surrogates]: https://ecoevorxiv.org/repository/view/14903/
[beans]: https://earthspecies.github.io/beans-next/
[bands]: https://arxiv.org/html/2604.27936v1
[perch]: https://arxiv.org/html/2512.03219v1
[wham]: https://proceedings.neurips.cc/paper_files/paper/2025/hash/24d13f93b7715e4768d792ba7b4ffd3e-Abstract-Conference.html
[birth]: https://www.nature.com/articles/s41598-025-27438-3
[te]: https://pmc.ncbi.nlm.nih.gov/articles/PMC8084348/
[spectral-file]: https://github.com/Project-CETI/coda-vowel-phonology/blob/be751b8761c87813754dba10ad7068a9e71367c0/codasp.csv
[noise-file]: https://github.com/Project-CETI/Database-for-ship-noise/blob/3c0fe9dc49c08c315995ae92e4de9045e07f2b82/codasp_w_urn.csv
[phonology-readme]: https://github.com/Project-CETI/coda-vowel-phonology/blob/be751b8761c87813754dba10ad7068a9e71367c0/README.9t6qu.md
[noise-code]: https://github.com/Project-CETI/Analysis-for-ship-noise/blob/cc526321b417b67655dcc9a8aa5dda240fbc370f/vowelNoiseAnalysisR2.R
