# CodaBridge

Hear a real recording. Shape a personal synthetic phrase. Compare its timing and keep your coda.

**MVP-03 Coda Composer is implemented for local Draft review.** Four attributed originals connect to a bounded phrase editor, synthetic click playback, source-aware comparison, personal codebook and WAV/card/project downloads. Real server-side Astra editing and investigation contracts are connected to the UI and tested with visibly labeled provider fixtures. **Default live access remains disabled.** The first private live Composer batch accepted a compound edit and verified Apply/Undo/Redo and downloads; its modified-copy investigation was rejected with `UNSUPPORTED_GENERATED_CONTENT` after upstream HTTP success. Live Composer investigation remains unresolved; no hosted Sites run has occurred.

## Run locally

Use Node.js **22.18+** and npm. No account, API key, or `.env` file is needed for the default workspace.

```sh
npm ci
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. This runs the built Worker and static assets locally in Wrangler/workerd. Listen, reveal the measurements, then choose **Make my version**. Duplicate a block, scale its duration, change one gap, undo, compare field examples and save your files. Astra correctly shows Unavailable. Playback is user-initiated and coordinated across field and synthetic audio. Basic creation, comparison and saving require no credentials. Use `env -u OPENAI_API_KEY` before build/test commands if your shell already has a key.

For UI development, keep that preview running and run `npm run dev` in another terminal. Vite serves `http://127.0.0.1:5173` and proxies `/api` to the preview. Rebuild/restart preview after server changes. Without preview, the development UI reports investigation unavailable.

```sh
npm run typecheck
npm test
npm run data:verify
npm run lint
npm run build
npm run test:server-build
npm run test:browser
```

Install Playwright Chromium with `npx playwright install chromium` if absent. Browser tests start and stop their own local production preview. Tests inject a mock **provider transport** through the actual handler; fixtures never ship to visitors. Screenshots of that path are labeled **TEST ONLY**, not live Astra evidence.

## Data and limits

Originals `1.wav`, `2.wav`, `11.wav` and `7.wav` come from [orrp/DSWP](https://huggingface.co/datasets/orrp/DSWP), pinned revision `a2e5d6dd02fc60343e1288c33314e14e8b7aa5be`, under **CC BY 4.0**. Credit: Dominica Sperm Whale Project; Orr Paradise and colleagues, *Towards A Translative Model of Sperm Whale Vocalization*, NeurIPS 2025. [Attribution and methods](docs/DATA_METHODS.md) includes full credit, hashes and selection/annotation provenance.

Markers are **machine-estimated transient groups**. Whole files may contain multiple codas, echoes or unrelated transients; they are not verified biological boundaries, speakers or dialogue turns. The existing normalized-interval metric is descriptive, not translation, a similarity percentage or semantic confidence. Unequal counts stay not comparable.

The browser checks original bytes before decoding. The server independently resolves catalog IDs and recomputes measurements. Generated interpretation is separated from those measurements and cites issued evidence IDs; traceability does not establish factual correctness. Selection changes cancel/obsolete previous investigations, including their export.

## Review and compatibility

- [MVP-03 contract, engineering limits and implementation](docs/MVP_03.md)
- [Composer quantitative-prose policy and correction checks](docs/MVP_03_NUMERIC_PROSE.md)
- [MVP-03 review corrections, before/after captures and downloads](docs/MVP_03_REFINEMENT.md)
- [First live Composer batch: edit passed, investigation rejected](docs/trials/2026-09-12-live-composer/README.md)
- [MVP-03 verification, running-app capture and downloads](docs/MVP_03_VERIFICATION.md)
- [Historical live A/B retrieval and unequal-count batch](docs/trials/2026-09-12-live-retrieval-unequal/README.md)
- [MVP-02 implementation and boundaries](docs/MVP_02.md)
- [Build, model and Sites compatibility](docs/BUILD_COMPATIBILITY.md)
- [MVP-02 verification and screenshots](docs/MVP_02_VERIFICATION.md)
- Historical [MVP-01 contract](docs/MVP_01.md) and [verification](docs/VERIFICATION.md)
- [Parent issue #1](https://github.com/hynk-studio/CodaBridge/issues/1), dependency [Draft PR #2](https://github.com/hynk-studio/CodaBridge/pull/2)

Public live enablement awaits review of an actual access/budget path. Operator flags are **not authentication** and per-request limits are **not a shared spending cap**. Broader Composer live compatibility, hosted Sites runtime/delivery and scientific validation remain unverified. Context / Dialogue Lab remains the planned deeper follow-on after this journey works. The parent launch issue remains open. No Site creation/save/deployment, merge, account/database stack, WhAM or dialogue-transfer work is included. Project code licensing remains undecided; third-party licenses remain in force.
