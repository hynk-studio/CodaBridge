# Native audio spectrum / bandwidth v1

U2 of the research upgrade plan. In Context Lab → **Spectrum / Environment**, select an original recording and 44.1/32/16 kHz measurements. Inspect separate equal-count timing and event-window band-fraction rankings, counts, spans, centroids, exclusions and a source-bound download. Published CETI annotations remain a separate local-file view without waveform mapping.

    npm run spectrum:generate
    npm run spectrum:check
    npm run spectrum:verify
    node --experimental-strip-types --test tests/native-spectrum.test.ts

[Protocol](PROTOCOL.md) was fixed before generation. Original hashes and licenses are unchanged. `public/native-spectrum-v1/report.json` is a 94,562-byte deterministic derived report; its checksum manifest binds browser loading. No samples are resynthesized for visitors, no encoder is trained, and playback/Composer/Exchange owners are untouched.

## Measured result

| Original | Detected groups at 44.1 / 32 / 16 kHz | Mean fixed-window centroid Hz, same order |
| --- | --- | --- |
| 1.wav | 6 / 6 / 7 | 8176.9 / 6802.9 / 4467.6 |
| 2.wav | 6 / 6 / 6 | 8461.9 / 6272.7 / 4689.7 |
| 11.wav | 6 / 6 / 6 | 9288.8 / 7745.0 / 5257.6 |
| 7.wav | 7 / 7 / 7 | 7545.5 / 6910.7 / 5335.3 |

All 25 original-marker windows were eligible under the mechanical edge/overlap rule at all three rates. This does not certify biological click isolation. For 11.wav, the closest spectral candidate changes from 1.wav to 7.wav at 16 kHz; for 7.wav it changes from 2.wav to 11.wav. The 1.wav count change also changes the same-count timing candidate set. 1.wav and 2.wav retain each other as their closest spectral candidate at all rates. Centroid reductions are expected under low-pass conversion; neither changed nor unchanged ranking establishes higher-band biological usefulness.

## Executed verification (2026-11-07)

Nine focused U1/U2 tests passed, including hand-computable timing, tone centroids, anti-alias attenuation, silence, invalid values, edge/overlap windows, Composer pulses/background perturbation, checksum rejection and aborted loads. Independent NumPy implementation recomputed all 75 native/resampled marker spectra, all four source byte bindings and every spectral rank. Deterministic regeneration, typecheck, production client/Worker build and lint passed. NumPy is used only by the independent offline verifier.

Actual browser download, responsive layout, listening and hosted behavior remain unverified because this executor denies browser sockets and Wrangler network-interface enumeration (see U1). Desktop/phone selection, export and unavailable-data tests are committed. No deployment or model request occurred. The known unchanged-main v0.2 exact-log replay test failure remains documented in U1; no historical study was altered.
