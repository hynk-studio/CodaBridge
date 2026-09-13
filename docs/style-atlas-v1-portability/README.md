# Atlas verifier portability correction

Correction to Draft [PR #16](https://github.com/hynk-studio/CodaBridge/pull/16), reviewed head `f110d216ed49d1637abe7a70d1d3047b2c88b3a8`, base `d50c3a7050f40823e56fd050f2a4e64277d8c96f`. Local and remote branch `codex/mvp-06-style-atlas` matched that head before editing. The PR records the new correction head. The pre-existing untracked PNG was untouched.

## Correction and regression coverage

The verifier compared independently summed click positions to the stored JavaScript accumulation with exact equality. On the actual CSV line 2 (`sw061b001_124`, 17 clicks), Python 3.12.14 produces `0.11893329999999999` at zero-based index 3, versus stored `0.1189333`; the largest absolute difference is `1.1102230246251565e-16`. [Actual interpreter measurements](summation.json). Before this correction, a fresh full verifier run passed on [Python 3.9.6](before-python-3.9.txt) and failed at that exact comparison on [Python 3.12.14](before-python-3.12.txt). These new runs are separate from the owner's focused Python 3.13.5 reproduction and the original implementation evidence.

Independent click, normalized-position and gap-share vectors now require exact dimensions and finite values before the unchanged relative/absolute `1e-10` tolerance. Calculations still start from original raw ICIs, independently of exported feature values. Stored parser-evidence copies (including their clicks), raw numeric text, source/ID bindings, membership, counts, and file bytes/hashes remain exact. No measurements are rounded or regenerated.

Review of the other exact comparisons found recomputed root contribution/largest-root shares mixed into structure equality. Those shares now use the same tolerance with exact root identities, counts, order and dimensions. Direct raw-ICI decimal parsing remains exact; it has no accumulation-order difference. Source record/parser copies are provenance comparisons, integer accounting sums are unaffected, and the exact TEST ONLY empty/singleton/tied-quantile checks remain unchanged. Other recomputed features, quantiles and distance values already used the stated tolerance.

For ranking, Python independently reconstructs cumulative clicks from raw ICIs and sums absolute normalized interval differences using JavaScript's existing left-to-right addition order. It sorts exact distance then source line; tolerance never creates ties. All 51 existing nearest-reference probes match on both executed interpreters. Public metric/comparator, producer sources, generator, manifest and method definitions are unchanged; the verifier is outside the producer list.

The 14 new stdlib regression tests cover actual line 2 under the current interpreter and a deterministic `math.fsum` alternate; a material `1e-6` perturbation; missing/extra and nonfinite actual/recomputed positions; feature-vector dimensions/finiteness; numerically identical but changed raw text; source identities and tiny changes to stored parser evidence; source/artifact hash rejection; exact root structure; and ordered accumulation/no fuzzy ranking ties. Mutations are TEST ONLY copies or mocks, never writes to artifacts.

## Executed checks

Environment: macOS **26.6.2 arm64**, Node **25.9.0**, npm **11.12.1**. No installation or interpreter upgrade.

- Original `python3`: **3.9.6**, invoked through `/usr/bin/python3`, reporting `/Library/Developer/CommandLineTools/usr/bin/python3`. [Exact version/build](python-3.9-environment.txt).
- Existing newer interpreter: **3.12.14**, `/Users/hynk/code/CodaBridge/analysis/dialogue-transfer/.venv/bin/python3`, backed by the existing Codex runtime Python. [Exact version/build](python-3.12-environment.txt). Only stdlib was used; no research script or fit ran.
- Python **3.13.5 was not executed** here. Its reported line-2 alternate result is covered deterministically; this is not a claim of a full 3.13.5 pass.

Every command below ran with `OPENAI_API_KEY` excluded. For the second interpreter, the regression, verify and check commands used the prefix `env -u OPENAI_API_KEY PATH="$PWD/analysis/dialogue-transfer/.venv/bin:$PATH"`; `atlas:verify` therefore spawned that `python3`. `atlas:check` is Node-only but was also run in both selected environments.

| Command after `env -u OPENAI_API_KEY` | Result / new logs |
| --- | --- |
| `python3 -m unittest discover -s analysis/style-atlas-v1 -p 'test_*.py' -v` | 14/14 on [3.9.6](python-3.9-regression.txt) and [3.12.14](python-3.12-regression.txt) |
| `npm run atlas:verify` | All 3,790 rows, 50 exclusions, 28 groups and 51 probes passed on [3.9.6](python-3.9-atlas-verify.txt) and [3.12.14](python-3.12-atlas-verify.txt) |
| `npm run atlas:check` | Exact serialized-byte, non-overwriting reproduction passed in [original](python-3.9-atlas-check.txt) and [newer](python-3.12-atlas-check.txt) environments |
| `node --experimental-strip-types --test tests/atlas.test.ts` | [10/10 passed](atlas-tests.txt) |
| `npm test` | [221/221 passed](unit-tests.txt), including the existing metadata current-tree guard |
| `npm run typecheck` | [Passed](typecheck.txt) |
| `npm run lint` | [Passed](lint.txt) |

[Exact commands and exit codes: Python](python-checks.json) · [Node](node-checks.json).

## Preserved bytes and limits

An exact Git-blob comparison against the reviewed head matched **all 565 other existing tracked files**; the only existing-file exceptions are the verifier and its README. This includes original sources, frozen research/audit material, all 34 original `docs/style-atlas-v1/` evidence files, all public assets, and all application source. [Preservation result and identities](preservation.json).

| Identity | Unchanged value |
| --- | --- |
| Source CSV | 500,380 bytes; SHA-256 `1856c8bf915cc5ae6f928aaa2036cbbc6ad8840bb6e4f6a96aaeb96953215da2` |
| Public Atlas and original browser-delivered Atlas | 4,769,558 bytes each; SHA-256 `7b01d8cb58c8c5443591a53713c680c775c4354dc5ce1403b7f481094f66656f` |
| Public summary | 48,349 bytes; SHA-256 `93f6cc199985454f943ece7e5b31d4739d22c9a8c014c67954dec6715d9dacdf` |
| Method/producer identity | `d46c01ab1a884d84c8f626ebd61a8dd7fd68863e266da3bc3640c7e5d039c366` |
| Atlas manifest file | 463 bytes; SHA-256 `683af3df21e50acf7e4bb72b112b6e50b865653dd9a23f5a35deb05bc6afcacf` |
| Method definition file | 3,180 bytes; SHA-256 `8e269715a1650abc232ed8027ffcb668d972b691d5e64f34e0af6f42c42bb75c` |

This directory contains new correction evidence; original execution/browser logs and their manifest remain byte-identical. The original source attribution and limitations remain applicable; no new recording, annotation or scientific finding is introduced.

Browser suites, production build, human listening, study fitting, full metadata replay and deployment were not run for this verifier-only correction. No credential inspection, paid model calls, inference enablement, source annotation edits, merge, force-push, Sites mutation or Packet/Exchange/encryption work occurred. PR #16 remains Draft for final review.
