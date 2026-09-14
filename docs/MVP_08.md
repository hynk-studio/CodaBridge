# MVP-08 · Sealed Coda

Exchange → **Sealed with an opening key** → choose an independent timing copy → write a note → **Finalize** → **Prepare sealed file**. Retain the opening key separately, acknowledge that you saved it, then download the encrypted file. The acknowledgement is a declaration, not proof that a key was stored successfully. A finalized plain exchange also offers **Seal this finalized exchange**.

The recipient opens the actual file, sees a locked preview, and supplies the code. Successful authentication and full Exchange validation open read-only history and local playback. **Reply with my style** starts a separate timing copy, inherits sealed export intent and includes every prior turn. Finalize and prepare again for a fresh key. A cold browser can reply from the existing supported catalog seeds without creating a Composer project.

Plain Exchange JSON/WAV remains supported. Its v1 bytes, `protection: none`, interpretation, hashes and source/timing contract are unchanged. The outer file's encryption and the current unlocked session are separate from those historical inner fields. [Exchange v1 contract](MVP_07.md).

## Fixed format

The outer JSON has exactly these fields:

| Field | Value |
| --- | --- |
| `format`, `version` | `codabridge-sealed`, `1` |
| `algorithm`, `tagLength` | `AES-256-GCM`, `128` bits |
| `iv` | Canonical unpadded base64url of 12 random bytes |
| `ciphertext` | Canonical unpadded base64url of ciphertext followed by the 16-byte tag |

Authenticated additional data is UTF-8 of compact `JSON.stringify` on the reconstructed `{format, version, algorithm, tagLength, iv}` header, in that exact order, with no whitespace or newline. Incoming outer key order and insignificant JSON whitespace may vary. Duplicate/unknown fields, nested fields, noncanonical encodings, alternative algorithms and unsupported versions fail. No supplied AAD field is accepted.

