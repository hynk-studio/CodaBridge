# CodaBridge

Listen to real sperm-whale recordings and compare their estimated click timing.

**MVP-01 implemented for local review.** Two attributed recordings, original-speed playback, sample-derived waveforms, absolute/normalized timing, measured intervals, and JSON evidence export work without credentials. **Astra investigation is unavailable. No Site has been created or deployed.**

## Run

Use Node.js **22.18+** (or a newer supported release) and npm. No `.env`, API key, database, or account is needed.

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:5173`. Choose recordings A/B, press Play, switch between Absolute and Normalized, inspect sources/measurements, and download the current evidence. Playing one recording pauses the other. Normalization never changes playback speed. Selecting the same file twice gives a labeled self-comparison.

```sh
npm run typecheck
npm test
npm run data:verify
npm run lint
npm run build
npm run preview
```

The production preview is `http://127.0.0.1:4173`. `dist/` contains static HTML, JavaScript, CSS, and the two original WAV files. The preview server is for local inspection, not production hosting.

Browser smoke tests against that build:

```sh
npx playwright install chromium
npm run test:browser
```

The runner starts/stops its own preview server when one is not running. It checks 1440×1000 desktop and 390×844 mobile, plus 320 px with enlarged text. Reports/traces stay in ignored `playwright-report/` and `test-results/`; runtime screenshots are in `docs/screenshots/`. Unit timings are explicitly synthetic; the app and ordinary browser smoke use real audio.

## Data and limits

Included originals: `1.wav` and `2.wav` from [orrp/DSWP](https://huggingface.co/datasets/orrp/DSWP), revision `a2e5d6dd02fc60343e1288c33314e14e8b7aa5be`, under **CC BY 4.0**. Credit: Dominica Sperm Whale Project; Orr Paradise and colleagues, *Towards A Translative Model of Sperm Whale Vocalization*, NeurIPS 2025. See [attribution and methods](docs/DATA_METHODS.md) for full credit, exact hashes, selection criteria, and annotation provenance.

Each example has six **machine-estimated transient peaks**, not human-reviewed onsets. The selected interval is the entire original clip; biological coda boundaries remain unverified. Timing distance is not a similarity percentage, translation, confidence score, or biological category. Speaker identity and behavioral/dialogue context are not inferred.

The browser verifies hashes before decoding. Missing, changed, or unsupported audio shows an error with Retry. Precomputed timing remains inspectable when audio is unavailable; evidence does not certify successful playback. The optional WebMCP tool reads current evidence only and is not an AI connection.

## Build and review

- [Build/Sites compatibility](docs/BUILD_COMPATIBILITY.md): portable static output, successful local Sites helper, unverified hosted boundary.
- [Verification](docs/VERIFICATION.md): executed checks, screenshots, and unrun checks.
- [MVP-01 contract](docs/MVP_01.md), [parent issue #1](https://github.com/hynk-studio/CodaBridge/issues/1), [Draft PR #2](https://github.com/hynk-studio/CodaBridge/pull/2).

Future work includes bounded Astra investigation, example retrieval, a larger curated set, and separately authorized hosting verification. The parent launch issue remains open. Project code licensing has not been selected; third-party data and dependencies retain their licenses. No affiliation or endorsement is claimed.
