# Metadata linkage audit v1

Executed read-only audit of complete pinned metadata files against CodaBridge's unchanged original annotations and research cohorts. [Findings, coverage and decision note](../../docs/METADATA_LINKAGE_AUDIT.md). No estimator, provider, product identity or historical study is changed.

## Current development checks

From the current repository root, using Node 22.18+:

```sh
env -u OPENAI_API_KEY npm run audit:metadata:test
env -u OPENAI_API_KEY npm run audit:metadata:history
```

The focused tests, also included in ordinary `npm test`, use the additive [preservation checker](preservation-checks.ts). Its current-tree guard checks recorded source/curated data, both studies' JSON inputs/protocols/splits/results and pinned requirements, public audio/predictions, historical research evidence/downloads, and this audit's manifests/results/evidence. It selects only existing entries from the original manifests and retains their expected hashes. The manifests themselves are checked against their recorded snapshot identities; removing entries or rewriting expected hashes fails. Application/server code, CSS, tests, tooling and current status documents are outside this guard. New files are not automatically frozen. These tests need neither Git history nor the external cache.

`audit:metadata:history` is a separate read-only check of **all 462 files** in Git objects at both base `b3fb7daaa6d851baf35b8224648c25d743ea466f` and recorded audit snapshot `821b0cd43d710c0f5f710cbece25257c5ae794fb`. It validates the complete manifest's pinned bytes and every entry's byte count, SHA-256 and Git blob in each snapshot. Missing history or mismatched bytes fails; it never substitutes current files. Both commits must be available locally. This preserves the historical claim that the audit changed no pre-existing application code without prohibiting later application development. [Correction checks and evidence](../../docs/metadata-linkage-preservation-review/README.md).

## Historical replay at the recorded snapshot

The original `run.ts`, `io.ts::checkPreservation`, `verify.py`, matcher, protocol and saved provenance remain unchanged. **Their strict `audit:metadata:reproduce` and `audit:metadata:verify` commands are historical replay commands, not validators for arbitrary later application revisions.** Run them in the recorded checkout below, with Node 22.18+ and Python 3.9+ (stdlib only). No npm install or Python packages are needed for these audit commands.

```sh
# Start in CodaBridge. Keep this separate from the current development checkout.
audit_replay="$(mktemp -d "${TMPDIR:-/tmp}/codabridge-metadata-replay.XXXXXX")"
git worktree add --detach "$audit_replay" 821b0cd43d710c0f5f710cbece25257c5ae794fb

# Optional: reuse the existing local cache after verifying its pinned identities.
# Omit these three lines to let fetch retrieve the pins inside the replay checkout.
env -u OPENAI_API_KEY npm run audit:metadata:fetch
mkdir -p "$audit_replay/data/raw"
cp -R data/raw/metadata-linkage "$audit_replay/data/raw/"

(
  set -e
  cd "$audit_replay"
  test "$(git rev-parse HEAD)" = 821b0cd43d710c0f5f710cbece25257c5ae794fb
  env -u OPENAI_API_KEY npm run audit:metadata:fetch
  env -u OPENAI_API_KEY npm run audit:metadata:test
  env -u OPENAI_API_KEY npm run audit:metadata:verify
  env -u OPENAI_API_KEY npm run audit:metadata:reproduce
)
# After successful replay, remove only this disposable checkout.
git worktree remove "$audit_replay"
```

`fetch` retrieves only the eight allowlisted public files in [retrieval-manifest.json](retrieval-manifest.json). Existing cached files are verified, never silently replaced, including in the replay checkout. Every file must match its expected byte count, SHA-256 and Git blob SHA-1. Data and notebook bytes stay under **gitignored `data/raw/metadata-linkage/`**. The notebook was parsed as JSON for source-cell text inspection only; it is never executed, imported, or used to load a pickle. Tests and the matcher do not execute downloaded code.

`audit:metadata:run` was the actual audit generation command; it refuses to overwrite saved results. In the pinned checkout, `reproduce` rebuilds every result in memory, verifies exact serialized equality, and writes nothing. `verify` independently reads the raw files using Python's CSV parser and Decimal arithmetic; it imports no TypeScript matcher and runs no statistical fitting. Both retain the original full 462-file working-tree check, which is appropriate **only in that historical replay context**. Missing or changed cached/source bytes, mapping/precision disagreement, changed producer provenance, or changed historical inputs fails explicitly; no completed report is substituted. The pinned focused tests are the original 10 tests, not the corrected current test suite.

