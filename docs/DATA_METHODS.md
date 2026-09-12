# Curated audio and timing methods

## Source and attribution

**Dominica Sperm Whale Project (DSWP)** recordings distributed through [orrp/DSWP](https://huggingface.co/datasets/orrp/DSWP). Retrieved September 12, 2026 from revision `a2e5d6dd02fc60343e1288c33314e14e8b7aa5be`. The [pinned source card](https://huggingface.co/datasets/orrp/DSWP/blob/a2e5d6dd02fc60343e1288c33314e14e8b7aa5be/README.md) declares [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).

Requested citation: Orr Paradise, Pranav Muralikrishnan, Liangyuan Chen, Hugo Flores Garcia, Bryan Pardo, Roee Diamant, David F. Gruber, Shane Gero, and Shafi Goldwasser. **Towards A Translative Model of Sperm Whale Vocalization.** NeurIPS 2025. [Paper](https://arxiv.org/abs/2512.02206). The paper is credited as requested by the dataset; no associated model/software is incorporated or executed.

The source describes isolated sperm-whale audio from Dominica without per-file recording-system metadata or behavioral context. No speaker, dialogue, affiliation, endorsement, or biological meaning claim is made. Project code licensing does not replace the recordings' CC BY 4.0 license.

## Verified originals

| Source file / app ID | Bytes | Duration (s) | SHA-256 |
| --- | ---: | ---: | --- |
| `1.wav` / `dswp-1` | 193192 | 2.1898866213151926 | `8d2ff688c55f4fa77ac4ecde320b71dbdc8d409db899bbcf80ed235ecc009057` |
| `2.wav` / `dswp-2` | 189798 | 2.15140589569161 | `fc1847c125ebf0f5329ee0d421fa191d89a7ff40443372de944ef1df8e051417` |

Both are mono, 44,100 Hz, signed 16-bit little-endian PCM WAV, with 96,574 and 94,877 frames. Files in `public/audio/` are byte-identical to the pinned downloads: **no trimming, resampling, channel mixing, gain adjustment, or format conversion**. Browser playback starts at volume 0.25 and speed 1. The browser/device can resample during decoding/output; that does not change stored timing or bytes. Waveform amplitude is scaled separately for visibility, so graph heights do not compare loudness.

- `src/data/recordings.json`: exact source URLs, revision, hashes, credit, metadata, timing, annotation method and limitations consumed by the app/export.
- `data/source-file-metadata.json`: pinned Hugging Face metadata; its LFS SHA-256 values independently match the downloaded bytes.
- `data/DSWP-source-card.md`: original license/citation snapshot, SHA-256 `8c54b9f2ba60fc4d7ffede0590552a89fd234de676783a248cd4635730227f7d`.
- `data/candidate-audit.json`: six acquired candidates, their hashes/estimated peaks, and dispositions. Only the selected WAVs are shipped.

Six individual revision-pinned URLs, numeric filenames `1.wav`–`6.wav`, supplied 1,075,244 bytes; no dataset archive was downloaded. The selected pair had six grouped transients and at least 0.15 s of leading/trailing margin. Unselected candidates had another detected count or a peak close to a file edge. This is example selection, not representative sampling or biological classification.

## Machine estimates, version 1.0.0

`relative-peak-transient-groups` in `scripts/wav.ts`:

1. Read original mono PCM16 samples without filtering or changing the file.
2. In each consecutive `round(0.002 × sampleRate)` sample window (88 samples here), retain the maximum absolute sample and original sample index.
3. Keep windows at or above 18% of the largest absolute sample amplitude.
4. Group retained windows whose successive retained windows are separated by at most 0.07 s. Choose the strongest sample per group; ties retain the earlier sample.
5. Divide original sample indices by the original sample rate. Selected interval: `[0, recording duration]`, original-file offset zero.

Each file has six **candidate click peaks**. A sample indices: `16881, 22112, 40441, 67117, 75154, 86489`. JSON preserves full precision; only display values are rounded.

No source click annotations, human listening/review, or manual click corrections were used. The sequences may contain multiple codas, echoes, or unrelated transients; weak events can be missed and close events merged. Amplitude peaks are not verified onsets, and sample resolution is not an accuracy guarantee. Biological coda boundaries and scientific classes remain unverified.

```sh
npm run data:verify   # offline: original hashes, remote LFS metadata, PCM, source card, annotations
npm run data:prepare  # offline: regenerate with the fixed method; review any diff
```

Neither command downloads data or calls a model. The originals and source card are committed for fresh checkouts.

## Timing and evidence

For at least two finite, nonnegative, strictly increasing click times within the clip and selected interval:

```text
interval[i] = t[i+1] - t[i]
clickSpan = t[n-1] - t[0]
normalizedInterval[i] = interval[i] / clickSpan
normalizedPosition[i] = (t[i] - t[0]) / clickSpan
```

Normalized intervals sum to one within numerical tolerance. For equal click counts, **`normalized-interval-mad` v`1.0.0`** is the mean of `abs(normalizedA[i] - normalizedB[i])`, a dimensionless descriptive value. The selected pair gives `0.11765155166768508`. Smaller means closer under this timing metric. Offset/uniform scale changes leave normalized spacing unchanged. For two clicks all valid normalized vectors are `[1]`, so the metric cannot distinguish them.

Invalid timing or unequal counts return a not-comparable reason. No alignment, padding, truncation, thresholds, similarity percentages, or semantic confidence are applied. Normalized view changes neither the metric nor playback speed, samples, or stored timing.

Evidence format **`codabridge-comparison-evidence` v`1.0.0`** includes current view/A/B selection, source/annotation provenance, original times/selected interval, unrounded measurements, metric/version/result or incompatibility reason, and limitations. Non-finite numbers fail export instead of silently becoming JSON `null`. Evidence describes measurements, not playback/device attestation or a model result. No model/run ID is fabricated.
