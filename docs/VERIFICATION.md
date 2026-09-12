# MVP-01 verification

September 12, 2026. Branch `codex/mvp-01-listen-compare` continues Draft PR #2 from `1989afb670936374a790b20b24d3daa40cc93ec6`. The current full commit is recorded in the PR closeout. Parent issue #1 remains open.

| Command / check | Result |
| --- | --- |
| `npm ci` | Passed from the lockfile; 32 packages audited, zero reported vulnerabilities. |
| `npm run typecheck` | Passed with strict TypeScript over app, scripts, and tests. |
| `npm test` | 23 passed: synthetic arithmetic, normalization, offset/scale invariance, changed spacing, malformed/insufficient/unequal timings, current-selection export/snapshot/rejections, original assets, and mock WebMCP contract. |
| `npm run data:verify` | Original hashes, pinned source LFS metadata, PCM metadata, source-card hash, and annotations reproduce offline. |
| `npm run lint` | Passed (oxlint, no findings). |
| `npm run build` | Static production build passed. |
| Sites 0.1.66 `scripts/build-site.mjs` | Local build helper passed. No Site packaging/save/deploy. |
| `npx playwright install chromium` | Chrome for Testing/headless shell 153.0.8010.12, Chromium revision 1243. |
| `npm run test:browser` | 10 passed across desktop 1440×1000 and mobile 390×844; also 320 px / 200% text. |

Browser smoke uses the **production build** on port 4173, one worker, no retries. It verifies actual WAV loading/decoding, waveform presence, durations, initial 25% volume/original speed, playback time progression, exclusive play/pause/seek, keyboard activation/view selection, selection changes stopping audio and changing the metric, and downloaded JSON IDs/hash/timing/view/results. A 404, changed audio byte, and unavailable decoder are deliberate fault injections; their errors are not ordinary successful playback. Retry recovery and independent B playback are verified.

The ordinary journey observed no page errors or external-origin requests. This describes the tested journey, not a general security certification. The interval table intentionally scrolls horizontally on narrow screens and is keyboard-focusable; the page itself does not overflow at 320 px with enlarged text.

In-app Browser checks additionally observed the development page, source/annotation state, desktop/mobile layout and live `read_current_comparison_evidence` registration/schema/read-only annotations. Changing A to `dswp-2` and the view to normalized returned `dswp-2` / `dswp-2`, normalized view, distance zero. Invalid arguments were rejected. Raw CDP `Runtime.enable` succeeded. These are local browser checks, not a model invocation.

## Screenshots

Production smoke captures after playback and selection/view changes, with the original pair restored. B is paused because the test exercised playback. These are runtime screenshots, not mockups.

- [Desktop](screenshots/desktop-chromium.png), 1440×1000 viewport.
- [Mobile](screenshots/mobile-chromium.png), 390×844 viewport.

## Unrun and deferred

- No human listening, annotation review, or physical-device testing. Browser playback state is not proof a person heard audio.
- No Safari, Firefox, or physical iOS/Android coverage; device/speaker/headphone output uncharacterized.
- No annotation accuracy benchmark, biological coda-boundary confirmation, speaker identification, dialogue mapping, or scientific validation.
- No live Astra integration, application-model call, provider credential access, paid service, Site creation/activation/version save/deployment, Product Hunt submission, merge, or force-push.
- No hosted Sites runtime/access/audio verification. Static output shape and the local helper are the tested compatibility level.

Temporary previews/keep-awake processes are task-owned; cleanup and final Git/PR identity are reported in the closeout. Two examples are available, not the later 6–12-recording corpus or investigation flow.
