# MVP-01: real audio, timing comparison, and a portable app build

Status: implementation brief, not completed application evidence.
Parent: https://github.com/hynk-studio/CodaBridge/issues/1
Prepared: 2026-09-12.

## Goal

Build the first usable CodaBridge slice: a visitor plays two real attributed recordings, compares their click timing, changes the selection or view, and downloads the actual measurements and provenance. Prepare for Sites without creating or activating a Site yet.

This PR is not the full release. A subsequent slice adds the actual bounded Astra investigation and another-example retrieval. Do not mark the parent launch issue complete or advertise working AI before that path has been implemented and tested.

## Authorized work now

Implement, install ordinary project-local dependencies, acquire a small amount of publicly reusable audio, run local tests/builds and a local browser preview, commit/push the assigned branch, and update its Draft PR. Keep work isolated from other repositories and services.

Do not publish a Site, provision hosting/storage, access private account data or credentials, run paid application-model calls, reserve/submit a contest entry, merge, or force-push. The user will activate Sites at the deployment stage. Missing hosting access is therefore not a blocker to this local slice.

## 1. App and visual direction

Use TypeScript and a small React-based app compatible with the intended Sites runtime. Prefer an available supported starter. Do not assume a regular long-running Node/Next.js server is automatically deployable. Record the starter/version, local build command, produced artifacts, and any known compatibility gap. If no supported starter is accessible, make the core portable and report the specific unverified hosting boundary; do not spend days rebuilding hosting infrastructure.

The first screen is a sound-comparison workspace, not a marketing page or chatbot shell. Use the hero question 'Can you hear the pattern?' with playback, two source cards, an absolute/normalized timing view, measured intervals, and an inspectable evidence drawer. Keep the two-dimensional design calm, readable, and distinctive. English-first, responsive, keyboard-operable, reduced-motion aware; no 3D scene, autoplay, decorative fake waveform, or nonworking primary button.

Target two clean real examples in this PR. The later release target remains 6–12 examples and three short demonstration paths. Data volume is not the goal.

## 2. Audio acquisition and annotations

Candidate source, checked at planning time:
https://huggingface.co/datasets/orrp/DSWP
https://huggingface.co/datasets/orrp/DSWP/raw/main/README.md
https://huggingface.co/datasets/orrp/DSWP/tree/main

The source card declares CC BY 4.0 and provides isolated audio without behavioral/per-file metadata. The file listing includes individual WAV assets. These observations identify an acquisition route, not verified selected recordings or annotations. Resolve and record an exact dataset revision before acquiring a small candidate subset; retain the paper/dataset credit requested by the source and a license link. No bulk archive is needed.

For each chosen recording, retain a stable source ID, exact source URL/revision, original filename, byte hash, clip duration/sample rate/channels, processing history, and click annotation method/version/status. Keep dataset credit distinct from a claim of affiliation or endorsement. Do not relicense third-party recordings under a project code license.

A clip can include more than one coda or extraneous transients. Select a clearly identified interval and preserve its offset in the original clip. Derive click candidates from the actual waveform; identify them as estimates unless supported by genuine source annotation/review. Manual corrections require an honest record of who/what performed them. Do not infer whale identities, reply relationships, or exact scientific coda classes from filenames.

Use a few regular static audio files if the build supports them; no storage service merely for two samples. Prefer no audio transformations beyond those needed for browser compatibility. Document resampling, trimming, channel mixing, gain, or format conversion. Keep original timing distinct from playback settings. A network or license failure is reported, not hidden behind synthesized clicks labeled as field recordings.

## 3. Deterministic timing contract

Represent click times as seconds relative to the audio clip. Keep annotation origin and selected coda interval explicit. Validate finite, nonnegative, strictly increasing times within the clip and require at least two clicks for interval comparison.

For click times t[0] ... t[n-1]:
- inter-click interval i = t[i+1] - t[i]
- click-span duration = t[n-1] - t[0]
- normalized interval i = interval[i] / click-span duration

