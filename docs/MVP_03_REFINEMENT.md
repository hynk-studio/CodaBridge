# MVP-03 editing and presentation correction

Correction of [review 5186480731](https://github.com/hynk-studio/CodaBridge/pull/5#pullrequestreview-5186480731), continuing Draft PR #5 on #3 on #2. Reviewed head: `38e473cf656f71e770d0de213f9f9dec6ae78dc5`. Executed source: **`0f9047aefd52e6619fd2f2c13a29140a7c064541`**. This report and its new media are separate from the original [MVP-03 verification](MVP_03_VERIFICATION.md); historical trials, recordings and artifacts remain unchanged.

## Working behavior

- **Useful Undo after typing.** `Composer.tsx` and `model.ts` coalesce continuous title, intention and block-meaning edits into one field/focus transaction. Each change still advances revision, persists current content and immediately invalidates pending results. Blur, timing actions, selection, import, save and Ask close the transaction. Undo/Redo restore content under new revisions; the limit remains forty snapshots. Text-event updates are flushed synchronously, and the latest history ref is written only by edit/reset actions. The rest of the component retains ordinary React scheduling.
- **Compound proposal labels.** `presentation.ts` resolves stable identities through the sequential batch, explicitly naming new blocks and their positions. Moves/removals retain understandable labels even when the block is absent from the original or final phrase. The TEST ONLY proposal now duplicates Block 1 into New block 2, then scales the new block. The preview leaves the saved draft untouched, Apply preserves the original block, and Undo restores the prior phrase.
- **Listening and making lead.** `App.tsx` offers listening/Composer navigation without creating/replacing blocks, playing sound or calling Astra. Legacy A/B JSON remains under “Recording-comparison evidence (A/B)”, explicitly distinct from project saving.
- **Hear the selected edit.** Selected-block synthetic audition uses the existing renderer, clock, playback owner and cleanup alongside seed and whole-phrase playback. Keyboard-accessible lengthen/shorten and first-gap controls precede collapsed exact-gap inputs. The factor hint reflects its actual input. Normalized plots are explicitly labeled; paired seed/block duration readouts and a deterministic change explanation precede MAD. Description comparisons use a `1e-12` tolerance for arithmetic noise; raw evidence retains the measurements. No similarity percentage or biological score was added.
- **A creation-first card.** `project.ts` and the on-screen card foreground title, intention and timing pattern. Synthetic/human-created identity, unknown whale meaning and full source attribution remain legible on the PNG. Detailed measurements, versions and limitations always accompany project downloads; generated evidence is optional. All three downloads snapshot the current draft and carry the same revision in their filenames. The image explicitly needs its WAV/project companions.

No server/provider contract, model, endpoint, redirect, prompt, schema, deadline, token/tool limit, recording, framework or dependency changed. The new presentation helper is local deterministic code. Existing live flags remain disabled. Dialogue Lab remains the planned follow-on.

## Verification actually run

Every build/test command excluded `OPENAI_API_KEY`; no real credential was accessed or supplied. Runtime: macOS arm64, Node 25.9.0, Playwright 1.63.0, Wrangler 4.131.1, Miniflare 5.20260911.0-alpha, workerd 1.20260911.1.

| Command | Actual result |
| --- | --- |
| `env -u OPENAI_API_KEY npm run typecheck` | Passed |
| `env -u OPENAI_API_KEY node --experimental-strip-types --test tests/composer.test.ts tests/composer-server.test.ts` | 43 passed |
| `env -u OPENAI_API_KEY npm test` | 154 passed, zero failures/skips |
| `env -u OPENAI_API_KEY npm run data:verify` | Four original hashes, PCM metadata, source-card hash and estimated annotations reproduce |
| `env -u OPENAI_API_KEY npm run lint` | Passed |
| `env -u OPENAI_API_KEY npm run build` | Client + Worker ESM passed; JS 303.33 kB / 93.56 kB gzip, Worker 59.84 kB |
| `env -u OPENAI_API_KEY npm run test:server-build` | 13 passed, including native-workerd fetch/Composer tool flow and redirects never followed |
| `env -u OPENAI_API_KEY npx playwright test tests/browser/composer.spec.ts --grep 'sequential'` | All six rapid typing cases passed |
| `env -u OPENAI_API_KEY npm run test:browser` | 54 passed, one worker, no retries; desktop/mobile Chromium plus 320 px / 200% text |
| `git diff --check` | Passed |

Each of the three text fields receives **63 sequential keystrokes**, not `fill()` alone, after a timing edit. Cancellation is checked after the first character while the field remains focused. The intention case holds an investigation response; title/meaning hold edit proposals. After typing/blur, the late results are rejected; Undo removes the text transaction then the preceding timing edit, Redo restores both, and reload proves persistence. Existing stale import/block/field selection tests remain.

The initial compound-demo locator used exact label text around a controlled textarea and timed out; using its actual accessible textbox name fixed the test. Rapid-input checks also exposed a dropped space during pending-result work. Removing the render-time history-ref assignment alone did not resolve every mobile case; the final event-scoped synchronous commit passed the original zero-delay key streams without relaxing content/revision assertions or adding typing delays. Temporary diagnostic instrumentation was removed. React documents the scheduling/performance tradeoff of [synchronous flushing](https://react.dev/reference/react-dom/flushSync); its use here is confined to these bounded text events, not model/audio or general render logic.

The compound fixture executes the production Composer handler/validation with a test-only transport. The edit takes one fixture response; the subsequent investigation takes two, including actual `find_creation_alternatives` dispatch and a tool result before accepted interpretation. Intermediate text/opaque reasoning stay out of exported accepted results. Native Worker checks use in-process test-only outbound interception, not an external provider. No fixture success is a live-compatibility claim.

## Before / after running product

These are captures from running applications, not generated mockups. “Before” links retain the original reviewed files. New artifacts are in their own directory; normal browser reruns now write to ignored `test-results/composer-review` instead of overwriting historical media.

| View | Reviewed before | Corrected after |
| --- | --- | --- |
| Desktop entry | [Before](mvp03/evidence/desktop-chromium-listen.png) | [After](mvp03/review-5186480731/desktop-chromium-listen.png) |
| Mobile entry | [Before](mvp03/evidence/mobile-chromium-listen.png) | [After](mvp03/review-5186480731/mobile-chromium-listen.png) |
| Editing/comparison | [Before](mvp03/evidence/desktop-chromium-workbench.png) | [After](mvp03/review-5186480731/desktop-chromium-workbench.png) |
| Downloaded card | [Before](mvp03/evidence/creation-card.png) | [After](mvp03/review-5186480731/creation-card.png) |

[Full local Composer](mvp03/review-5186480731/desktop-chromium-local-composer.png) · [Mobile workbench](mvp03/review-5186480731/mobile-chromium-workbench.png) · [TEST ONLY compound proposal](mvp03/review-5186480731/desktop-chromium-TEST-ONLY-proposal.png) · [TEST ONLY accepted retrieval evidence](mvp03/review-5186480731/TEST-ONLY-composer-result.json).

The [new 16.64-second running-app capture](mvp03/review-5186480731/TEST-ONLY-running-app.webm) is **TEST ONLY**, visibly labeled throughout: field listening → create → natural-language duplicate/scale proposal → synthetic preview → Apply → Undo/Redo → exact-gap edit → model-requested retrieval → project download → real example → card. It is a silent VP8 video at 1280×900. Capture pauses only pace the demonstration; they do not change application deadlines. The in-app Browser also displayed the updated normal loopback entry; no raw-CDP proof or human listening is claimed.

## Downloaded files and remaining boundaries

Actual browser-delivered [WAV](mvp03/review-5186480731/creation-synthetic-timing.wav), [PNG](mvp03/review-5186480731/creation-card.png) and [project JSON](mvp03/review-5186480731/creation-project.json) all represent **Room to breathe, revision 8**, with two blocks. These are fresh deliveries from the corrected app, not renamed earlier artifacts. The WAV decodes to mono 48 kHz, 4.293166666666667 seconds, peak 0.046357616782188416; its schedule and metadata match the project. Canvas draw assertions and visual inspection confirm title, intention, personal label, synthetic identity, unknown whale meaning, attribution, revision and non-playable-image labeling. The project parses and reopens with exact timing, active block, codebook and labels under a new local revision, without autoplay or a model call. Detailed deterministic evidence is present with the generated-evidence option unchecked.

[Download observations](mvp03/review-5186480731/download-verification.json) · [Artifact hashes and execution manifest](mvp03/review-5186480731/manifest.json).

Playback checks observe real AudioBuffer scheduling for seed, selected block and phrase; pause/resume, editing/selection stops, repeated stop and field/synthetic ownership work. Storage/decoder faults leave local editing/export usable. These are automation observations, not a verdict on perceived sound or physical loudness.

**No real credentials, paid model calls, repeated live trials, merge, force-push, Sites operations or public enablement occurred.** Normal loopback status was rechecked as HTTP 200 with `unavailable / NOT_CONFIGURED`, and both checked-in access flags remain false. Test runtimes/contexts close; the bounded keep-awake lease and transient diagnostics were removed. The ordinary key-excluded loopback preview remains available. Unrelated pre-existing files were preserved.

Remaining validation: separately authorized live Composer editing/retrieval, human listening and marker review, Safari/Firefox and physical-device behavior, hosted audio/download delivery, and a separate public access/shared-budget decision. Previous A/B live success does not certify Composer; operator flags are not authentication or a spending cap. No new datasets, WhAM, account stack, Dialogue Lab implementation or policy framework is included.
