# Full-file metadata linkage audit

**Completed read-only investigation; candidate links, not an official crosswalk.** The complete pinned files reproduce all 25 supplied ATWOOD events and provide broader event linkage. They also expose incomplete producer identity, changed annotations and calendar ambiguities. No fitting, historical fold/source/result change, or identity promotion into the application occurred.

Base main was rechecked at **`b3fb7daaa6d851baf35b8224648c25d743ea466f`**, including merged #13. No matching audit issue, branch or PR existed. Work continued on `codex/metadata-linkage-audit`; the pre-existing untracked PNG was left untouched. This audit follows the owner's separate assignment after [#12](https://github.com/hynk-studio/CodaBridge/issues/12)/[#13](https://github.com/hynk-studio/CodaBridge/pull/13), without reopening their fitting scope. The new Draft PR records its exact final head/base/tree. Checks were executed September 14, 2026 KST (September 13 UTC).

## What was compared

The original archived CSV remains **500,380 bytes**, SHA-256 `1856c8bf915cc5ae6f928aaa2036cbbc6ad8840bb6e4f6a96aaeb96953215da2`, Git blob `dd200dc254984eeb26ae9e6bdd5d8674822fc458`. `parseAnnotations` still yields **3,840 raw / 3,790 valid / 50 excluded** rows, **219 REC fragments**, **48 nine-character prefixes**, and **22 six-character roots**. Invalid rows are included in this linkage audit with their original exclusions; they are not restored to research cohorts. Whole long codas and all available ICI columns are compared without Composer truncation.

Full pinned inputs, not the earlier 1,499 report bindings plus two extra rows:

| Repository / revision | File | Rows or role |
| --- | --- | ---: |
| MaorAssayag/coda-sequences-relations-and-prediction · `aab40e2bac7bf2dae2c3b9b2b752ba262b66fc93` | `dataset/dswp-2014-2016-retagged-maor-2025.csv` | 3,933 |
| Same pin | `README.md`, `LICENSE`, `codaspred.ipynb` | Semantics/rights; notebook source text only |
| Project-CETI/coda-vowel-phonology · `be751b8761c87813754dba10ad7068a9e71367c0` | `README.9t6qu.md` | Documented field/join meanings |
| Same pin | `codamd.csv`, `codasp.csv` | 1,375 each |
| Same pin | `focal-coarticulation-metadata.csv` | 1,097 consecutive-coda pairs |

[Pinned retrieval manifest](../analysis/metadata-linkage-v1/retrieval-manifest.json) records every public URL, byte count, Git blob and SHA-256, verified against downloaded complete bytes and the nontruncated pinned Git trees. Maor CSV: **2,258,170 bytes**, Git blob **`2a84f92cfd0ca4472e30b9913afc2c291b261834`**, SHA-256 **`17b37605e56a21fb96bff301a2d43c4139693f7def23d4e3801d046026069856`**. [Exact retrieval/reproduction commands and comparison rules](../analysis/metadata-linkage-v1/README.md).

## Event linkage and conflicts

Maor yields **3,765 onset candidates for 3,747 original rows**. Of those candidate pairs, 2,796 retain exact REC and 969 share only the six-character root; none needs a nine-character-only category. **3,678 original events have a unique compatible count/all-ICI fingerprint**: 2,738 exact REC and 940 changed file/fragment labels. The latter already share a historical six-character group; they are not evidence for splitting it. They remain inferred same-event links, not an official recording-file crosswalk.

All candidates are retained, including **18 original rows with multiple onset candidates**, 18 candidate caller disagreements, 70 count conflicts, 85 pairs with shared-ICI conflicts, and 42 reported-duration conflicts. These counts overlap and describe candidate pairs, not independent damaged events. All 3,678 compatible fingerprints preserve the original local caller value in these actual files, but the matcher does not assume this: relabeling regressions pass. There are no inverse compatible-link collisions. All 359 multi-event Maor-mapped local sequences are strictly ordered; all 411 local sequence records, including empty/singleton cases, are saved.

