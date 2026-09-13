# Context source audit · version 1

Acquired 2026-09-13 from the paper-cited [Zenodo record 10817697](https://zenodo.org/records/10817697), DOI **10.5281/zenodo.10817697**, release **sw-combinatoriality**, publication 2024-03-14. The deposit explicitly describes Dataset and Codebase and declares **CC BY 4.0**. This is the archived release, not an assumed license for another repository revision. Attribution: Sharma et al., *Contextual and combinatorial structure in sperm whale vocalisations* (2024), and the Dominica Sperm Whale Project. Full credited authors, URLs, license record and transformations are in [source-record.json](../data/context/source-record.json).

## Exact inputs

Archive root `pratyushasharma-sw-combinatoriality-7228c8e/`; [release commit](https://github.com/pratyushasharma/sw-combinatoriality/commit/7228c8eed2cc27ddd23b74c51aeccec9d762389e) `7228c8eed2cc27ddd23b74c51aeccec9d762389e`.

| Input | Bytes | SHA-256 |
| --- | ---: | --- |
| Release ZIP | 4,879,909 | `3639acbf5f5d3ee9ab4f05befb2aa7df065063820126bfbd872f76c8a4b009cd` |
| `data/sperm-whale-dialogues.csv` | 500,380 | `1856c8bf915cc5ae6f928aaa2036cbbc6ad8840bb6e4f6a96aaeb96953215da2` |
| `code/1-exchange-plot.ipynb` | 335,800 | `605d94c4bb303826fe2ef58d51e3c7e257bbfe77259a0629cf8185daa2a896a7` |
| `code/4-rubato.ipynb` | 1,663,470 | `fb841377d778e6aacc506329fcb157976bc43418ec0e7a66f032bf2b9f906143` |

The ZIP's declared MD5 `ea057337237598b7118fec5713ed3edf` was checked as well. The exact CSV is retained. Notebook code/markdown cells were read as text and retained with cell indices; outputs were omitted. No notebook, pickle or downloaded code was executed. The original notebook hashes identify the archive bytes, not the extracted text files.

## Semantics and validation

- Exchange notebook cell 2 groups the first nine REC characters as source file names, starts each coda at `TsTo`, accumulates ICIs until zero padding, and sorts by time. It flags intervals ≤0.0002 seconds as annotation mistakes. Its later comments identify absolute time in the source file and seconds; minute labels divide the horizontal axis by 60. Rubato cells 2–3 use `TsTo`, `Duration`, integer `Whale`, and a broader six-character grouping for traversal. We do not adopt that traversal as a verified bout identity.
- CodaBridge conservatively retains **exact REC groups** and never joins callers across them. REC suffix/bout semantics and global identities remain unestablished. Positive integer `Whale` values become annotation-local A/B labels only. All source labels are integers 1–11; no unknown label was observed, while invalid/unknown labels are rejected in tests.
- Use exactly `nClicks − 1` ICIs, each finite and positive; every remaining padded ICI must be zero. Calls with 2–29 markers remain whole. Valid source calls above Composer's twelve-marker bound: **124**. None is truncated or cast as a Composer block.
- Derived duration is the sum of valid ICIs. Reported `Duration` remains separate. Allowed agreement error is half the final reported decimal unit of Duration plus the corresponding half units of the valid ICIs, plus `1e-12` for floating arithmetic. This is a reproducible rounding allowance, not evidence of timing accuracy. Onset precision is retained as written; no estimated start correction is applied.
- Reject a whole coda for the authors' ≤0.0002-second interval warning, rather than deleting a click. Invalid timing, nonzero padding, unknown callers, and duplicate rows are excluded with explicit reasons. No inferred metadata is filled.

Full results: [audit.json](../data/context/audit.json). **3,840 rows**, **219 exact REC groups**, **48 nine-character file prefixes**; **3,790 valid**, **50 excluded**. Reason counts overlap: 33 duration disagreements, 9 author-flagged short-ICI rows, 8 invalid single-marker counts and 8 invalid durations. Exact duplicate rows: zero; duplicate numerical `(REC, caller, onset, clicks)` events among valid rows: zero. No out-of-order rows within REC were observed. Tests cover duplicates and reordering separately.

The [paper](https://www.nature.com/articles/s41467-024-47221-8) describes a 3,948-coda temporal/speaker subset. This archive has 3,840 rows, and the rubato code itself hardcodes 3,840. The missing 108-row correspondence remains unresolved. We neither declare these counts equivalent nor invent rows. The selected, internally usable segment is a bounded archive observation, not a complete paper replication or independently human-reviewed annotation set.

## Frozen segment selection

[quality-coverage-v1](../data/context/selection-rule.json) was recorded **before calculating observed/control scores**. Sort REC lexicographically, then valid onsets/source lines. Choose the first 60-second window starting at a valid onset, ending within the group's known span, containing 12–60 whole valid codas, exactly two known local callers with at least four calls each, and at least four positive cross-caller overlaps. Reject windows intersecting invalid/unknown rows. Omit and report boundary-crossing codas; do not clip them. No ranking by effect, type or contrast occurs.

Selected **`sw061b001_124-from-row-2-60s-v1`**, exact REC **`sw061b001_124`**, **126.0372–186.0372 seconds** from source file start. Local labels 1 and 2 map to A/B. CSV lines **2–24 inclusive**, 23 whole codas; boundary-crossing line **25** excluded. Marker counts present: **4, 5, 17, 20**. Seven positive-overlap pairs involve fourteen distinct calls. Every selected raw row and ordered timestamp is preserved in [context.json](../src/data/context.json), along with version, source hashes and transformation metadata.

Run `env -u OPENAI_API_KEY npm run data:verify` to check original field data plus the source CSV hash and exact derived Context files. `scripts/prepare-context.ts` regenerates them deterministically when intentionally changing the reviewed derivation. Source annotations, computed spans, the descriptive control, generated interpretation and creator-authored data remain separate.

No exact licensed original-audio mapping was verified. Lab sound is **timing reconstruction from research annotations — not the original recording**. The four existing field WAVs and user creations are not alleged to occur in this exchange.