Every new encryption uses independent `crypto.getRandomValues` calls for a **32-byte key and 12-byte IV**. Native Web Crypto imports a nonextractable AES key with only `encrypt` or `decrypt` usage and uses an explicit 128-bit tag. There are no passwords, KDFs, custom cipher, compression, crypto SDK, timing-derived secrets or production test-randomness hooks. A deliberately exported raw opening code still exists; nonextractability does not erase that copy. [Web Crypto AES-GCM specification](https://www.w3.org/TR/2017/REC-WebCryptoAPI-20170126/#aes-gcm-operations).

The code is `cbsk1-` plus 43 base64url characters representing exactly 32 bytes. Paste input is limited to 80 UTF-16 code units and allows only surrounding ASCII space, TAB, CR and LF. Internal whitespace, padding, case folding, Unicode normalization, other lengths and arbitrary passwords fail. A correctly sized all-zero PUBLIC TEST ONLY known-answer key is structurally valid; production always requests fresh randomness.

Outer input/output is capped at **1 MiB UTF-8**. The scanner bounds raw bytes/depth before parsing; the outer record allows one object level and at most 32 lexical nodes. Decoded C||T is 16–524,304 bytes. File size is checked before reading, then actual bytes and fatal UTF-8 are checked. Dispatch is bounded separately; the original plaintext parser retains its 512 KiB, 8-turn, 120-second, source, text and structure constraints.

Encryption revalidates the finalized envelope and encrypts its exact canonical UTF-8 file bytes. Decryption authenticates before decoding plaintext, then runs the complete existing parser including source/checksum/parent/order checks. Failed authentication or invalid authenticated content returns a generic bounded error, without quoting content or keys. Unsupported APIs/insecure contexts and RNG/crypto failures never produce a plaintext fallback.

The opaque filename is `codabridge-sealed-<iv>.coda.sealed.json`. No inner ID, turn count, digest, alias, message, waveform, source descriptor or opening key is exported outside the ciphertext. Format and ciphertext length remain visible.

## Session, exports and cleanup

`SessionOwner` owns plain, private and locked state, with explicit reading/hashing/sealing/unlocking phases and a synchronous operation latch. React subscribes to a revision counter. The encrypted artifact, matching code and exact envelope digest are installed together only if the generation is still current. Repeated downloads reuse the same prepared File. An explicit new seal, reply or changed arrangement requires fresh encryption; an outgoing draft withholds export controls until finalized or cancelled. Arrangement changes never rewrite prior turns.

A different sealed file is staged as a **locked candidate** when work is open. Current work remains explicitly open until successful decryption/validation and confirmed replacement. Wrong keys and malformed files leave it intact. Same-file imports preserve unfinished replies; equal-inner-digest plaintext imports cannot switch a private session to plain. Reset or replacement with a different plain file is an explicit discard action.

Private default download/share uses only the current ciphertext File. Optional sharing checks `canShare` on that exact File and passes only `files`, never a key or message. Cancel/reject/unsupported results do not start a download or downgrade. Returned sharing means handoff, not delivery. Opening-code copy is explicit and reports success only after clipboard completion; denial offers manual reveal/select/copy. A separately trusted route is recommended; two messages on one compromised service do not create meaningful separation.

**Export unencrypted copy** and **Export audible WAV (not encrypted)** each require a new confirmation bound to that exact finalized snapshot and action. They never enable a permanent bypass. WAV retains the existing bounded technical/source metadata and omits messages and aliases. Encryption does not retroactively protect these explicit exports.

**Lock and forget key** invalidates every generation, stops exclusive audio, revokes Exchange-owned object URLs, clears pending confirmations/candidates/key inputs/reveals, drops decrypted envelope/draft/history/selection/range references and unmounts their UI. Only accepted encrypted bytes remain for re-unlock. Unsealed changes or an unacknowledged generated key require explicit loss confirmation. Lock never secretly encrypts an unfinished draft. A session with no encrypted snapshot becomes empty and locked.

Workspace/ordinary tab switching preserves work, stops relevant playback and hides key reveal; it does not claim to lock. `visibilitychange` does not discard notes. `pagehide`, unmount and persisted `pageshow` discard app references best-effort; a reload requires the file and key again. Before-unload warnings cannot guarantee cleanup on abrupt termination.

Mutable temporary key/plaintext buffers are overwritten where possible; working CryptoKeys and references are dropped on completion. In-flight Web Crypto generally cannot be cancelled: obsolete results are discarded. JavaScript immutable strings, engine buffers, garbage collection, devtools, browser extensions, OS clipboard and downloaded files cannot be securely erased or recalled by this UI.

## Threat model and output review

The objective is confidentiality of an exported file against someone lacking its random key, plus rejection of failed authenticated decryption. A legitimate recipient must trust the running app/device. Anyone with the key can read the entire history and produce another valid file. This provides no sender/recipient authentication, signatures, forward secrecy, revocation, replay/rollback protection, key recovery, anonymity or length hiding. It does not protect a compromised browser/app/device and is not certified security or a professional security audit.

The focused output review covers every Exchange download, object URL, file input, clipboard and native-share call. Plain Files are prepared only in plain mode; private plaintext/WAV are constructed inside fresh confirmed actions. Lock clears owned URLs and app references. No Exchange code writes storage, URLs, logs, provider payloads or analytics, and no new fetch/service worker/cache/account/inbox exists. Browser tests observe storage writes, requests and console using TEST ONLY sentinels. Private inputs disable spellcheck where supported; browser/keyboard services remain outside this app's control. The existing Composer owner and its autosave/codebook/selection/Undo/Redo stay separate.

## Verification

```sh
env -u OPENAI_API_KEY npm run sealed:test
env -u OPENAI_API_KEY npm run sealed:verify -- tests/fixtures/sealed/PUBLIC-TEST-ONLY-keys.json
env -u OPENAI_API_KEY npm run sealed:test:browser
env -u OPENAI_API_KEY npm run sealed:verify -- docs/sealed-coda-v1/desktop/PUBLIC-TEST-ONLY-keys.json
env -u OPENAI_API_KEY npm run sealed:verify -- docs/sealed-coda-v1/phone/PUBLIC-TEST-ONLY-keys.json
```

The pinned [NIST CAVP vector](../tests/fixtures/sealed/nist-gcm-256.json) records published bytes, exact parameter group/count and archive/member SHA-256 identities. A different fixed fixture was generated by Node `createCipheriv` and opened in the browser. `scripts/verify-sealed.mjs` imports no production format/crypto helper: it reconstructs the AAD, authenticates/decrypts browser files with Node `createDecipheriv`, compares exact observed pre-encryption bytes, and runs the existing independent Python Exchange checker for canonical hashes/source/parent/timing. This independent API/serialization check may share a platform crypto backend; it is not independent cryptanalysis or NIST validation.

[New commands, actual round trips, masked captures, limitations and preservation evidence](sealed-coda-v1/README.md). All retained keys and content are conspicuously **PUBLIC TEST ONLY**, kept separately from ciphertext artifacts. They are reproducibility fixtures, not private communications. Historical Exchange/source/research/audit/Atlas evidence is unchanged; no fitting, old artifact regeneration, deployment, inference enablement or paid model call is part of this slice.
