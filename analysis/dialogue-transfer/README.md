# Dialogue Transfer v0.1

Owner assignment: [#10](https://github.com/hynk-studio/CodaBridge/issues/10). Offline classical fitting only. This directory has no public training service or provider calls.

## Data-only freeze

The full pinned CSV is passed through `src/lab/parse.ts::parseAnnotations`. `inputs/validated.json` retains all 3,840 raw rows and exact decimal strings, the 3,790 validated whole codas and all 50 validation exclusions. Python consumes this intermediate; it does not invent a second validator. Raw inputs and the earlier Lab selection/score remain unchanged.

Before scores: 22 six-character roots, 48 nine-character files, 219 exact REC groups. Restrict to exactly two known caller labels in a raw exact REC; 2,177 otherwise-valid rows are outside this subset. There are 1,392 valid current/next opportunities before the four-partner requirement; it costs 669, leaving **723 examples / 67 REC / 19 parent roots** for all four models. The two-caller audit finds 17 rejected/ambiguous barriers and no onset gaps exceeding the conservative 60-second maximum. There are no exact repeated valid events or overlapping intervals across distinct fragments of the same nine-character file. Full per-row dispositions and consecutive gaps are in `eligibility-audit.json`; no independent sample count is inferred from fragments.

Source-driven grouping clarification, made before scoring: exchange text lines 29–43 explicitly identify nine-character audio file names. Its lines 167–180 share a six-character `rootname`/time origin; rubato lines 41–65 traverse that root, and lines 421–445 group associated PRH sensor files under it. We conservatively coalesce these **author recording roots** for held-out splits and bootstrap. This is the largest grouping supported by the retained source association; the code does not certify session/encounter identities, independence, or globally stable callers. No notebook/pickle is executed. Histories stay inside exact REC even when a parent root contains multiple files.

Precision uses written decimal half units, not an invented timing-accuracy estimate. Same-caller overlaps are treated as ambiguity barriers (including simultaneous onsets); different callers may overlap. A completed partner must finish strictly before the lower rounding envelope of the current cutoff. Target onset must be strictly after its upper envelope. Invalid rows and recording gaps break history; a rejected immediate next focal row is never skipped. Unknown onset/caller excludes the REC because its position/identity cannot safely be localized. Whole long codas remain intact.

`cohort.ts::prefixFeatures` accepts only available codas/current cutoff and has no target input. Retrospective cohort eligibility lives separately. Later held-out examples may use earlier observed calls in their exact REC, without refitting anything. The deterministic example selection and group allocation are recorded in `split-manifest.json`, independent of scores/target values.

The executable `protocol.json`, `features-v1.json`, inputs and manifest are committed before the first held-out score. Fixed versions: Python 3.12.14; dependencies in `requirements.txt`. L2 multinomial `lbfgs` uses scikit-learn 1.7.2's supported API, omitting deprecated `multi_class` and requiring three training classes. No hyperparameter/lag/seed search. [Estimator documentation](https://scikit-learn.org/1.7/modules/generated/sklearn.linear_model.LogisticRegression.html), [training-only preprocessing](https://scikit-learn.org/1.7/common_pitfalls.html).

## Reproduction

From repository root, create only a local environment with Python 3.12.14:

```sh
python3.12 -m venv analysis/dialogue-transfer/.venv
env -u OPENAI_API_KEY analysis/dialogue-transfer/.venv/bin/python -m pip install -r analysis/dialogue-transfer/requirements.txt
env -u OPENAI_API_KEY node --experimental-strip-types scripts/prepare-prediction.ts --check
env -u OPENAI_API_KEY node --experimental-strip-types --test tests/prediction-cohort.test.ts
```

Initial environment used the Codex bundled Python at `/Users/hynk/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`; no system Python changes.

```sh
env -u OPENAI_API_KEY npm run analysis:test
env -u OPENAI_API_KEY npm run analysis:verify
env -u OPENAI_API_KEY npm run analysis:reproduce
```

`analysis:verify` checks the saved artifacts without Python or fitting: it re-derives validation/cohort parity, checks input/producer/freeze hashes, independently recomputes train-only edges/imputation/scaling, scalar dot-product/softmax probabilities, all paired losses/gains and 2,000 bootstrap resamples, then validates the bounded browser schema. `analysis:reproduce` reruns the unchanged fixed fit and compares saved numbers at absolute tolerance 1e-8 / relative tolerance 1e-7 without overwriting files. The initial one-time writing command was `env -u OPENAI_API_KEY analysis/dialogue-transfer/.venv/bin/python analysis/dialogue-transfer/run.py` (now also exposed as `npm run analysis:run`); it refuses to overwrite a saved run. It also requires its exact producer sources committed before scoring. A documented bug correction must retain superseded artifacts; do not remove saved output to tune a new run.

## Executed result

Freeze commit: `5c07c77ec8f9b3a028737ec7a73b63181e44ee98`. Producer commit: `44c4a09b83308a909d2086ab620b30621458d509`, tree `e946108b3949dbe74824f8d55263ccc2ffa8288c`. The later commit containing results is an artifact commit, not a self-referential producer. Full provenance, hashes, original source record and fixed protocol accompany [report.json](results/report.json); offline coefficients/preprocessing are in [fold-fits.json](results/fold-fits.json). The public summary is about 48 KiB and the downloadable report about 2 MiB. No training inputs or coefficient tables are loaded into the UI.

All five folds completed on the same 723 examples; no failed folds, missing training classes or clipped probabilities. Log loss (bits/coda): M0 **1.58505117**, M1 **0.63376433**, M2 **0.63156177**, separately fitted M2-lagged **0.65172189**. Pooled held-out predictive gain: **+0.00220256**, conditional group-bootstrap 95% interval **[−0.05468204, +0.06934151]**. Group-macro gain: **+0.05647774**; this secondary weighting does not replace the near-zero primary result. Older versus self: **−0.01795756**, interval **[−0.05677792, +0.02408623]**. Recent versus older: **+0.02016012**, interval **[−0.03423974, +0.09548250]**. These controls are not permutation nulls or causal tests.

The initial pinned NumPy/macOS backend emitted `divide by zero`, `overflow` and `invalid value` warnings in `matmul`, despite finite values. A separate finite random matrix reproduces the warnings and matches a non-BLAS contraction exactly on this machine; [NumPy upstream report](https://github.com/numpy/numpy/issues/28687). No package/solver/feature changes or warning suppression were used to improve the result. Independent scalar reconstruction of all saved OOF probabilities differs by at most **9.9920e-16**; the independently recomputed maximum training-gradient component is **9.9750e-7**, below the fixed 1e-6 tolerance. The unchanged fit reproduces. Warnings remain observable on this platform; numerical checks are retained rather than silently discarding them.

Synthetic diagnostics are **TEST ONLY**: fixed-seed known coupling gives +1.32374 bits/coda, while a finite independent process gives +0.00162337. The test deliberately accepts either sign for a finite independent sample; neither synthetic value appears as the real experiment. [Application/browser verification and captures](../../docs/MVP_05.md).

Attribution: Pratyusha Sharma, Shane Gero, Roger Payne, David F. Gruber, Daniela Rus, Antonio Torralba and Jacob Andreas; Dominica Sperm Whale Project. *Contextual and combinatorial structure in sperm whale vocalisations* (2024). Zenodo 10817697, CC BY 4.0, archived commit `7228c8eed2cc27ddd23b74c51aeccec9d762389e`. Source record: `data/context/source-record.json`. No verified field-audio mapping; no animal-meaning or causal claim. The archive/paper subset discrepancy remains unresolved.
