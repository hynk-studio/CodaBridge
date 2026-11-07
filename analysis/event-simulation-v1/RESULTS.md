# Event simulation v1 — results

Synthetic event study only. The protocol and code were frozen before scoring (local `356b4bf`; remote equivalent `a4723dab73239b7924ba6d06085fe022e1b6444a`). The local parent commit in the freeze has the same tree as remote U2 commit `c4934b6f0516945a359cdc80cac384c6a514ca51`. All 600 realizations / 6,000 learned fits completed; no failed fits or warnings. Maximum numerical residual/bound ratio: 0.00166804.

| Mechanism | Observation | Runs | Mean gain (squared log units) | Monte Carlo SE | Flags | Wilson 95% |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| independent | clean | 100 | -0.00004610 | 0.00000419 | 0/100 | 0.0–3.7% |
| independent | missed-clicks | 25 | -0.00004410 | 0.00001020 | 0/25 | 0.0–13.3% |
| independent | missed-codas | 25 | -0.00008171 | 0.00001561 | 0/25 | 0.0–13.3% |
| independent | arrival-jitter | 25 | -0.00006196 | 0.00000964 | 0/25 | 0.0–13.3% |
| independent | boundaries | 25 | -0.00004724 | 0.00001716 | 1/25 | 0.7–19.5% |
| common-driver | clean | 100 | +0.00018202 | 0.00001263 | 30/100 | 21.9–39.6% |
| common-driver | missed-clicks | 25 | +0.00017576 | 0.00003290 | 7/25 | 14.3–47.6% |
| common-driver | missed-codas | 25 | +0.00005957 | 0.00003490 | 3/25 | 4.2–30.0% |
| common-driver | arrival-jitter | 25 | +0.00015767 | 0.00002763 | 6/25 | 11.5–43.4% |
| common-driver | boundaries | 25 | +0.00015210 | 0.00003481 | 5/25 | 8.9–39.1% |
| directed | clean | 100 | +0.00058168 | 0.00001615 | 98/100 | 93.0–99.4% |
| directed | missed-clicks | 25 | +0.00055778 | 0.00003124 | 25/25 | 86.7–100.0% |
| directed | missed-codas | 25 | +0.00047924 | 0.00003076 | 21/25 | 65.3–93.6% |
| directed | arrival-jitter | 25 | +0.00054279 | 0.00003108 | 24/25 | 80.5–99.3% |
| directed | boundaries | 25 | +0.00054591 | 0.00003766 | 22/25 | 70.0–95.8% |

The clean independent process triggers 0/100 times (upper Wilson bound 3.7%); this does not establish a zero false-positive rate. The common-driver process triggers 30/100 without any direct coupling. Its positive predictive gain is genuine under the mechanism, while interpreting the flag as direct influence would be unsupported. The directed process triggers 98/100 for this selected effect and lag; it is not universal power.

Observation loss and boundaries change support and sensitivity. Each variant uses the same first 25 seeds, so these are paired comparisons with wide Monte Carlo intervals, not extra independent replications. No interval coverage is estimated: the conditional interval is a tested heuristic, not an assumed calibrated significance test.

Production parsing, strict completion cutoffs, grouping and source projection are exercised. Additional tests cover invalid-row barriers and future-target mutation. Independent Python verification recomputes all scenario means, Monte Carlo errors, Wilson intervals, seed budgets and frozen file hashes. Three focused tests, typecheck and lint passed. Results and method live in their own namespace; no old empirical input, fold or result changed. No model API or deployment was used.
