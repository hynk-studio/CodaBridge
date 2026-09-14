# MVP-07 execution evidence

Base: `2d1e5ef92bf647200ad2dcd1d15d36383a3a6856`. Branch: `codex/mvp-07-coda-exchange`. The Draft PR records its exact final head. [Format, limits and demo route](../MVP_07.md). This folder is new evidence; it does not replace any historical recording, study, audit or Atlas receipt.

## Actual browser files

Each device run used **three isolated browser contexts**, with different invented private Composer projects in A/B. A downloaded A1; B opened those exact bytes and downloaded A1+B1; A opened B's exact download and appended A2. Full playback visibly advanced through all three turns and ended. The fresh C context reopened identical final bytes, retained no Composer storage, then separately replied from a supported seed. Opening never autoplayed.

| Artifact | Desktop | Phone |
| --- | --- | --- |
| A1 | [JSON](desktop/A1.coda.json) | [JSON](phone/A1.coda.json) |
| Actual B1 reply, including A1 | [JSON](desktop/A1-B1.coda.json) | [JSON](phone/A1-B1.coda.json) |
| Final A1/B1/A2 | [JSON](desktop/A1-B1-A2.coda.json) | [JSON](phone/A1-B1-A2.coda.json) |
| Final synthetic rendering | [WAV](desktop/A1-B1-A2.wav) | [WAV](phone/A1-B1-A2.wav) |
| Fresh reopen | [JSON](desktop/fresh-reopened.coda.json) | [JSON](phone/fresh-reopened.coda.json) |
| Cold seed reply | [JSON](desktop/cold-reply.coda.json) | [JSON](phone/cold-reply.coda.json) |
| Browser observations | [Report](desktop/round-trip.json) | [Report](phone/round-trip.json) |

Files were copied from `test-results/coda-exchange/<project>/` without changing their bytes; those original paths remain in the generated reports. [Byte counts and SHA-256 identities](artifact-identities.json) cover the committed browser files and captures. `A1-repeat.coda.json` equals A1; `fresh-reopened.coda.json` and `after-composer-edits.coda.json` equal the final exchange exactly. Subsequent Composer Undo/Redo did not mutate finalized turns.

Both primary exchanges use `1.wav` and `2.wav`. The cold visitor explicitly selects `11.wav`; it is a catalog seed, with no Composer project. No title, intention, private meaning, codebook, saved analysis, unselected `7.wav` or removed ancestry was automatically transmitted. Private fixture values stay out of exports, request URLs/bodies and console logs. Reports retain only private-state hashes and boolean comparisons. Every new message visible in this evidence is **TEST ONLY**.

The separate saved-analysis case preserves a non-null saved analysis throughout whole-phrase copying, navigation, cancellation, import and reset. The main history case intentionally edits Composer before taking its baseline, then checks exact stored state before testing Undo/Redo. Exchange itself uses no persistent message store.

## Independent checks

[Desktop Python 3.9](checks/independent-desktop-python-3.9.txt) / [3.12](checks/independent-desktop-python-3.12.json) and [phone Python 3.9](checks/independent-phone-python-3.9.txt) / [3.12](checks/independent-phone-python-3.12.json) independently check the three browser-produced files and final WAV. [Cold desktop](checks/cold-desktop.json) / [cold phone](checks/cold-phone.json) also validate the complete four-turn prefix and newly selected source. The fixed Unicode fixture passes independently in [3.9](checks/canonical-python-3.9.json) and [3.12](checks/canonical-python-3.12.json).

The final rendering contains 18 independently checked pulses, a `7.249803004535147`-second first-to-last-click span and exactly **352,311 frames** at 48 kHz (7.3398125 seconds including lead/tail and frame ceiling). Off-schedule PCM is silent; header fields, each pulse, bounded gain and complete technical/source metadata pass. Desktop and phone WAV bytes are identical: **706,818 bytes**, SHA-256 `9be65f7d2a890efbd8688f0a248feb3d49788f2fd7164221642f3088e594ebec`. Human messages, aliases and labels are absent from WAV metadata.

Exact environments: Node **25.9.0**, npm **11.12.1**, Playwright **1.63.0**, Google Chrome for Testing **153.0.8010.12**, macOS **26.6.2 arm64**. The default Python is **3.9.6**, `/Library/Developer/CommandLineTools/usr/bin/python3`; the second is existing **3.12.14**, `analysis/dialogue-transfer/.venv/bin/python3`. Only stdlib artifact verification used that environment; no study runner or model fitting ran. [Environment record](environment.json).

## Commands and results

Every command excludes `OPENAI_API_KEY`. [Exact commands, exit codes and log paths](checks.json).

Only trailing whitespace was cleaned from new text logs for the Git diff; browser file/capture bytes and historical logs are unchanged.

