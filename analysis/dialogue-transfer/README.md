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

Initial environment used the Codex bundled Python at `/Users/hynk/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3`; no system Python changes. Additional fitting/verification commands and actual findings accompany the implementation in this same branch.

Attribution: Pratyusha Sharma, Shane Gero, Roger Payne, David F. Gruber, Daniela Rus, Antonio Torralba and Jacob Andreas; Dominica Sperm Whale Project. *Contextual and combinatorial structure in sperm whale vocalisations* (2024). Zenodo 10817697, CC BY 4.0, archived commit `7228c8eed2cc27ddd23b74c51aeccec9d762389e`. Source record: `data/context/source-record.json`. No verified field-audio mapping; no animal-meaning or causal claim. The archive/paper subset discrepancy remains unresolved.
