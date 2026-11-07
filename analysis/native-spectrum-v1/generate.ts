import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { recordings } from "../../src/domain/catalog.ts";
import { compareTiming, measureTiming } from "../../src/domain/timing.ts";
import { DSP, analyzePCM, resample, spectrumDistance } from "../../src/spectral/dsp.ts";
import { DETECTOR, estimateClicks, readWav } from "../../scripts/wav.ts";
const hash = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");
const clips = recordings.map(recording => {
  const bytes = readFileSync("public" + recording.audio.path);
  assert.equal(hash(bytes), recording.audio.sha256); assert.equal(bytes.length, recording.audio.bytes);
  const { pcm, sampleRate } = readWav(bytes); assert.equal(sampleRate, 44100);
  const markers = recording.annotation.clickTimesSeconds;
  const variants = [sampleRate, 32000, 16000].map(rate => {
    const samples = resample(pcm, sampleRate, rate), detected = estimateClicks(samples, rate).map(i => i / rate);
    const input = { clickTimesSeconds: detected, durationSeconds: samples.length / rate, selectedIntervalSeconds: { start: 0, end: samples.length / rate } };
    return { rate, frames: samples.length, detector: DETECTOR, detectedSeconds: detected, countDelta: detected.length - markers.length,
      nearestMarkerDisplacementSeconds: markers.map(t => detected.length ? Math.min(...detected.map(d => Math.abs(t - d))) : null),
      timing: measureTiming(input), input, ...analyzePCM(samples, rate, markers) };
  });
  return { id: recording.id, source: recording.source, original: recording.audio, annotation: recording.annotation, variants };
});
const rankings = clips.flatMap(a => a.variants.map(v => ({ id: a.id, rate: v.rate,
  timing: clips.filter(b => b.id !== a.id).flatMap(b => { const w = b.variants.find(w => w.rate === v.rate)!; const c = compareTiming(v.input, w.input); return c.status === "comparable" ? [{ id: b.id, distance: c.value }] : []; }).sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id)),
  spectrum: clips.filter(b => b.id !== a.id).flatMap(b => { const w = b.variants.find(w => w.rate === v.rate)!; return v.meanEvent && w.meanEvent ? [{ id: b.id, distance: spectrumDistance(v.meanEvent.bandFractions, w.meanEvent.bandFractions) }] : []; }).sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id)),
})));
export const report = { version: DSP.version, method: DSP, clips, rankings,
  limits: ["Four clips are engineering checks, not a generalization benchmark.", "Markers are machine-estimated transients; window overlap checks cannot certify isolated biological clicks.", "Whole-clip spectra also depend on rhythm and background. Event summaries use fixed original marker windows.", "Sample rate sets a representable ceiling, not a measured recording bandwidth. Resampling cannot restore absent information.", "Timing uses equal-count normalized interval MAD; spectrum uses L1 distance of four mean event band-energy fractions within each rate. No combined score.", "Nearest marker displacement is an engineering diagnostic, not verified event correspondence."] };
const content = JSON.stringify(report, null, 2) + "\n";
const manifest = JSON.stringify({ version: DSP.version, path: "/native-spectrum-v1/report.json", bytes: Buffer.byteLength(content), sha256: hash(content) }, null, 2) + "\n";
for (const [path, data] of [["public/native-spectrum-v1/report.json", content], ["src/spectral/native-manifest.json", manifest]]) {
  if (process.argv.includes("--check")) assert.equal(readFileSync(path, "utf8"), data, path);
  else { mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true }); writeFileSync(path, data); }
}
console.log(JSON.stringify({ clips: clips.map(c => ({ id: c.id, rates: c.variants.map(v => ({ rate: v.rate, count: v.detectedSeconds.length, delta: v.countDelta, eligible: v.eligibleWindows, centroid: v.meanEvent?.centroidHz })) })), bytes: Buffer.byteLength(content) }));
