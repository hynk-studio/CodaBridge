# MVP-08 acceptance evidence

Implemented from base `bd450d7f1fe509cd3dd8e7e3da1c64150d4483d2` for [issue #19](https://github.com/hynk-studio/CodaBridge/issues/19) and its [owner clarification](https://github.com/hynk-studio/CodaBridge/issues/19#issuecomment-5657429116). The final commit identity is recorded on the Draft PR. [Demo, format, threat model and session/output review](../MVP_08.md).

All content and keys in this directory are **PUBLIC TEST ONLY** reproducibility fixtures. Never use these opening keys for private content. The test runner observed the pre-encryption bytes without replacing Web Crypto or production randomness; expected plaintext and keys are deliberately retained separately from the downloaded ciphertext. Ordinary captures/logs have no opening-code values; sealed traces and automatic failure snapshots are disabled.

## Executed round trips

[Desktop](desktop/round-trip.json) and [phone](phone/round-trip.json) each used three isolated Chromium contexts and native Web Crypto. A1 → A1+B1 → A1+B1+A2 produced distinct keys/IVs; each older key failed on the next snapshot, and exact prior turns survived. B first failed with a wrong key, then unlocked the actual file. A and B retained their separate private Composer work, selection, codebook and Undo/Redo. Per-turn and complete synthetic playback ran. Lock cancellation retained an unfinished note; confirmed discard removed it and required the key again. C reopened the final bytes without Composer state and made a fourth, freshly sealed seed reply. Reload required file and key again. Repeated downloads and re-unlocked/fresh re-downloads remained byte-identical.

The independent Node checker authenticated/decrypted all four actual snapshots per profile, reconstructed AAD separately, and compared exact pre-encryption bytes. The unchanged Python Exchange checker then verified source bindings, canonical bytes, hashes, parent links and timing. Separately, the existing plain JSON/WAV browser journey ran on both profiles; the two explicit unencrypted export branches also passed independent JSON/WAV verification. These explicit exports were not intermediate steps in the sealed conversation.

| Actual browser files | Desktop | Phone |
| --- | --- | --- |
| A1 | [sealed](desktop/A1.coda.sealed.json) | [sealed](phone/A1.coda.sealed.json) |
| A1+B1 | [sealed](desktop/A1-B1.coda.sealed.json) | [sealed](phone/A1-B1.coda.sealed.json) |
| A1+B1+A2 | [sealed](desktop/A1-B1-A2.coda.sealed.json) | [sealed](phone/A1-B1-A2.coda.sealed.json) |
| Cold fourth turn | [sealed](desktop/cold-reply.coda.sealed.json) | [sealed](phone/cold-reply.coda.sealed.json) |
| Separate public verification keys / expected-byte filenames | [PUBLIC TEST ONLY](desktop/PUBLIC-TEST-ONLY-keys.json) | [PUBLIC TEST ONLY](phone/PUBLIC-TEST-ONLY-keys.json) |
| Independent sealed verification | [report](checks/independent-desktop-complete.txt) | [report](checks/independent-phone-complete.txt) |
| Plain backward-compatibility journey | [files/report](plain-desktop/round-trip.json) | [files/report](plain-phone/round-trip.json) |
| Independent plain JSON/WAV verification | [report](checks/plain-desktop-independent.txt) | [report](checks/plain-phone-independent.txt) |
| Explicit unencrypted JSON/WAV verification | [report](checks/explicit-desktop-complete.txt) | [report](checks/explicit-phone-complete.txt) |

Source timing comes from the existing `dswp-1`, `dswp-2` and cold-reply `dswp-11` catalog seeds; the separate private Composer fixture also contains `dswp-7`. Their original audio identity, attribution and machine-estimate annotations remain unchanged. Messages and role labels are human-authored TEST ONLY fixtures, not whale meaning or authenticated people. The fourth cold turn is still an alternating B-role turn, not identity verification of person C.

## Commands and actual results

Every command below used `env -u OPENAI_API_KEY`. Exact argv, duration, exit status and logs, including earlier runs, are indexed in [checks.json](checks.json). New text logs have trailing whitespace/empty EOF lines removed for Git hygiene; their messages and outcomes are retained. [Environment](environment.json): Node 25.9.0, npm 11.12.1, OpenSSL 3.6.3, Python **3.9.6** at `/Library/Developer/CommandLineTools/usr/bin/python3`, Playwright 1.63.0, Chromium **153.0.8010.12**, macOS 26.6.2 arm64. No other Python-version execution is claimed for this slice.

| Command (after the credential-excluding prefix) | Result |
| --- | --- |
| `npm test` | [249/249 passed](checks/unit-tests-final.txt), including 12 sealed and 16 existing Exchange tests |
| `npm run sealed:test` | [12/12 passed](checks/sealed-tests-final.txt), including pinned NIST known-answer and independent reverse interoperability |
| `node --experimental-strip-types --test tests/exchange.test.ts` | [16/16 passed](checks/exchange-tests.txt) |
| `npm run typecheck` | [passed](checks/typecheck-closeout.txt) |
| `npm run lint` | [passed](checks/lint-complete.txt) |
| `npm run data:verify` | [passed](checks/data-verify.txt), four original audio hashes and source context |
| `npm run atlas:check` | [passed without overwriting](checks/atlas-check.txt) |
| `npm run atlas:verify` | [passed](checks/atlas-verify.txt), 3,790 records / all 51 nearest probes |
| `npm run build` | [client and Worker passed](checks/build-complete.txt) |
| `npm run test:server-build` | [15/15 passed](checks/server-build.txt), built artifact / local workerd mock-transport checks |
| `npm run test:browser -- tests/browser/sealed.spec.ts tests/browser/exchange.spec.ts tests/browser/composer.spec.ts tests/browser/context.spec.ts tests/browser/polish.spec.ts --max-failures=1` | [112/112 passed](checks/browser-final.txt): 36 sealed + 76 existing/affected cases across both profiles |
| `npm run sealed:test:browser -- --max-failures=1` | [final 38/38 passed](checks/sealed-browser-complete.txt) after focus correction, additional clipboard/late-completion assertions and an explicit unavailable-crypto locked-view message; retained sealed files/captures are from this run |
| `npm run sealed:verify -- tests/fixtures/sealed/PUBLIC-TEST-ONLY-keys.json` | [passed](checks/independent-fixture.txt) |
| `npm run sealed:verify -- docs/sealed-coda-v1/{desktop,phone}/PUBLIC-TEST-ONLY-keys.json` (one invocation per profile) | Both passed; exact commands in the two linked independent reports |
| `npm run exchange:verify -- … --wav …` | Both original plain journeys and both explicit export branches passed; exact file arguments in the four reports above |
| Current `checkFrozenArtifacts()` metadata guard | [121 frozen files passed](checks/metadata-guard.command.json); no full metadata replay |
| `node --experimental-strip-types docs/sealed-coda-v1/check-served.ts` | [final built bytes and disabled endpoints passed](checks/served-complete.txt) |

The first recorded combined browser run had **51 passes, one failure and 60 not run** ([log](checks/browser.txt)). The new URL-cleanup assertion counted two existing AudioCard URLs as Exchange-owned; it was corrected to track only URLs created by Exchange downloads. The 112-case rerun passed. Earlier exploratory test development also corrected an assumption that Undo/Redo leaves the Composer's recorded revision unchanged. Prior execution logs are retained as earlier runs; final sealed artifact checks are the `*-complete` reports. No pre-MVP-08 historical evidence was replaced.

A preview watch process reported a transient missing `dist/server/index.js` while the build recreated `dist`. After the final build, a fresh preview served matching HTML/JS/CSS bytes and returned `503 NOT_CONFIGURED` from `/api/investigate`, `/api/composer` and `/api/lab` after an unavailable status check. Its [log](checks/preview-complete.txt) had no errors. Owned preview processes, temporary browser tab and keep-awake lease were stopped.

## Inspected layouts and lifetime boundaries

Two UI inspect/change/recheck passes moved preparation controls below finalization and corrected locked-state retention text and post-dialog focus. Manual in-app-browser inspection at 319×734 observed zero horizontal overflow, locked mode, zero rendered turns, no private note and focus on the empty **Opening code** field. [Inspection record](ui-inspection.json).

Inspected retained examples: [desktop masked key](desktop/A1-prepared.png), [desktop unlocked timing/history](desktop/unlocked-turns.png), [phone locked after discard](phone/locked-after-discard.png), [320px unlocked](phone/320px.png), [320px / 200% numeric timing](phone/320px-enlarged-timing.png), [320px / 200% sealed controls](phone/320px-enlarged-key.png), and [plain keyboard editor / enlarged text](plain-phone/320px-enlarged-editor.png). Text and numbers wrap without horizontal page overflow; 200% layouts require vertical scrolling. Keys were masked or absent during every retained capture.

The 19 sealed cases per profile cover malformed/oversized/invalid authenticated candidates; wrong keys and tampered fields; crypto/RNG failures; staged replacements; duplicate/downgrade handling; key-copy denial and success stubs; share cancellation/rejection/unsupported handling; separate expiring export confirmations; fresh seals; owned URL cleanup; and delayed read/hash/encrypt/decrypt/clipboard/audio completion after lock. Unit checks verify owner references and temporary buffer cleanup. Browser tests verify DOM removal and no stale restoration. In-flight engine buffers and immutable strings cannot be provably erased.

`pagehide`/persisted `pageshow` were explicitly simulated, and actual navigation to `about:blank` and back was exercised. A native BFCache cache hit was **not established**. Ordinary visibility/workspace switching preserves unfinished work and hides key reveal; it does not claim to lock.

## Unchanged identities and limits

[Preservation report](preservation.json) compares **550 historical files** byte-for-byte with the base Git objects: original sources/media, studies, audit evidence, Atlas, old Exchange fixtures and all MVP-07 browser downloads/evidence. This is a one-time delivery comparison, not a new application-code freeze. [New artifact identities](artifact-identities.json) record byte lengths and SHA-256 for this acceptance and the separate public fixtures.

| Preserved identity | SHA-256 |
| --- | --- |
| Public Atlas, 4,769,558 bytes | `7b01d8cb58c8c5443591a53713c680c775c4354dc5ce1403b7f481094f66656f` |
| Atlas summary, 48,349 bytes | `93f6cc199985454f943ece7e5b31d4739d22c9a8c014c67954dec6715d9dacdf` |
| Atlas manifest | `683af3df21e50acf7e4bb72b112b6e50b865653dd9a23f5a35deb05bc6afcacf` |
| Atlas method | `d46c01ab1a884d84c8f626ebd61a8dd7fd68863e266da3bc3640c7e5d039c366` |
| Original context CSV | `1856c8bf915cc5ae6f928aaa2036cbbc6ad8840bb6e4f6a96aaeb96953215da2` |

Firefox and Playwright WebKit were not installed; Safari and other engines were not exercised. Phone profiles are emulation. Human listening, physical-device behavior, OS clipboard permission behavior, actual external native-share delivery, hosted operation, hostile-device testing and professional security review remain unperformed. Clipboard/share stubs establish application behavior only. The known-answer and native Node checks are interoperability evidence, not cryptographic certification. There is no sender authentication, forward secrecy, revocation or lost-key recovery.

No deployment/Sites action, live model request, inference enablement, credential inspection, external message transmission, research fitting or historical artifact regeneration occurred. Stop at Draft review.
