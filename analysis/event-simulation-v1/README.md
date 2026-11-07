# Event simulation v1

U3 extends feature-level tests through the actual annotation parser, history eligibility, feature extraction, recording-root folds, v0.2 Ridge fitting/numerical diagnostics and conditional uncertainty owner. Historical studies and all their artifacts remain unchanged.

The [protocol](protocol.json) fixes three mechanisms, 100 primary seeds each and four observation variants on the first 25 paired seeds per mechanism: 600 realizations, 6,000 learned fits. Each has 10 synthetic roots, 30 A/B cycles per root. Latent truth stays in the generator; the model input projection includes only production features and duration targets. Directed A→B duration dependence has a 9-second emission-onset lag. Common environmental state affects both callers without a direct edge. Observed arrival jitter is explicitly separate from emission time. Missing clicks/codas and recording/segmentation censoring pass through production eligibility.

The heuristic flag is a strictly positive lower conditional-bootstrap endpoint. Independent scenarios calibrate its false-trigger rate under that generator; directed scenarios measure detection sensitivity. Common-driver flags can reflect real predictive information and are NOT mislabeled predictive false positives. Calling them direct influence would be unsupported attribution. No interval-coverage claim is made without a reference estimand. Report every outcome and failure, Wilson intervals for proportions and across-realization Monte Carlo error for mean gains. Paired variants are not independent replications.

    node --experimental-strip-types --test tests/event-simulation.test.ts
    python3 analysis/event-simulation-v1/run.py
    python3 analysis/event-simulation-v1/verify.py

`freeze.json` binds generator/protocol, production owners and runner before scoring; the runner refuses modified files. Production parser/cohort code is reused, never copied into a new acceptance policy. No empirical file is supplied to fitting. Runtime numerical package versions are recorded because these are new synthetic runs, not a replay of historical fitted artifacts.

## Cloud review and verification (2026-11-07)

Installed Python 3.12.14 and the exact `requirements.txt` numerical dependencies in an isolated environment. All three `simulation:test` cases and `simulation:verify` pass: 600 recorded runs, 6,000 fits, all 15 scenario aggregates, seed accounting, Wilson intervals and frozen input hashes. No generator/fitting change or reproducibility concern required rerunning the full simulation, so no new fits were executed.

The fetched Git history preserves the pre-score freeze at `a4723dab73239b7924ba6d06085fe022e1b6444a` (parent `c4934b6f0516945a359cdc80cac384c6a514ca51`) followed by the first results at `3fd0fd8a013c7e34abde443056f330b1c6f4f5f2`. The results file is absent from the freeze commit. All frozen file hashes match their recorded values. These are the verifiable remote identities for review.

`freeze.json` retains a recorded `parentCommit` of `d47286b9cb6c014aa27acf7406bba195548b1089`. The Cloud worker could not fetch it (`not our ref`) because it was a commit in the original Work checkout, rather than a published GitHub commit. Follow-up review recovered its exact 256-byte payload from that checkout and preserves it in [local-parent-commit.txt](local-parent-commit.txt). Recompute its identity with:

    git hash-object -t commit analysis/event-simulation-v1/local-parent-commit.txt

The output must be `d47286b9cb6c014aa27acf7406bba195548b1089`. Its tree is `91bed7a7472e512c161857e6919a2e458fdb4c24`, exactly the tree of the [published U2 parent c4934b6f](https://github.com/hynk-studio/CodaBridge/commit/c4934b6f0516945a359cdc80cac384c6a514ca51). This verifies identical source trees, not identical commit metadata or ancestry. The local commit remains unavailable as a remote ref; the archived payload resolves the source-tree provenance. The original freeze/result bytes and fitted results remain unchanged.