The analysis uses no prediction scores. Only the preserved core/coverage source bindings and fold assignments are read to describe coverage and potential dependence. Original `analysis:*` and `analysis:v02:*` command meanings are unchanged. Do not run either study's fitting/reproduction runner for this audit.

## Owners and comparison rules

- [protocol.json](protocol.json) states the executable audit's scope and interpretation. [precision.ts](precision.ts) uses exact base-ten arithmetic, including nanosecond civil datetime fractions. Its comparison allowance is the sum of the written decimal half units; structural zero padding is exact. The tag-on time is the supplied coordinate origin. No timezone, clock correction, optimized offset, broad duration-only search or fitted tolerance is introduced.
- `src/lab/parse.ts::parseAnnotations` remains the original validation owner. [csv.ts](csv.ts) handles external CSV quoting and physical source lines; it is not a second annotation validator. The independent verifier consumes the preserved original validated intermediate rather than inventing Python validation rules.
- [maor.ts](maor.ts) enumerates all onset-compatible candidates within each existing six-character root. It records exact REC versus changed file/fragment names, caller equality, every shared ICI, whole counts/durations, extra ICIs, and collisions. A unique compatible fingerprint requires the count and all 28 shared ICI columns, with zero ICI29–40; declared-duration disagreements remain separately visible. No shortest-distance winner or assumed preservation of caller labels is used.
- [ceti.ts](ceti.ts) joins `codanum` and `prevcodanum` using the CETI README's definitions. It preserves multiple timing observations, missing fields, duplicate/conflicting IDs and last-click counts. It compares tag-relative onset, whole ICI duration, declared duration and available counts across **all** original rows. Explicit ordered coarticulation pairs supply additional within-REC/local-caller corroboration. A single timing-compatible event and a sequence-supported event remain distinct. Spectral string length is a separate diagnostic, never a fabricated last-click position.
- A Maor `codaNUM2018` / CETI `codanum` bridge is inferred, not a documented namespace contract. All overlapping IDs are checked for duration/count/name/focal/onset agreement; the twelve count conflicts are retained. Bridge-only metadata is not counted as direct timed CETI linkage.
- [dates.ts](dates.ts) retains both valid numeric day/month orders. Textual `מרץ` and `מאי` mean March and May; no ambiguous numeric date is selected to force a join. The civil arithmetic's internal Gregorian ordinal is not an asserted UTC timezone. Root/date associations remain candidate context, not encounter IDs.

Names and units never propagate from a matched event to a whole root or local caller. The combined coverage counts use either a sequence-supported named CETI candidate or a unique compatible Maor row with known-looking focal Name/IDN. This second tier is explicitly inferential: no Maor field dictionary was found. A named tag wearer cannot identify nonfocal producers. Strict CETI-only counts are also retained. “Fully identified candidate” means all distinct used events have candidate producers; it does not mean an official crosswalk or verified dyad.

## Saved outputs

- [candidate-mapping.json](results/candidate-mapping.json): all 3,840 original row records, every candidate and measurement comparison, explicit exclusions, CETI source-line bindings, all namespace bridges and sequence checks, unresolved external IDs, and complete 25-event seed reproduction.
- [coverage.json](results/coverage.json): raw/validated coverage; all 723/1,017 examples; current/target/previous/recent/older and all completed-history roles; occurrence and distinct-event denominators; partial/full/unknown states; every root and dependence flag. The coverage cohort does not use older donors; its older-role count is zero.
- [report.json](results/report.json): compact counts, conflicts, missing metadata, calendar ambiguity, same-event versus unestablished-new-sample accounting, source/cohort/producer hashes and preservation identity.
- [preservation-manifest.json](preservation-manifest.json): the unchanged historical inventory of **462** pre-existing tracked files from base `b3fb7daaa6d851baf35b8224648c25d743ea466f`, excluding the then-current README and package script list. The full inventory, including application code, is checked against the recorded base/audit snapshots. The current development guard checks only its frozen data and research evidence subset, plus this audit's saved artifacts.

These are derived audit mappings, not redistribution of the full external datasets. Read rights notes in the findings before assuming reuse permission. New verification logs live under `docs/metadata-linkage-v1/`; old trial logs and browser-delivered research JSON are unchanged.
