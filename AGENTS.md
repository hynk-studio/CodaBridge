# Working on CodaBridge

## Read first

Read README.md, issues #1 and #4, and docs/MVP_03.md before Composer work. docs/MVP_01.md and docs/MVP_02.md describe the preserved foundations. Work only in hynk-studio/CodaBridge. GitHub is the source of truth.

For Context Lab work, also read issues #6/#7/#10/#12, docs/MVP_04.md, docs/MVP_05.md, docs/MVP_05B.md and docs/CONTEXT_DATA.md. The descriptive duration control and the bounded offline Dialogue Transfer prediction are separate analyses.

For Timing / Style Atlas work, read issue #15, docs/MVP_06.md and analysis/style-atlas-v1/README.md. This full-source descriptive reference and read-only Composer comparison do not authorize new fitting or atlas-to-Composer imports.

## Working style

- ChatGPT plans and reviews; Codex implements and tests. Continue the assigned implementation branch/PR rather than creating a competing version.
- After the one-time README bootstrap, use PRs for source changes. Do not merge, force-push, deploy, or modify unrelated projects unless explicitly instructed.
- Make ordinary reversible implementation choices without repeatedly asking for permission. Report concrete blockers with the smallest next action. Fix local build/test failures within the assigned scope; do not import Augnes-style approval machinery, runtime qualification, or Canonical verification.
- Keep documentation short and executable behavior central. Use English for code, public UI, repository documentation, and implementation reports.

## Data and scientific honesty

- Attribute every real recording and retain its source revision/file ID, license, transformations, and byte checksum. Verify actual selected files; a dataset card alone does not identify a particular coda or click annotation.
- Keep source annotations, machine estimates, and later corrections distinct. Do not claim human review that did not occur.
- Do not associate clips with speaker identities, dialogue rows, behavior, or meanings without source evidence. Synthetic tests/sonification must be labeled and cannot substitute for real-audio acceptance.
- Preserve original measurements. Acoustic distance is a named descriptive metric, not translation accuracy, a shared-meaning probability, or a biological category.
- Future model output must cite existing evidence and cannot overwrite measurements. Never present a fixture, template, or cached answer as a live Astra result.
- Composer creations are separate human-authored timing records, never observed catalog recordings. Preserve original offsets/provenance; personal codebook meaning is not animal semantics. Use the centralized deterministic operations, bounds and renderer for UI, provider proposals and exports. Imports are untrusted; saved analysis never establishes live execution.
- Context annotations retain their archived CC BY 4.0 record, source lines, true ICIs and local caller/REC scope. Do not execute downloaded notebooks or unpickle data. Freeze segment selection before inspecting experimental effect; do not clip long codas to Composer limits. Control offsets reassign duration comparisons over fixed original pairs, never observed timeline/audio. No p-values, causality, independence or animal-meaning claims from this control.
- Dialogue Transfer uses the committed offline protocol/cohort/splits in `analysis/dialogue-transfer/`. Preserve its pre-score freeze, common group-held-out cohort, train-only preprocessing, strict completion cutoff, separate older-history fit and all result signs. Browser predictions are precomputed; Reveal is pedagogical, not secrecy. No online fitting service or expanded Astra contract is implied.
- The executed v0.2 follow-up is separately frozen under `analysis/dialogue-transfer-v02/`. Preserve both versions, their result signs, source/group limitations and script meanings. Its continuous predictions are exploratory estimates, not validated whale-response rules or authority to fit further studies or implement Packet/Exchange/encryption.

## Delivery and safety

- Sites is a proposed target. Its creation, activation, saved hosted versions, publication, and paid application-model calls are deferred until explicitly authorized. Local development and compatibility builds are in scope.
- Do not create fake Sites identifiers or copy another site's hosting linkage. Preserve a genuine linkage when one exists.
- Keep credentials out of prompts, source, browser bundles, logs, reports, and screenshots. Do not inspect unrelated credential stores. Tests must not call a paid model.
- Prefer browser computation, a small server boundary, and static curated assets. No accounts, database, object storage, GPU service, or external analytics unless the assigned task demonstrates a need.
- Keep root project licensing unchanged unless the owner chooses one. Preserve third-party license/attribution notices.

## Verification and reporting

Use the app's normal typecheck, focused unit tests, production build, and browser smoke checks. Record actual commands/results and relevant environment versions. Distinguish local build, browser automation, human listening, Sites build, deployment, and live-model evidence; none implies the others. Report unrun checks and remaining gaps plainly.

A PR closeout should say what works, which recordings and annotations were used, what was tested, what remains, and whether any deployment or model request occurred. No fabricated pass status, uptime, cost, citations, or benchmark result.
