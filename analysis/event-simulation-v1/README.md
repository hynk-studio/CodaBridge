# Event simulation v1

U3 extends feature-level tests through the actual annotation parser, history eligibility, feature extraction, recording-root folds, v0.2 Ridge fitting/numerical diagnostics and conditional uncertainty owner. Historical studies and all their artifacts remain unchanged.

The [protocol](protocol.json) fixes three mechanisms, 100 primary seeds each and four observation variants on the first 25 paired seeds per mechanism: 600 realizations, 6,000 learned fits. Each has 10 synthetic roots, 30 A/B cycles per root. Latent truth stays in the generator; the model input projection includes only production features and duration targets. Directed A→B duration dependence has a 9-second emission-onset lag. Common environmental state affects both callers without a direct edge. Observed arrival jitter is explicitly separate from emission time. Missing clicks/codas and recording/segmentation censoring pass through production eligibility.

The heuristic flag is a strictly positive lower conditional-bootstrap endpoint. Independent scenarios calibrate its false-trigger rate under that generator; directed scenarios measure detection sensitivity. Common-driver flags can reflect real predictive information and are NOT mislabeled predictive false positives. Calling them direct influence would be unsupported attribution. No interval-coverage claim is made without a reference estimand. Report every outcome and failure, Wilson intervals for proportions and across-realization Monte Carlo error for mean gains. Paired variants are not independent replications.

    node --experimental-strip-types --test tests/event-simulation.test.ts
    python3 analysis/event-simulation-v1/run.py
    python3 analysis/event-simulation-v1/verify.py

`freeze.json` binds generator/protocol, production owners and runner before scoring; the runner refuses modified files. Production parser/cohort code is reused, never copied into a new acceptance policy. No empirical file is supplied to fitting. Runtime numerical package versions are recorded because these are new synthetic runs, not a replay of historical fitted artifacts.