CETI joins have **1,375 distinct IDs**, including **1,139 with timing** and **236 without**. The pinned metadata/spectral IDs are unique, with no conflicting within-CETI fields or timing variants; all 1,097 supplied inter-coda gaps agree with their datetimes. Full-source onset comparison retains **1,115 candidates**, of which **1,103** also agree with whole duration and available counts. **1,098** have explicit ordered same-REC/local-caller sequence corroboration, covering **965 pairs**; five are compatible isolated events. Twelve conflicting candidates remain visible. There are no direct timing-candidate collisions in this source.

The independent numeric namespace bridge finds **1,369** Maor `codaNUM2018` values in CETI `codanum`. All available bridge durations, names, focal flags and relative onsets agree under the stated precision rules, but **12 spectral click-count disagreements** remain. No bridge-only record is presented as direct timed CETI linkage. The namespace equivalence is inferred from this agreement, not declared by the two repositories.

This is substantially **the same recorded material**. Maor has 255 rows without a compatible original fingerprint: 69 have original-onset candidates with annotation conflicts, and 186 have no such candidate. Its extra root `sw103a` contributes 134 records absent from the original corpus. CETI has 272 IDs without a compatible original event, including missing timing and conflicts. Unmatched does not prove new: changed onsets, omitted annotations and different selection remain possible. **No additional independent sample is established.** The 3,840/3,948 paper-subset discrepancy is not resolved by the Maor file's different 3,933-row total.

## Reproduced seed and time origins

| CETI codas | Original REC | Matched events |
| --- | --- | ---: |
| 4985–4999 | `sw061b001_513` | 15 |
| 5012–5015 | `sw061b001_629` | 4 |
| 5063–5068 | `sw061b001_4333` | 6 |

All 25 original callers are local label **1**; CETI names the producer **ATWOOD**, with tag-on **`2015-02-03 11:20:26` as written**. Onset minus that origin agrees with original `TsTo`, and end minus onset agrees with whole ICI duration. Original **source line 56 / coda 4985** has **516.0025 s onset, 0.39305 s duration and nine clicks**. The mapping preserves every source line, pair role and count source.

The prior partial inspection reported 23 available last-click positions and left two unavailable. The **complete file** supplies last-click positions for all 25 seed codas; these are newly located observations, not filled-in counts. For example, coda 5015's position **6** appears as `prevcodanum` on coarticulation **line 672**, outside the early `aa` block. Across the entire CETI file, **278 IDs still lack a last-click position** and remain null. Spectral string lengths are retained separately, never substituted into that missing field.

Calendar identity remains unresolved. The complete matched `sw061b` material contains **both** CETI tag origins `2015-02-03 11:20:26` and `2015-03-02 11:20:26`. Maor has both numeric `02-03-2015` and textual March `02-מרץ-2015`. Other numeric dates permit two day/month orders; some CETI dates reflect one order. Relative timing can agree while calendar interpretation differs. The audit preserves each literal date, reports every valid numeric interpretation, assigns no timezone, and never optimizes an event offset or chooses a date to manufacture agreement.

## What “identified” means here

