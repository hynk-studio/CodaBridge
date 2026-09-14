# Sealed opening-key display correction

Bounded correction to Draft PR #20, starting at reviewed head `c13210ad9d4aec4a0e146a3732e82b4a95cb7756` on base `bd450d7f1fe509cd3dd8e7e3da1c64150d4483d2`. The updated PR records the exact correction head. Existing cryptography, formats and acceptance artifacts remain unchanged.

Clipboard absence/denial now shows manual-fallback guidance without revealing or selecting the opening key. Reveal, Hide, Select and Copy remain explicit actions, and neither copy success nor failure acknowledges saving. Copy feedback has a separate counter: a later display choice or hidden-document event suppresses obsolete callbacks. Existing session generation checks still suppress callbacks after navigation, lock and replacement.

The `visibilitychange` handler reacts to `document.hidden` by remasking and invalidating copy feedback only. Returning to visible does not reveal the key. It leaves the conversation generation, pending crypto, unfinished note, finalized envelope, prepared file/key binding and acknowledgement intact. Masking is not locking or erasure.

## Actual verification

All commands below used `env -u OPENAI_API_KEY`; exact argv/results are in [checks.json](checks.json). New logs omit trailing whitespace; no opening-code values were redacted because none were emitted.

| Command after that prefix | Result |
| --- | --- |
| `npm run sealed:test` | [12/12 passed](checks/sealed-tests.txt), including unchanged known-answer and interoperability checks |
| `npm test` | [249/249 passed](checks/unit-tests.txt) |
| `npm run typecheck` | [Passed](checks/typecheck-final.txt) |
| `npm run lint` | [Passed](checks/lint-final.txt) |
| `npm run build` | [Fresh client/Worker build passed](checks/build.txt) |
| `npm run sealed:test:browser -- --max-failures=1` | [54/54 desktop/phone cases passed](checks/browser-final.txt) |
| `node --experimental-strip-types docs/sealed-coda-v1/check-served.ts` | [Exact fresh build bytes served](checks/served-build.txt); existing safe probes returned disabled responses |
| `python3 docs/sealed-key-display-correction/verify-preservation.py` | [839 reviewed files byte-identical](checks/preservation-final.txt), including all 165 prior Sealed Coda evidence files |

The first browser run also passed 54/54. The final run adds a second scroll-position capture for phone inspection and an explicit masked-state assertion on successful copying. Application source stayed unchanged after the recorded build. The delivered client is `index-fVX2loRR.js`, SHA-256 `277e897f521c6c687a47e54be6dd6496d6c62cad07e8f7c6d04409e917b3382c`.

Focused cases cover missing/rejected clipboard access; no automatic selection; explicit Reveal/Hide/manual selection; correct acknowledgement handling; delayed rejection after Hide, hiding, workspace navigation, lock and a different accepted snapshot; and hidden/visible transitions with unchanged content and encrypted bytes. Decrypting the repeated disposable download with the retained matching TEST ONLY key confirms the exact original finalized envelope. An unfinished reply survives visibility changes and returns to the same prepared file/key after explicit draft cancellation. Pending encryption completes across hiding. Cancelled sharing carries only the encrypted File and never triggers a download or plaintext/key fallback.

Visibility is **simulated**, with both `document.hidden` and `document.visibilityState` set to the hidden/visible values before dispatching the event. This is not a real background-tab or native share-sheet test. Clipboard and sharing APIs use TEST ONLY stubs. Traces, automatic failure screenshots and automatic failure page snapshots are disabled; explicit captures are taken only after asserting password masking.

## Inspected captures

| Failure | Desktop | Phone |
| --- | --- | --- |
| Clipboard API missing | [fallback](desktop/clipboard-missing-fallback.png) / [masked controls](desktop/clipboard-missing-masked.png) | [fallback](phone/clipboard-missing-fallback.png) / [masked controls](phone/clipboard-missing-masked.png) |
| Clipboard permission rejected | [fallback](desktop/clipboard-rejected-fallback.png) / [masked controls](desktop/clipboard-rejected-masked.png) | [fallback](phone/clipboard-rejected-fallback.png) / [masked controls](phone/clipboard-rejected-masked.png) |

The two phone images show the same failure state at different scroll positions. The fallback is readable, the key is masked, the separate controls remain available and the saving acknowledgement is unchecked. All content is PUBLIC TEST ONLY. [Capture identities and inspection record](captures.json).

[Environment](environment.json): Node 25.9.0, npm 11.12.1, Playwright 1.63.0, Chromium 153.0.8010.12, macOS 26.6.2 arm64. Desktop is 1440×1000; phone is 390×844 emulation. Python 3.9.6 runs only the read-only preservation comparison. No real OS clipboard permission, native background-tab behavior, physical-device behavior, external sharing, human listening or professional security review is claimed.

The preservation command compares every reviewed tracked file except the three intended edits (`Exchange.tsx`, the sealed browser tests and the necessary MVP-08 documentation correction). It records the reviewed tree and an ordered identity digest; this is delivery evidence, not a future application-code freeze. All cryptographic/session helpers, wrapper/AAD/encoding, fixtures, old payloads, encrypted files/public keys, previous captures/logs and research/Atlas files remain exact.

The required browser suite wrote disposable outputs under ignored `test-results`; existing committed acceptance paths were never overwritten. This directory retains only new correction evidence. The unrelated untracked image remains untouched. No full 112-case suite, research replay, historical artifact regeneration, deployment, inference enablement, paid model call or external message transmission was performed for this correction. The owned local preview was stopped after verification; PR #20 remains Draft for review.
