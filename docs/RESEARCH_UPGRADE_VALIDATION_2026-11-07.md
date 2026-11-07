# Research-upgrade Cloud validation — 2026-11-07

Continued PRs [#31](https://github.com/hynk-studio/CodaBridge/pull/31), [#32](https://github.com/hynk-studio/CodaBridge/pull/32), [#33](https://github.com/hynk-studio/CodaBridge/pull/33) and [#34](https://github.com/hynk-studio/CodaBridge/pull/34) from their existing heads. GitHub pages confirmed all four were Draft and stacked in that order. No replacement PR or force-push was used. Changes to U1/U2 were committed on their owning branches and propagated downstream with merge commits.

## Changes and review

- **U1:** exact-label browser locators missed controls whose labels also contain option text; use the controls' accessible combobox names. Require the pinned CSVs explicitly instead of silently skipping acceptance. Downloads retain all joined rows and now also record the active filters and filtered summary. Added full provenance/missingness checks, equal-size corruption and delayed-import replacement/navigation checks.
- **Frozen v0.2 replay:** reproduced 27 core and 39 coverage differences, exclusively in `targets.duration`/`targets.gap`, maximum absolute difference 2.22e-16. Permit `Number.EPSILON * max(1, abs(expected))` only there. All remaining keys, values, array order and split manifests remain strict. Mutation checks reject 1e-12 log changes, NaN/Infinity, changed IDs/groups/counts/features/source values and changed rows. No calculation, frozen input, partition or result changed.
- **U2:** fixed the exact-label test locator and added corrupt-report and stale-load tests. Actual downloaded reports are checked in full against the independently verified artifact plus current recording/rate selection. Reviewed DSP, source bindings and separate ranking logic; no numerical implementation change was needed.
- **U3:** independent verification checks all 600 saved realizations, 6,000 fits, 15 scenario aggregates, seed budgets, intervals and frozen hashes. Reviewed event generation, real parser/eligibility projection and fitting boundaries. No generator/fitting change warranted another full run. The actual freeze `a4723da` precedes result commit `3fd0fd8`; the freeze's recorded parent `d47286b…` cannot be fetched and remains an explicitly unresolved historical reference in the package README.
- **U4:** reviewed tool dispatch, input/evidence binding, score validation and the rubric. Ten fixtures reproduce exactly; adversarial value/citation/binding/cancellation tests pass. No model-quality or audio-perception claim is supported by fixture execution. Actual model runs and audio inputs remain zero.

## Environment and commands

Node 24.22.1, npm 11.9.0, Python 3.12.14, Playwright 1.63.0 and installed Chromium 156.0.8078.79. `npm ci` used the unchanged lockfile. Python packages were installed in an isolated venv using `analysis/event-simulation-v1/requirements.txt` (NumPy 2.3.5, SciPy 1.17.0, scikit-learn 1.8.0, threadpoolctl 3.6.0); `pip check` passed.

In this Cloud workspace, export these settings from `/workspace/CodaBridge`:

```sh
export npm_config_cache=/workspace/.npm-cache
export XDG_CONFIG_HOME=/workspace/.config
export PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
export PATH=/workspace/codabridge-validation/venv/bin:$PATH
```

Playwright's bundled Chromium 153 download receives a destination-policy 403. The explicit executable override uses the installed system browser; it preserves the default bundled-browser behavior when unset. Existing video regression tests use the installed FFmpeg mapped into the workspace Playwright cache at `ffmpeg-1011/ffmpeg-linux`. No TLS/checksum verification or execution sandbox control was disabled.

| Executed command | Result |
| --- | --- |
| `npm ci` | Passed; dependency declarations/lockfile unchanged |
| `npm run typecheck`, `npm run lint`, `npm run build` | Passed, including client and Worker builds |
| `env -u OPENAI_API_KEY npm test` | 294 passed, 0 failed/skipped |
| `env -u OPENAI_API_KEY npm run test:server-build` | 15 passed, 0 failed/skipped |
| `npm run data:verify` | Four original byte bindings and annotation source reproduced |
| `npm run audit:metadata:history` | Passed; 462 preserved files, two snapshots |
| `NODE_USE_ENV_PROXY=1 npm run spectral:fetch` | Both pinned files retrieved/verified through the inherited proxy |
| `npm run spectral:check`, `npm run spectral:verify` | 1,375 one-to-one IDs, zero shared-field disagreements |
| `npm run spectrum:check`, `npm run spectrum:verify` | Unchanged report reproduced; 75 windows and all rankings independently verified |
| `npm run simulation:test`, `npm run simulation:verify` | Three tests passed; saved 600-run study and frozen hashes verified |
| `npm run assistant:check`, `npm run assistant:test` | Ten fixture executions reproduced; three tests passed |
| `env -u OPENAI_API_KEY npx playwright test tests/browser/spectral-context.spec.ts tests/browser/native-spectrum.spec.ts` | 16 passed across desktop/mobile |
| Context Lab and Composer browser regression files | 58 passed across desktop/mobile |

The U1 branch independently passed 283 unit and eight browser tests; U2 independently passed 288 unit and 16 browser tests. The assembled-stack checks above include all four stages. The full unrelated browser suite and the entire 600-realization fitting run were not rerun.

## Browser and download acceptance

Tests started the repository's actual `npm run preview` (Wrangler/workerd plus built static assets). The initial Work-session `socket(): Operation not permitted` and `uv_interface_addresses` errors did not recur here. No static-server substitute was used.

Desktop and mobile runs inspect both pinned CSV imports, coda-type/URN filters, missing producer/measurement counts, preserved −1/1* codes, invalid/corrupt files, recording/rate changes, separate timing/spectral ranks, delayed completion after replacement/navigation, and unavailable states. The downloaded join JSON contains all 1,375 rows with hashes/revisions/source lines and the selected filters; native JSON contains all four recordings and all rates, with the current selection. No browser POST occurred in the new-feature cases.

Rendered screenshots were inspected at desktop and 320px mobile widths. Wide tables scroll inside focusable regions; keyboard horizontal scrolling and rightmost columns were exercised. Actual JSON files, screenshots, traces and logs remain in ignored/local validation directories, not in the distributed application or repository. Regression checks cover Composer editing/playback/downloads and Context Lab navigation, selection invalidation, saved investigations and provider-free failure paths. Human listening and hosted deployment remain unverified.

## Remaining GitHub operation blocker

Native Git fetch/push succeeds and the existing PR branches were updated. REST and GraphQL requests to `api.github.com` fail at proxy CONNECT with HTTP 403 before GitHub responds. Consequently PR body updates, Draft → Ready transitions, merge-policy inspection and the requested #31 → #32 → #33 → #34 merges remain pending. No PR is reported merged.

The environment draft includes `api.github.com` plus browser-download destinations `cdn.playwright.dev` and `storage.googleapis.com`. Saving a draft does not apply runtime access. Apply the needed domain in environment settings, then recheck API access and current PR states. Use merge commits where repository policy permits, retarget each next PR to `main` after its predecessor is merged, and verify its diff contains only that stage. Prepared PR descriptions are retained under `/workspace/codabridge-validation/` for the API update. No additional merge authorization is needed.
