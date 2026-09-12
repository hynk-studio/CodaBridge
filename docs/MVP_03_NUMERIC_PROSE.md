# Composer quantitative-prose correction

Correction of [review 5186977893](https://github.com/hynk-studio/CodaBridge/pull/5#pullrequestreview-5186977893), continuing Draft PR #5 on #3 on #2. Reviewed baseline: **`c3d55851662b641169c87df2eac43f000767f802`**. Tested implementation: **`5703cfd94905c97c10996936409d28a680b7e103`**. No credentials, provider probes or paid model requests were used.

## What changed

`server/composer.ts` no longer rejects investigation prose merely for containing digits. It removes the source/metric label-removal machinery and updates the investigation instructions to allow supported quantitative descriptions, prefer concise actual citations, forbid invented measurements/meanings/confidence, and distinguish generated prose from authoritative computed values. The HTTP(S) URL restriction remains; numbers and URLs are not silently stripped to produce a successful answer.

This is **Composer investigation only**. The legacy A/B prompt and validator are byte-unchanged. Typed edit operations, their schemas/numeric bounds and Apply/Undo behavior are preserved, as are draft/block/revision bindings, tool arguments, source resolution, ancestry/byte-duplicate exclusion, unequal-count handling, refusals, secret protection, byte/round/token/deadline limits and native Worker fetch/manual redirects. No UI, renderer, project format, source catalog or dependency changed.

Strict output fields, nonempty bounded text/arrays and actual structured `evidenceIds` remain required. These checks establish shape, bounds and reference resolution, **not factual correctness**. Incorrect quantities and unknown source names embedded in prose can pass with valid citations. Narrative never supplies trusted scores, selected sources, operations or source metadata. The existing UI labels interpretation as generated/unverified; exports separate generated content from deterministic evidence, and imported analysis is historical/unverified. No model judge, natural-language number parser or expanding label list replaces the digit check.

## Reproduced before correcting

Three constructed regression sentences were run through the **old actual Composer handler**, using the existing TEST ONLY provider transport and a duplicated/scaled dswp-1 block with its first copied gap set to 0.300 s:

| Constructed sentence | Old handler | Corrected handler |
| --- | --- | --- |
| Block 2 has a longer first gap than its seed. | 502 / `UNSUPPORTED_GENERATED_CONTENT` | Accepted, unchanged prose |
| The first gap is 0.300 seconds. | Same rejection | Accepted, unchanged prose |
| There are 2 eligible examples in the supplied catalog. | Same rejection | Accepted, unchanged prose |

Each case executed `find_creation_alternatives` and replayed its actual tool output before the fixture's final answer. The initial regression run had **0 passed / 3 failed** against the unchanged baseline implementation; a focused handler observation confirmed the fixed failure code. These examples are **not recovered live output**. The discarded text from historical Action 2 remains unknown.

## Regression evidence

- **Actual handler/tool loop:** the fixture's timing arrays equal the saved live project's timing, with fresh fixture IDs/revision/binding. The model-initiated tool targets the active edited copy; its returned evidence appears in `function_call_output` before the accepted cited final. A separate calculation directly from normalized marker intervals verifies candidate order and MAD values. The draft/catalog stay unchanged; the seed remains excluded and unequal counts have no distance.
- **Explicit factuality limitation:** deliberately incorrect prose claims a 99-second gap, 99 eligible examples, distance 0.9 and source `dswp-99`. It can pass with a real structured citation. Tests confirm no corresponding source is created, no proposal is produced, and computed facts, rankings, selection, draft and source credits remain unchanged in the UI and parsed project download. It is never labeled fact-verified. This is a limitation demonstration, not an example of a correct answer.
- **Preserved negatives:** invented structured references and forged authoritative fields reject separately from free text. Invalid/no-op/oversized operations, stale bindings, unknown tools/arguments, refusals, malformed output, invalid text/array bounds, URL prose, credential echoes, redirects and deadlines remain covered. The old bundled negative no longer calls digit rejection factual validation.
- **Native workerd:** the actual built artifact uses native fetch terminated by an in-process TEST ONLY outbound fixture. Supported and deliberately incorrect numeric prose pass the same real tool loop without changing computed output; URL prose still rejects. Existing native request/redirect, edit and legacy A/B artifact checks also pass. This makes no live compatibility claim.
- **Browser/export/stale response:** desktop and mobile Chromium create the equivalent timing through ordinary controls, render cited numeric prose with the existing unverified label, and deliver/parse/reopen project JSON with separate deterministic/generated fields. A second fixture holds the final quantitative response until the first gap changes to 0.350 s: the server accepts the old-bound result, but the UI discards it and exports the new draft with `generated: null`. Existing undo, stale selection/import, audio/storage, playback coordination and WAV/card/project journeys also pass.

New [TEST ONLY captures and delivered projects](mvp03/review-5186977893/manifest.json) are separate from all historical evidence:

| Fixture | Desktop | Mobile | Actual delivered project |
| --- | --- | --- | --- |
| Supported quantitative description | [UI](mvp03/review-5186977893/desktop-chromium-TEST-ONLY-supported.png) | [UI](mvp03/review-5186977893/mobile-chromium-TEST-ONLY-supported.png) | [JSON](mvp03/review-5186977893/desktop-chromium-TEST-ONLY-supported-project.json) |
| Deliberately incorrect prose; limitation demonstration | [UI](mvp03/review-5186977893/desktop-chromium-TEST-ONLY-incorrect-limitation.png) | [UI](mvp03/review-5186977893/mobile-chromium-TEST-ONLY-incorrect-limitation.png) | [JSON](mvp03/review-5186977893/desktop-chromium-TEST-ONLY-incorrect-limitation-project.json) |

## Commands and results

All execution commands excluded `OPENAI_API_KEY`; transports used only the existing dummy test binding. No application feature or default flag enables these fixtures.

| Actual command | Result |
| --- | --- |
| `env -u OPENAI_API_KEY node --experimental-strip-types --test --test-name-pattern='Composer quantitative prose' tests/composer-server.test.ts` before the correction | **3 failed**, reproducing the legitimate-content rejection. |
| `env -u OPENAI_API_KEY node --experimental-strip-types --test tests/composer.test.ts tests/composer-server.test.ts` after correction | **50 passed**. |
| `env -u OPENAI_API_KEY npm run typecheck` | Passed. |
| `env -u OPENAI_API_KEY npm test` | **161 passed**. |
| `env -u OPENAI_API_KEY npm run data:verify` | Four original byte hashes, PCM metadata, source-card hash and deterministic annotations reproduce. |
| `env -u OPENAI_API_KEY npm run lint` | Passed. |
| `env -u OPENAI_API_KEY npm run build` | Client and actual Worker build passed. |
| `env -u OPENAI_API_KEY npm run test:server-build` | **14 passed**, including native workerd. |
| `env -u OPENAI_API_KEY npx playwright test tests/browser/composer.spec.ts` | **38 passed**, desktop/mobile Chromium, zero retries. |
| Key-excluded parsed-download inspection; ordinary loopback status GET; `git diff --check` and protected-file comparison | Passed; ordinary status remains `unavailable / NOT_CONFIGURED`; both checked-in flags remain false. |

The existing test runner closed its test contexts/runtimes. The user's existing ordinary preview and untracked image were preserved. The production client and legacy A/B code are unchanged; no unrelated browser suite was rerun. Browser automation/mobile emulation are not human listening, physical-device or hosted coverage.

## History and remaining work

The [first live Composer report](trials/2026-09-12-live-composer/README.md), successful compound-edit receipt/proposal, delivered creation and all prior trial/TEST ONLY artifacts are unchanged. **Action 1 remains accepted; Action 2 remains failed.** This correction does not establish the discarded text's contents, correctness or hallucination status, and no test diagnoses its exact historical trigger.

The new prose policy is fixture-tested, not live-validated. Generated factuality, broader reliability, human listening/usability, scientific validity and hosted operation remain unverified. After review, a separately authorized live check should run **only the failed creation investigation**, opening the saved project and obtaining a fresh current binding; do not repeat the successful edit. No such request, merge, force-push, Site operation, account change or public enablement occurred here. Context / Dialogue Lab remains the planned follow-on outside this correction.
