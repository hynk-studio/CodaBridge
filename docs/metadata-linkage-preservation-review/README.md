# Metadata preservation review correction

Bounded correction for Draft PR #14 on `codex/metadata-linkage-audit`. Original audit snapshot: **`821b0cd43d710c0f5f710cbece25257c5ae794fb`**, tree `2a1d21e193e0318c9b2c4d655cdeddf0ec411b38`; base: **`b3fb7daaa6d851baf35b8224648c25d743ea466f`**. The final correction head is recorded in the PR. These are newly executed review checks; evidence under `docs/metadata-linkage-v1/` remains the original audit evidence.

Ordinary metadata tests now check **121 frozen files**, selected from the unchanged recorded manifests: original/curated data, scientific JSON inputs and saved results, pinned requirements, public artifacts, historical research evidence/downloads, and metadata audit manifests/results/evidence. [Exact checked paths](current-frozen-artifacts.json). Expected hashes come from the original manifests and saved provenance, and the manifests themselves have pinned identities. They are not regenerated to accept a mutation. Application code, server code, CSS, tests and current status documents can evolve. Newly added files are not implicitly frozen.

The additive `audit:metadata:history` command checks the complete **462-file** manifest against **both recorded Git snapshots**, independently of the current application tree. Missing Git objects, missing paths, tampered bytes or a changed manifest fail. The original producer and strict working-tree preservation function remain available unchanged in the [documented pinned-checkout replay](../../analysis/metadata-linkage-v1/README.md#historical-replay-at-the-recorded-snapshot). That historical replay is not a validation command for arbitrary later application revisions.

The regression tests use owned disposable TEST ONLY directories. They append valid comments to copies of App, Composer, CSS and server files; the current guard still passes. Changed source, both cohort versions, fitted coefficients, public results, a historical browser download, audit results/protocol and manifests fail; a missing cohort also fails. Separate two-snapshot fixtures reject changed or missing historical application bytes in either base or audit, and a missing/truncated historical manifest. No owner file or frozen artifact is mutated by a test.

## Newly executed checks

Every npm command below was prefixed with `env -u OPENAI_API_KEY`. Current checkout, Node **25.9.0**, npm **11.12.1**, Python **3.9.6**, macOS **26.6.2 arm64**:

| Command | Result / new evidence |
| --- | --- |
| `npm run audit:metadata:test` | **12/12 passed** — [log](focused-tests.txt) |
| `npm test` | **211/211 passed** — [log](application-tests.txt) |
| `npm run typecheck` | Passed — [log](typecheck.txt) |
| `npm run lint` | Passed — [log](lint.txt) |
| `npm run build` | Client and Worker compatibility build passed — [log](build.txt) |
| `npm run audit:metadata:history` | **462 entries in each of two recorded snapshots** passed byte/SHA-256/Git-blob checks — [log](historical-preservation.txt) |
| `npm run audit:metadata:fetch` | All eight existing pinned cache files verified before copying — [log](cache-verification.txt) |

The final focused log follows a preliminary 12/12 pass; the application-edit fixture was then strengthened to edit copies of the existing files. The table reports the final corrected suite, also exercised by `npm test`.

The [pinned replay procedure](../../analysis/metadata-linkage-v1/README.md#historical-replay-at-the-recorded-snapshot) was newly executed in a detached checkout at **`821b0cd…`**, using a copy of the verified local cache. No dependencies were installed or datasets redownloaded. Commands inside that checkout:

| Command (same credential exclusion) | Result / new evidence |
| --- | --- |
| `npm run audit:metadata:fetch` | All eight copied inputs reverified — [log](replay-cache-verification.txt) |
| `npm run audit:metadata:test` | **10/10 original snapshot tests passed**, including its full 462-file check — [log](replay-focused-tests.txt) |
| `npm run audit:metadata:verify` | Independent full-file Decimal/CSV verification passed; 3,840 rows, 3,678 Maor-compatible, 1,103 CETI-compatible, 1,098 sequence-supported, 25 seed events — [log](replay-independent-verification.txt) |
| `npm run audit:metadata:reproduce` | Exact three-result reproduction passed; no outputs overwritten — [log](replay-reproduction.txt) |

The detached checkout remained clean after replay and was removed. [Recorded checkout/cache/environment context](replay-context.json). These newly executed original-snapshot checks are distinct from both the corrected 12-test suite and the historical logs saved during the first audit.

## Preservation and limits

[Review evidence manifest](manifest.json) binds the new checks/code and records byte identities of unchanged original audit files and evidence, compared directly with Git objects at the recorded audit snapshot. The matcher, original producer/verifier, protocol, retrieval manifest, complete preservation manifest, all three result JSONs and old evidence are byte-identical. A scoped `git diff --exit-code 821b0cd…` also passed for both original analysis directories, data/public assets, all application/server source, historical research evidence/downloads and original audit files. The new current guard separately verified every [listed frozen file](current-frozen-artifacts.json).

No matching rule, inferred coverage, date interpretation, scientific conclusion, fit, historical fold or public identity changed. No fitting, browser/native-Worker test-suite repetition, paid call, credential inspection, author contact, deployment, inference enablement, merge or Packet/Exchange/encryption work occurred. The compatibility build above is not browser, hosted-runtime or live-model evidence. Original v0.1/v0.2 numerical-verification logs remain historical; those unchanged suites were not rerun for this checker correction.