[CETI's pinned README](https://github.com/Project-CETI/coda-vowel-phonology/blob/be751b8761c87813754dba10ad7068a9e71367c0/README.9t6qu.md) defines `whale` as producer name, empty as unidentified, and `focal` as whether the tagged whale produced the coda. All 1,375 metadata rows are focal; **108 have empty names**. A name is documented for its CETI coda; transferring it to an original row remains inferred linkage.

Maor has **no `Individual` column**. `Name`, `Unit` and `Tag` are constant together within each tag even across nonfocal callers. No individual/unit dictionary or unknown-value definition was found in its README or the **390 notebook source cells**; the notebook references an absent `Shane_Annotations.csv` path (cell 4), and uses Focal/Tag in sequence processing (cell 10). It does not establish a global producer mapping. Downloaded cells were never executed and their output/model objects were not used as evidence.

- `Name=UNID` and `Unit=ZZZ` co-occur on 134 rows. They remain unknown placeholders, not an animal or social unit.
- `IDN=0` occurs on 2,510 nonfocal or missing-focal rows. `IDN=9999` occurs on 47 focal UNID rows. Neither is a resolved individual.
- `Unit=U` occurs on 904 FORK-tag rows. **U is not treated as “unknown.”** A tag's unit is still not assigned to every audible producer.
- Only a unique compatible event with explicit Focal=1, non-placeholder Name and IDN contributes to the separate **Maor focal-name candidate** tier. This is an operational conservative inference, not a newly discovered official dictionary. Missing Focal, nonfocal rows and unknown values stay unresolved. A caller match is never propagated across a REC or root.

## Annotation and cohort coverage

“Combined candidate” below means a sequence-supported named CETI link or a conservative Maor focal-name candidate, without disagreement. Strict CETI-only coverage remains separately visible. No official identity was added to any original annotation.

| Population | Rows | Unique Maor event fingerprint | Compatible timed CETI | Sequence-supported named CETI | Combined named-producer candidate |
| --- | ---: | ---: | ---: | ---: | ---: |
| Raw annotations | 3,840 | 3,678 | 1,103 | 1,098 | 1,330 |
| Validated annotations | 3,790 | 3,673 | 1,103 | 1,098 | 1,329 |
| Distinct used events in core | 1,291 | 1,243 | 405 | 404 | 468 |
| Distinct used events in coverage | 1,464 | 1,413 | 478 | 477 | 547 |

The **723 core examples are exactly the v0.1/v0.2 common cohort**, with 67 REC / 19 roots. The **1,017 coverage examples** retain 89 REC / 20 roots. No example, feature, target or fold was rebuilt under an identity rule. “Used” is current + target + actually used previous/recent/older feature history, deduplicated within an example.

| Cohort | Fully identified candidates | Partly identified candidates | Unidentified | Partly covered using strict CETI only |
| --- | ---: | ---: | ---: | ---: |
| Core 723 | **0** | **517** | **206** | 453 |
| Coverage 1,017 | **0** | **742** | **275** | 653 |

Role counts below are **occurrences**, so one observed event can appear in multiple examples or roles. The downloadable coverage report separately gives distinct-event denominators for every role.

| Role | Core occurrences | Core combined / strict CETI | Coverage occurrences | Coverage combined / strict CETI |
| --- | ---: | ---: | ---: | ---: |
| Current | 723 | 247 / 208 | 1,017 | 379 / 331 |
| Target | 723 | 247 / 205 | 1,017 | 380 / 328 |
| Previous focal | 712 | 245 / 206 | 970 | 364 / 316 |
| Recent partner | 1,446 | 524 / 426 | 2,034 | 709 / 585 |
| Older partner used by lagged fit | 1,446 | 526 / 441 | 0 | 0 / 0 |
| Feature history, excluding current/target | 3,604 | 1,295 / 1,073 | 3,004 | 1,073 / 901 |
| All completed partner history, including unused older calls | 6,136 | 2,151 / 1,797 | 6,865 | 2,379 / 1,995 |

If all available completed partners are included in the example-level identity denominator, coverage becomes 744 partly covered / 273 unidentified for the expanded cohort; the core stays 517 / 206. **Fully covered remains zero.** Empty optional previous history is not treated as an unidentified animal. Event identity coverage does not establish a fully identified exchange or partner continuity.

## Dependence and decision note

The candidate names expose repeated individuals across historical root-held-out folds (zero-based): **FORK** in `sw078a`/`sw085a`/`sw090b` (folds 1/3/0), **LAIUS** in `sw100a`/`sw134a` (4/3), and **TBB** in `sw091a`/`sw097a`/`sw119b` (1/3/4; `sw119b` is coverage-only). SOPH also appears in two roots, one outside the research cohorts. The report separately flags repeated Maor tag names, including roots without linked producer events, and all possible same-date root sets. Shared unit/date/tag context does not establish shared encounters, simultaneous tags or duplicate-event boundaries.

The old splits remain exactly as executed. Their held-out unit is a **recording root**, not an independently established animal or encounter. This audit strengthens the warning against interpreting those results as new-individual or independent-encounter validation; it does not invalidate their numerical reproduction, create new predictive evidence, or justify fitting until gain improves.

The bounded sources support an auditable **candidate event crosswalk and partial focal-producer metadata**. They leave nonfocal identities, global local-caller continuity, calendar/timezone normalization, actual encounter boundaries, simultaneous-tag duplication and external-sample independence unresolved. The most useful missing material is an authoritative **original row/REC/file ↔ coda ID ↔ actual producer ↔ recording/tag deployment ↔ encounter** crosswalk, a field dictionary for Name/IDN/Unit/Focal and unknown tokens, canonical date/time-origin interpretation, and documented shared-session/duplicate recordings. The remaining original/retagged/paper row correspondence also needs explicit accounting. These are data requirements, not author contact or a new acquisition campaign.

Keep these names in this reviewable audit. Do not promote them into the UI or synthetic-coda generation, regroup historical folds, or start further fitting without a separate concrete decision. Observed timing/count variation can remain descriptive inspiration for human-authored styling; metadata linkage does not validate whale-response rules, meaning, animal playback or generation for arbitrary synthetic codas. Stop here for review before additional research or Packet/Exchange/encryption work.

## Rights and verification

Maor's [README](https://github.com/MaorAssayag/coda-sequences-relations-and-prediction/blob/aab40e2bac7bf2dae2c3b9b2b752ba262b66fc93/README.md) says **MIT**, while its [LICENSE](https://github.com/MaorAssayag/coda-sequences-relations-and-prediction/blob/aab40e2bac7bf2dae2c3b9b2b752ba262b66fc93/LICENSE) contains **Apache 2.0**. This conflict is recorded, not resolved by choosing the more convenient grant. Neither establishes a separately documented data-specific permission here. The pinned CETI tree has no LICENSE and its README provides no data-specific grant. No claim is made about rights elsewhere in the linked OSF deposit. Original archive CC BY 4.0 remains separate. Credit the Dominica Sperm Whale Project, the original Sharma et al. archive, Maor Assayag's repository and Project CETI's phonology metadata. Full external datasets/notebook bytes remain ignored; only manifests, code and derived mappings are committed.

All newly executed commands use `env -u OPENAI_API_KEY`; the [audit README](../analysis/metadata-linkage-v1/README.md) contains exact clean-checkout reproduction instructions. New logs are in [metadata-linkage-v1](metadata-linkage-v1/); their artifact manifest binds file bytes. The existing studies' warning evidence, results, screenshots and browser-delivered JSON remain historical, unchanged.

| Newly executed command | Outcome |
| --- | --- |
| `npm run audit:metadata:fetch` | All eight pinned cached/downloaded files verified |
| `npm run audit:metadata:run` | Actual full-file audit completed |
| `npm run audit:metadata:test` | 10 focused tests passed, including TEST ONLY collisions, unknowns, precision, conflicting metadata and missing/tampered files; real 25-event regression |
| `npm run audit:metadata:verify` | Independent Python CSV/Decimal reconstruction passed for complete mappings, namespace bridges, sequence evidence, coverage and preservation |
| `npm run audit:metadata:reproduce` | Exact deterministic reproduction passed; no output overwritten |
| `npm run analysis:verify` | Original v0.1 artifacts and numerical checks passed, without fitting |
| `npm run analysis:v02:verify` | Original v0.2 artifacts and numerical checks passed, without fitting |
| `npm run data:verify` | Original source and deterministic curated data checks passed |
| `npm run typecheck`, `npm run lint`, `npm run build` | Passed; production client/native Worker compatibility build |
| `npm test` | **209/209 passed** |

Environment: Node **25.9.0**, npm **11.12.1**, Python **3.9.6** stdlib, macOS **26.6.2 arm64**. **462 pre-existing tracked files** match the base byte-for-byte; the only modified pre-existing files are current README status and added npm audit scripts. This includes all application/provider code, both saved protocols/cohorts/splits/fits/results, public results and historical browser downloads. Application-browser and native-Worker test suites were not repeated for this CLI/data-only change; no UI behavior or new running-app screenshot is claimed. There was no fitting, paid request, credential inspection, author contact, bulk audio acquisition, animal playback, deployment, inference enablement, merge or unrelated repository change.
