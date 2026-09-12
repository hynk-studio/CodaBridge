# CodaBridge

Listen to real sperm whale recordings and compare their estimated click timing.

**MVP-02 implemented for local review.** Four attributed originals, original-speed playback, waveforms, absolute/normalized timing, deterministic observations, and evidence export work without credentials. A real server-side Astra adapter and grounded investigation UI are implemented. **Live access is disabled; no application-model request or hosted Sites run has been performed.**

## Run locally

Use Node.js **22.18+** and npm. No account, API key, or `.env` file is needed for the default workspace.

```sh
npm ci
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. This runs the built Worker and static assets locally in Wrangler/workerd. Investigation correctly shows Unavailable. Listening, selection, comparison and downloads remain usable. Playing one recording pauses the other; normalization changes neither playback speed nor stored timing.

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

- [MVP-02 implementation and boundaries](docs/MVP_02.md)
- [Build, model and Sites compatibility](docs/BUILD_COMPATIBILITY.md)
- [MVP-02 verification and screenshots](docs/MVP_02_VERIFICATION.md)
- Historical [MVP-01 contract](docs/MVP_01.md) and [verification](docs/VERIFICATION.md)
- [Parent issue #1](https://github.com/hynk-studio/CodaBridge/issues/1), dependency [Draft PR #2](https://github.com/hynk-studio/CodaBridge/pull/2)

Public live enablement awaits review of an actual access/budget path. Per-request limits are **not a global spending cap**. Live Astra access, hosted Sites runtime/audio delivery and scientific validation remain unverified. The parent launch issue remains open. No Site creation/save/deployment, merge, account/database stack, WhAM or dialogue-transfer work is included. Project code licensing remains undecided; third-party licenses remain in force.
