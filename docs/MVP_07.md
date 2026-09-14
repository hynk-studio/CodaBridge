# Personal Coda / file-based Exchange

Issue [#17](https://github.com/hynk-studio/CodaBridge/issues/17) authorizes this local, key-free product slice. A human message travels beside a synthetic timing pattern in a `.coda.json` file. A one-turn file is a Personal Coda Packet; replies extend the same format to A1/B1/A2, up to eight turns. **Plaintext, not encrypted.** Checksums establish consistency, not authorship or delivery. Animal meaning is unknown.

## Demonstration

1. Run `env -u OPENAI_API_KEY npm run build` and `env -u OPENAI_API_KEY npm run preview`. Open `http://127.0.0.1:4173` in two separate browser profiles.
2. In A, make or open a Composer draft. **Save & codebook → Make a transmission** copies the selected block; **Include the whole phrase** is an explicit choice. Write a separate message, optionally set a self-declared alias/style label, adjust timing, audition and finalize A1. Download the coda JSON.
3. In B, choose **Exchange → Open a coda file** and select A's actual download. Inspect/listen to A1, choose B's own Composer timing or a supported seed, then **Reply with my style**. Finalize B1 and download the complete file.
4. In A, open B's actual file and explicitly replace the opened snapshot. Choose A's own pattern, write A2, finalize, play the complete exchange and download JSON/WAV. Earlier turn content remains unchanged; inter-turn playback gaps are separately editable.
5. A fresh profile can open the final JSON without a prior project or exchange. It can reply from a supported seed. Save the file to keep it after refresh; Exchange messages are held only in memory. Browser exit warnings are best effort.

Opening, replying, cancelling and navigating preserve the mounted Composer's draft, selected block, codebook, saved analysis and Undo/Redo. Copies exclude project IDs/revisions/title/intention, block meanings, codebook, saved analysis and unrelated/removed ancestry. New messages never enter Composer autosave or provider requests. A reply carries every previous turn/message, visibly listed before finalization/export. Different, older and branched snapshots require explicit replacement; there is no merge or timestamp winner. Reopening the same snapshot is idempotent.

## Version 1 format and limits

The envelope has exactly these fields, in this canonical order:

`format`, `version`, `protection`, `catalogVersion`, `rendererVersion`, `interpretation`, `exchangeId`, `turns`, `arrangement`, `digest`.

Identities are `codabridge-exchange`, `1`, `none`, catalog `2.0.0` and renderer `click-pulse-1`. The exact interpretation string is:

> Human-created synthetic timing; animal meaning unknown; plaintext, not encrypted; authorship unverified.

| Record | Fixed field order |
| --- | --- |
| Turn | `id`, `exchangeId`, `role`, `alias`, `label`, `createdAt`, `message`, `phrase`, `parent`, `digest` |
| Phrase / block | `blocks`; each block: `id`, `times`, `spacingAfter`, `source` |
| Parent | `turnId`, `digest`; first turn uses `null` |
| Arrangement | `kind` (`human-authored`), `gaps` |
| Source | `recordingId`, `dataset`, `sourceRevision`, `filename`, `audioSha256`, `audioBytes`, `transformations`, `originalOffsetSeconds`, `originalClickTimesSeconds`, `annotationVersion`, `annotationMethod`, `annotationStatus`, `humanReview`, `license`, `attribution`, `citation` |

Sources resolve exactly to the four supported DSWP catalog recordings (`1.wav`, `2.wav`, `7.wav`, `11.wav`), revision `a2e5d6dd02fc60343e1288c33314e14e8b7aa5be`, CC BY 4.0. Each descriptor is rebuilt from the local pinned catalog and every imported value is checked, retaining the byte checksum, offset, original markers, transformation list and machine-estimate/no-human-review provenance. Imported URLs are neither accepted nor followed. Source validity does not authenticate an edit history. The Atlas is not a packet seed/import format.

| Engineering boundary | Limit |
| --- | --- |
| File input and complete serialized output | 512 KiB UTF-8 (524,288 bytes) |
| Turns / arranged first-to-last-click span | 1–8 / at most 120 seconds |
| Per-turn phrase | Existing Composer validator: 1–4 blocks, 2–12 clicks per block, first click zero, at most 30 seconds |
| Internal gaps / between-block spacing | 0.04–5 seconds / 0.05–5 seconds |
| Inter-turn arrangement gaps | Exactly turns minus one; 0.05–5 seconds, default 0.5 |
| Alias / style label / message | 48 / 80 / 2,000 UTF-16 code units; reject excess, never truncate |
| IDs / digests | Case-sensitive `[A-Za-z][A-Za-z0-9_-]{0,63}` / 64 lowercase hexadecimal digits |
| Optional creation time | `null` or exact valid `YYYY-MM-DDTHH:mm:ss.sssZ`; the UI emits `null` and never refreshes it on download |
| Structure | At most 12 nesting levels, 8,192 visited nodes, 128 entries per container; strict known fields |
| Audio | At most 384 clicks; 48 kHz mono PCM16; fixed gain 0.16; metadata at most 8,192 bytes |

Only the existing Composer's `1e-12` subtraction tolerance at internal gap boundaries applies. IDs, parent links, source values, order and hashes remain exact. All accepted numbers are finite. Unknown versions/protection/fields, duplicate JSON keys (including escaped spellings), dangerous prototype keys, deep input, invalid Unicode/control characters, duplicate turn IDs and broken parent/role/exchange chains fail before installation. The file size is checked before reading, followed by actual byte count and fatal UTF-8 decoding. Reads, hashes and edits use generations; obsolete completions cannot install state.

## Deterministic encoding

Validators reconstruct objects in the field order above. Canonical bytes are UTF-8 of ECMAScript `JSON.stringify` on that strict payload: no spacing or final newline, standard JSON escaping, finite binary64 number spelling, and negative zero represented as `0`. Unicode scalar values are preserved without normalization; composed and decomposed text remain distinct. Unpaired UTF-16 surrogates and disallowed controls are rejected; tab/newline/carriage return are allowed. Input whitespace, property order and equivalent JSON escapes are immaterial after validation. Arrays retain their exact order. This is a versioned known-schema encoding, not a claim of RFC/JCS conformance.

A turn SHA-256 covers every turn field except its own `digest`, including the preceding turn's exact ID/content digest. The envelope SHA-256 covers every envelope field except its own `digest`, including ordered turns **with** their digests and the arrangement. Web Crypto supplies standard SHA-256. Import verifies every supplied digest; it does not repair them. Finalized objects are frozen, repeated downloads reuse stable bytes/IDs, and arrangement edits change only the envelope digest. Anyone can rewrite plaintext and recompute all hashes; no signature, sender authentication or secrecy is implied.

The fixed Unicode fixture and recorded byte/turn/payload hashes are in `tests/fixtures/exchange-canonical*.json`. Their expected hashes were calculated independently in Python. `scripts/verify-exchange.py` independently rebuilds source descriptors, canonical bytes, parent order and ordered timing without importing production TypeScript helpers. It is an acceptance-artifact checker, not a second application parser.

## Playback and saving

`src/exchange/` adapts the existing Composer validators/operations and shared renderer/playback owner. Extracted `TimingControls.tsx` serves both editors. It does not mount another Composer or expand the provider contract.

A turn's internal clicks and between-block spacing are retained. Each authored inter-turn gap runs from the previous last click to the next first click. The complete schedule has one 0.05-second lead and one 0.04-second tail; no per-turn padding is added. Bounds are checked before PCM allocation. Individual/whole/draft playback is explicit and shares exclusivity with field, Composer, Atlas and descriptive Lab sound. Selection, import, reset, edits and workspace changes stop relevant playback, including a pending resume. The timeline, active-turn cue and numeric timings remain available without audio.

The mandatory download is `codabridge-<exchange-id>-<turn-count>.coda.json` (`application/json`). WAV is secondary synthetic audio, not a reversible acoustic encoding of the message. Its bounded INFO/ICMT JSON contains only the fixed synthetic/unknown-meaning label, renderer settings and deduplicated pinned source credits; messages, aliases and style labels are excluded. Required attribution is never silently dropped.

Optional Web Share checks `canShare` against the actual prepared stable File before an explicit user gesture. Unsupported, rejected and cancelled sharing keep state and the download path. Cancellation never automatically downloads. A returned share operation means handoff to another app, not receipt or reading. [Web Share specification](https://www.w3.org/TR/web-share/), [Web Crypto digest specification](https://www.w3.org/TR/webcrypto/).

## Verification and evidence

Current run evidence is recorded separately under [coda-exchange-v1](coda-exchange-v1/README.md). All messages in browser files/captures are invented **TEST ONLY** content. The real acceptance uses isolated A/B/C browser contexts, actual A1/B1/A2 browser downloads, a fresh identical reopen, and a cold seed reply. Private Composer sentinel text is checked through boolean comparisons and hashes so it does not enter committed screenshots/reports. A separate case preserves a non-null saved analysis; the history case also exercises Undo/Redo.

```sh
env -u OPENAI_API_KEY npm run typecheck
env -u OPENAI_API_KEY npm test
env -u OPENAI_API_KEY node --experimental-strip-types --test tests/exchange.test.ts
env -u OPENAI_API_KEY npm run data:verify
env -u OPENAI_API_KEY npm run atlas:check
env -u OPENAI_API_KEY npm run atlas:verify
env -u OPENAI_API_KEY npm run audit:metadata:history
env -u OPENAI_API_KEY npm run lint
env -u OPENAI_API_KEY npm run build
env -u OPENAI_API_KEY npm run test:server-build
env -u OPENAI_API_KEY npm run test:browser
env -u OPENAI_API_KEY npm run exchange:verify -- \
  docs/coda-exchange-v1/desktop/A1.coda.json \
  docs/coda-exchange-v1/desktop/A1-B1.coda.json \
  docs/coda-exchange-v1/desktop/A1-B1-A2.coda.json \
  --wav docs/coda-exchange-v1/desktop/A1-B1-A2.wav
```

The independent script needs Python 3.9+ standard library; substitute `phone` for the separate mobile-browser artifact check. It reconstructs every pulse position, WAV header/frame count/duration and source metadata; off-schedule PCM must be silent, and pulse values allow at most one quantization step for independent floating-point evaluation.

Automated playback is not human listening or physical-device comfort testing. Native-share tests use a TEST ONLY bridge, not a real messenger delivery. Local Worker builds/browser previews do not establish hosted operation. Archived sources, research/audit outputs, Atlas/method/manifest and historical browser evidence remain unchanged. No model fitting, provider invocation, deployment, encryption or new study is part of this work.