Recording duration and click-span duration are different quantities and must have different labels. Normalized intervals sum to one within numerical tolerance. Normalization changes the comparison view, not the saved measurements or the playback rate.

For equal click counts, initially use a versioned mean absolute difference between normalized interval vectors. Display the metric name and value, with 'smaller means closer under this timing metric.' Do not convert it into a similarity percentage or a semantic confidence. Unequal counts or invalid timing return an explicit not-comparable result; no padding, silent truncation, invented alignment, or automatic category threshold.

Waveform/peak displays must derive from actual samples. Marker positions must align with actual clip offsets. New selection/view changes update measured results and exported evidence; never leave a previous selection's result presented as current.

## 4. Working interactions and evidence

Provide user-initiated play/pause with visible load/error state and safe volume. Handle unsupported decoding and missing assets without a broken page. Switching recordings stops or clearly separates the previous playback. Include source/annotation status in the UI rather than hiding it only in documentation.

A JSON evidence download is sufficient for this PR. Include a format version, selected source IDs/revisions/hashes, annotation provenance, original click times, computed intervals, metric/version/result or incompatibility reason, and known limits. No model/run ID is fabricated. Use the current selection, not a fixed example.

Reserve the future investigation surface with an explicit 'Astra investigation is not enabled in this build' state. A typed request/result boundary and mocked tests may be prepared, but no generic chatbot, pretend conversation, fabricated provider response, or live credential configuration is needed now. Listening/comparison must work without a model connection.

## 5. Verification

Add normal project scripts and a lockfile. Do not bring in a heavyweight certification framework.

Required unit cases: exact interval arithmetic; normalized sum; offset/scale invariance; a changed-spacing example; duplicate/unsorted/nonfinite/out-of-range times; fewer than two clicks; unequal click counts; and evidence export reflecting changed selection. Synthetic timings are appropriate for these tests and must be identified as test data.

Validate that curated assets are present, hashes and metadata match, attribution is present, and exported IDs resolve. Test actual browser audio loading/decoding/playback state, selection change, normalized view, keyboard interaction, evidence download, and missing-audio behavior. Use at least a desktop and narrow mobile viewport. Do not claim human listening or physical-device coverage based on headless automation.

Run typecheck, focused unit tests, the intended production build, and browser smoke checks. Fix ordinary in-scope failures and rerun affected checks. Report any unrun checks and the actual blocker; no paid model, public deployment, or account-specific Sites test is required to complete this local PR.

## 6. Deliverables and stop point

Update README with actual setup/run/test/build commands and truthful feature status. Add concise methods/data attribution and a build/compatibility note. Include screenshots from the real running app where the environment supports them; do not substitute a mockup for runtime evidence.

Update the existing Draft PR with implemented files, test commands/results, asset and annotation details, current screenshots, known gaps, and the source commit. Keep the PR Draft for review. Do not merge or start the research module.

Acceptance: a fresh checkout can install, build, and run the app; two real attributed recordings play; timing comparison and evidence export respond to real selection changes; invalid inputs fail clearly; and no model/deployment capability is falsely claimed. Sites hosting compatibility is recorded at its actually tested level, with account-specific save/deploy deferred.

## Reference and release context

Official Sites guide checked for this brief:
https://developers.openai.com/codex/sites
It separates local editing/testing, saving hosted versions, and production deployment; supported artifacts must be checked. Use the current guide at implementation, not a guessed deployment command or project identifier.

From the user's supplied contest guide: schedule the Product Hunt launch for September 18, 2026 (00:01 Pacific / 16:01 Asia/Seoul). Feature freeze target: September 16. Prepare the launch draft/reservation early. Tagline maximum 60 characters; product description maximum 260. These are release targets, not permission to submit or a guarantee of eligibility/prizes.

After this PR: bounded actual Astra investigation and example retrieval, then hosted verification when authorized, then expand/polish the curated experience and prepare launch media. Coda Dialogue Transfer, WhAM, accounts, arbitrary uploads, generated whale replies, and Augnes integration remain outside this PR.