| Check | Actual result |
| --- | --- |
| `npm run typecheck`, `npm run lint` | Pass |
| `npm test` | 237/237 pass |
| `node --experimental-strip-types --test tests/exchange.test.ts` | 16/16 pass |
| `npm run data:verify` | Original audio/curated annotation checks pass |
| `npm run atlas:check` | Non-overwriting Atlas check passes |
| `npm run atlas:verify` | 3,790 rows / 51 nearest-reference probes pass, Python 3.9.6 |
| Current metadata guard | All 121 pinned files pass; also covered by ordinary unit tests |
| `npm run audit:metadata:history` | All 462 files pass in both recorded Git snapshots |
| `npm run build` | Local client + Worker build passes |
| `npm run test:server-build` | 15/15 pass |
| New/affected desktop + phone browser suites | 76/76 pass; final Exchange-only correction recheck 16/16 pass |
| Other browser cases from initial full run | 50/50 pass, retained without repeating unaffected suites |
| Independent browser JSON/WAV and canonical fixture | Pass in Python 3.9.6 and 3.12.14 |

The initial full browser invocation was stopped after repeated outdated navigation assumptions failed: **114 passed, 6 failed, 6 not run** (exit 130). Adding the fourth workspace correctly activates the existing compact selector at narrower widths; several old tests still clicked hidden navigation buttons or expected only three options. Those tests now use the existing visible-navigation helper and include Exchange in keyboard navigation. All four affected files were rerun successfully. [Initial log](checks/browser-initial.txt), [76-case rerun](checks/browser-final.txt), [final 16-case Exchange recheck](checks/exchange-browser-final.txt), [126 distinct passing cases across runs](browser-coverage.json). This is not a claim that one uninterrupted 126-case invocation passed.

The final Exchange recheck covers role-compatible earlier-pattern selection and resets the picker when a different snapshot is opened, including same-ID alternatives. A received ID literally named `outgoing` also cannot be mistaken for the draft playback cue.

## Running-app inspection

| Capture | Desktop | Phone / narrow |
| --- | --- | --- |
| Separate outgoing draft | [Preview](desktop/A1-preview.png) | [Preview](phone/A1-preview.png) |
| Complete exchange controls | [Overview](desktop/final-exchange.png) | [Overview](phone/final-exchange.png) |
| Read-only message/source/timing | [Turns](desktop/final-turns.png) | [Turns](phone/final-turns.png) |
| 320px / 200% text | [Editor](desktop/320px-enlarged-editor.png) | [Timing and keyboard focus](phone/320px-enlarged-timing.png) |

The agent inspected actual captures in two correction passes. First, a timeline class collision with the descriptive Lab was removed; Exchange now uses its own compact timeline class. Second, the stopped-audio badge was returned to normal document flow and timing buttons use relative widths, keeping enlarged-text fields and full button words unobscured. Final 320px editor/timing captures were re-inspected; browser assertions report zero page overflow and exercise keyboard focus, editing and download after audio failure.

A separate visible in-app Browser check used a TEST ONLY `2.wav` seed, message, shorten/undo/redo, finalization and explicit reset. Tab-level CDP `Runtime.evaluate` worked: at **319 × 734**, page overflow was **0 px**, and the corrected one-turn timeline measured **69 px** high with `display: flex`. This was an additional agent inspection, not the isolated A/B/C acceptance run. The temporary tab and bounded keep-awake lease were closed afterward.

The running preview watcher logged a transient missing `dist/server/index.js` while a rebuild replaced the output directory. Completed builds and subsequent browser checks passed. A [fresh preview check](checks/fresh-preview.json) after the final build confirmed exact served HTML/JS/CSS bytes and `unavailable / NOT_CONFIGURED` investigation status; the preview was then stopped.

## Preservation and remaining limits

[Preservation receipt](preservation.json): **481 existing source/data/research/audit/Atlas/historical evidence files** match base bytes and Git objects. This is a one-time comparison, not a new application-code freeze or future guard. Original producer/method definitions, source annotations, archived files and historical execution logs were not regenerated.

| Unchanged identity | Bytes | SHA-256 |
| --- | ---: | --- |
| Public Atlas | 4,769,558 | `7b01d8cb58c8c5443591a53713c680c775c4354dc5ce1403b7f481094f66656f` |
| Public Atlas summary | 48,349 | `93f6cc199985454f943ece7e5b31d4739d22c9a8c014c67954dec6715d9dacdf` |
| Atlas manifest | 463 | `683af3df21e50acf7e4bb72b112b6e50b865653dd9a23f5a35deb05bc6afcacf` |

Atlas method identity remains `d46c01ab1a884d84c8f626ebd61a8dd7fd68863e266da3bc3640c7e5d039c366`; original annotation source SHA-256 remains `1856c8bf915cc5ae6f928aaa2036cbbc6ad8840bb6e4f6a96aaeb96953215da2`.

No human listening, physical-device comfort testing, real native-share delivery, Safari/Firefox acceptance or hosted operation is claimed. Share cancellation/rejection/success checks use a conspicuous TEST ONLY bridge. No deployment, inference enablement, paid provider call, fitting, external data acquisition, metadata replay, encryption or new study occurred. Preserved study verifiers were not rerun because their owners/dependencies did not change. The prior independent Atlas interpreter evidence remains historical.
