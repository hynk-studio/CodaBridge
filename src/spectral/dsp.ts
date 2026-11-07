export const DSP = Object.freeze({ version: "native-spectrum-v1", windowSeconds: .020, hopSeconds: .010, meanRemoval: "per window", window: "symmetric Hann", spectrum: "one-sided power, zero-padded radix-2 FFT", bandsHz: [0, 4000, 8000, 16000, 24000], resampler: "zero-phase Hann-windowed sinc; radius 48 input samples; zero extension; DC weight normalization", resampleRadius: 48, cutoffFraction: .45, amplitude: "original PCM full-scale units; no peak normalization", markerWindows: "fixed original machine-estimated markers in every rate; overlapping and edge windows excluded" });
function validate(pcm: Float32Array, rate: number) {
  if (!pcm.length || pcm.length > 6_000_000 || !Number.isInteger(rate) || rate < 16000 || rate > 96000 || pcm.some(x => !Number.isFinite(x))) throw new Error("Invalid PCM or sample rate.");
}
export function resample(pcm: Float32Array, sourceRate: number, rate: number): Float32Array {
  validate(pcm, sourceRate); if (![16000, 32000, sourceRate].includes(rate) || rate > sourceRate) throw new Error("Only native or bounded downsampling is supported.");
  if (rate === sourceRate) return pcm.slice();
  const out = new Float32Array(Math.round(pcm.length * rate / sourceRate));
  const radius = DSP.resampleRadius, cutoff = DSP.cutoffFraction * rate / sourceRate;
  for (let i = 0; i < out.length; i++) {
    const t = i * sourceRate / rate; let sum = 0, weight = 0;
    for (let j = Math.ceil(t - radius); j <= Math.floor(t + radius); j++) {
      const d = t - j, sinc = Math.abs(d) < 1e-12 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * d) / (Math.PI * d);
      const w = sinc * (.5 + .5 * Math.cos(Math.PI * d / radius));
      weight += w; if (j >= 0 && j < pcm.length) sum += w * pcm[j];
    }
    out[i] = sum / weight;
  }
  return out;
}
export function powerSpectrum(samples: Float32Array) {
  if (samples.length < 3 || samples.length > 16384 || samples.some(x => !Number.isFinite(x))) throw new Error("Invalid spectral window.");
  const size = 2 ** Math.ceil(Math.log2(samples.length));
  const re = new Float64Array(size), im = new Float64Array(size);
  let mean = 0; for (const v of samples) mean += v / samples.length;
  let windowPower = 0;
  for (let i = 0; i < samples.length; i++) { const w = .5 - .5 * Math.cos(2 * Math.PI * i / (samples.length - 1)); re[i] = (samples[i] - mean) * w; windowPower += w * w; }
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; }
  }
  for (let len = 2; len <= size; len *= 2) {
    for (let i = 0; i < size; i += len) {
      for (let j = 0; j < len / 2; j++) {
        const angle = -2 * Math.PI * j / len, c = Math.cos(angle), s = Math.sin(angle), k = i + j + len / 2;
        const a = re[k] * c - im[k] * s, b = re[k] * s + im[k] * c;
        re[k] = re[i + j] - a; im[k] = im[i + j] - b; re[i + j] += a; im[i + j] += b;
      }
    }
  }
  return Array.from({ length: size / 2 + 1 }, (_, i) => (re[i] ** 2 + im[i] ** 2) * (i === 0 || i === size / 2 ? 1 : 2) / (size * windowPower));
}
export function spectralSummary(power: number[], rate: number) {
  if (power.length < 2 || power.some(v => !Number.isFinite(v) || v < 0)) throw new Error("Invalid power spectrum.");
  const energy = power.reduce((s, v) => s + v, 0), fftSize = (power.length - 1) * 2;
  if (energy <= 1e-20) return null;
  const bands = [0, 0, 0, 0]; let moment = 0;
  power.forEach((p, i) => { const hz = i * rate / fftSize; moment += hz * p; const b = hz < 4000 ? 0 : hz < 8000 ? 1 : hz < 16000 ? 2 : 3; bands[b] += p / energy; });
  return { centroidHz: moment / energy, meanSquare: energy, bandFractions: bands };
}
export function analyzePCM(pcm: Float32Array, rate: number, markers: number[]) {
  validate(pcm, rate);
  if (markers.length > 200 || markers.some((x, i) => !Number.isFinite(x) || x < 0 || x >= pcm.length / rate || (i > 0 && x <= markers[i - 1]))) throw new Error("Invalid marker times.");
  const length = Math.round(DSP.windowSeconds * rate), half = Math.floor(length / 2);
  const events = markers.map((time, index) => {
    const start = Math.round(time * rate) - half;
    const status = start < 0 || start + length > pcm.length ? "edge" : markers.some((other, j) => j !== index && Math.abs(time - other) < DSP.windowSeconds) ? "overlapping" : "measured";
    const summary = status === "measured" ? spectralSummary(powerSpectrum(pcm.slice(start, start + length)), rate) : null;
    return { index, markerSeconds: time, startSample: start, samples: length, status: status === "measured" && !summary ? "silent" : status, summary };
  });
  let total: number[] = [], windows = 0;
  for (let start = 0; start + length <= pcm.length; start += Math.round(DSP.hopSeconds * rate)) {
    const power = powerSpectrum(pcm.slice(start, start + length));
    if (!total.length) total = power.map(() => 0); power.forEach((p, i) => total[i] += p); windows++;
  }
  const eligible = events.flatMap(e => e.summary ? [e.summary] : []);
  return { events, eligibleWindows: eligible.length, excludedWindows: events.length - eligible.length,
    meanEvent: eligible.length ? { centroidHz: eligible.reduce((s, v) => s + v.centroidHz, 0) / eligible.length, bandFractions: DSP.bandsHz.slice(1).map((_, i) => eligible.reduce((s, v) => s + v.bandFractions[i], 0) / eligible.length) } : null,
    wholeClip: { windows, summary: windows ? spectralSummary(total.map(v => v / windows), rate) : null } };
}
export const spectrumDistance = (a: number[], b: number[]) => {
  if (a.length !== 4 || b.length !== 4 || [...a, ...b].some(v => !Number.isFinite(v) || v < 0 || v > 1 + 1e-12)) throw new Error("Invalid band fractions.");
  return a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0);
};
