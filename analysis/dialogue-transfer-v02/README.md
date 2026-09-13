# Dialogue Transfer v0.2 — executed fixed package

[Assignment #12](https://github.com/hynk-studio/CodaBridge/issues/12) is implemented and executed. All **55 learned fits** completed: three core endpoints and one duration coverage sensitivity. [Results and decision note](../../docs/MVP_05B.md), [all model/contrast/stratum tables](RESULTS.md), [pre-score methods](METHODS.md), [protocol](protocol.json), [full report](results/report.json), [offline fits](results/fold-fits.json).

The freeze is `ab422e5e9df914a924f7df65229fefd1cb1711f3`; producer `f9e70e2e82d899bfa9e914983aa4de6e8cf9f702` (tree `39ad0274d2850d7499df869ba926d8b381d44a8f`); result-artifact commit `83ffd5983da544029fcdbd70d2f5cf77430a8307`. The protocol, both cohorts/splits, target/feature definitions, source audit and numerical criteria were committed before any new real-data scores. The producer was also committed before execution. No outcome-driven changes or extra models were fitted.

## Reproduce without overwriting

Run from the repository root. The existing repository-local isolated environment is reused with **Python 3.12.14**, NumPy **2.2.6**, SciPy **1.15.3**, scikit-learn **1.7.2**, joblib **1.5.2**, threadpoolctl **3.6.0**, and one numerical-library thread. The runner checks these versions. No Python service or training dependency enters the public runtime.

For a fresh checkout only, create the missing local venv with Python 3.12.14 and install the pinned requirements. This implementation reused the existing environment without reinstalling or changing system packages.

```sh
python3.12 -m venv analysis/dialogue-transfer/.venv
env -u OPENAI_API_KEY analysis/dialogue-transfer/.venv/bin/python -m pip install -r analysis/dialogue-transfer-v02/requirements.txt
```

Validation and unchanged numerical reproduction:

```sh
env -u OPENAI_API_KEY npm run analysis:v02:prepare -- --check
env -u OPENAI_API_KEY npm run analysis:v02:test
env -u OPENAI_API_KEY node --experimental-strip-types --test tests/research-analysis.test.ts tests/research-prediction.test.ts
env -u OPENAI_API_KEY npm run analysis:v02:verify
env -u OPENAI_API_KEY npm run analysis:v02:reproduce
```

The actual initial writing command was `env -u OPENAI_API_KEY npm run analysis:v02:run`. It now refuses to overwrite the saved run. `analysis:v02:reproduce` reruns the unchanged package and compares all numerical outputs at absolute tolerance `1e-8` and relative tolerance `1e-7`, without writing results. It is numerical reproduction, not an independent study. Do not remove saved artifacts to obtain another result. All v0.1 script meanings and artifacts remain unchanged.

`analysis:v02:verify` uses Node/TypeScript only, without fitting. It rebuilds both cohorts through the original validation/prefix owner; checks all protected v0.1 bytes and v0.2 freeze/producer/source identities; replays scalar predictions; independently checks training-only preprocessing and stratum thresholds; enforces every numerical criterion; and recalculates losses, gains, group contributions, all fixed-prediction deletions, strata and paired bootstrap percentiles. The browser schema and report/summary byte bindings are checked last.

## Numerical scaling and warnings

Ridge minimizes squared residual **sum** plus `alpha * ||w||²`, with unpenalized intercept. The pinned [`_ridge.py` SVD implementation](https://github.com/scikit-learn/scikit-learn/blob/1.7.2/sklearn/linear_model/_ridge.py) uses singular-value factors `s / (s² + alpha)`. Its normal equations are `X' (prediction − target) + alpha*w = 0`, and intercept residual sum zero. The frozen normalized backward-error allowance is `64 * Number.EPSILON * (n + p + 1)`, justified before fitting in [METHODS.md](METHODS.md). It is not an iterative tolerance or a later adjustment.

The pinned [`_glm/glm.py`](https://github.com/scikit-learn/scikit-learn/blob/1.7.2/sklearn/linear_model/_glm/glm.py) passes Poisson alpha directly into [`LinearModelLoss`](https://github.com/scikit-learn/scikit-learn/blob/1.7.2/sklearn/linear_model/_linear_loss.py). The objective is mean half-deviance plus `alpha/2 * ||w||²`; gradient is `mean(X*(mu − y)) + alpha*w` and intercept `mean(mu − y)`. [`HalfPoissonLoss`](https://github.com/scikit-learn/scikit-learn/blob/1.7.2/sklearn/_loss/loss.py) omits the target-only constant `y*ln(y) − y`; the independently reported full half-deviance restores it. A TEST ONLY reference fixture verifies this exact constant and scaling against the pinned implementation. The maximum gradient must be finite and **≤1e-6**, without extra allowance.

Independent verification observed maximum Ridge normalized-residual/bound ratio **0.002226746**, maximum Poisson gradient **8.6312813e-7**, and maximum scalar prediction difference **2.1316282e-14**. All 55 fits passed; Poisson used 27–41 iterations, below 2,000. Predictions, objectives and coefficients were finite. One M1 and one M2 count mean fell outside their fold's training count range; none fell outside the source-valid 2–29 range. No mean was clipped or rounded for evaluation.

The pinned macOS/NumPy backend emitted **4,014 RuntimeWarnings** about divide-by-zero, overflow or invalid `matmul` despite finite verified outputs. Every warning retains its endpoint/fold/model/file/line in the saved report; unchanged reproduction passed. The [historical v0.1 TEST ONLY finite-matrix diagnostic](../dialogue-transfer/results/backend-diagnostic.json) and all original warnings remain untouched. This observation is not reclassified as a failed fit, nor is the backend root cause newly established here.

TEST ONLY diagnostics never enter real result artifacts. They cover known coupling, a finite independent process without an exact-zero-gain requirement, future mutations, preprocessing/group isolation, separate older fits, hand-computable losses/weighting, numerical failures, empty/insufficient states, and duplicate-column coefficient shifts that preserve predictions while violating the penalized stationarity condition.
