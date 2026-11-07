import test from "node:test";
import assert from "node:assert/strict";
import { analyzePCM, powerSpectrum, resample, spectralSummary, spectrumDistance } from "../src/spectral/dsp.ts";
import { renderClickSchedule, RENDERER } from "../src/composer/sound.ts";
import { compareTiming } from "../src/domain/timing.ts";
const tone = (hz: number, sr = 48000, seconds = .1) => Float32Array.from({ length: Math.round(sr * seconds) }, (_, i) => Math.sin(2 * Math.PI * hz * i / sr));
test("known tones, silence, finite rejection and edge/overlap windows", () => {
  const s = spectralSummary(powerSpectrum(tone(3000, 48000, .02)), 48000)!;
  assert.ok(Math.abs(s.centroidHz - 3000) < 1); assert.ok(s.bandFractions[0] > .999);
  assert.equal(spectralSummary(powerSpectrum(new Float32Array(100)), 48000), null);
  assert.throws(() => powerSpectrum(new Float32Array([1, NaN, 2])));
  const a = analyzePCM(tone(2000), 48000, [.001, .04, .045, .08]);
  assert.deepEqual(a.events.map(e => e.status), ["edge", "overlapping", "overlapping", "measured"]);
});
test("anti-alias resampling retains in-band tone and suppresses 12 kHz at 16 kHz", () => {
  const low = resample(tone(2000), 48000, 16000), high = resample(tone(12000), 48000, 16000);
  const rms = (x: Float32Array) => Math.sqrt(x.slice(100, -100).reduce((s, v) => s + v * v, 0) / (x.length - 200));
  assert.equal(low.length, 1600); assert.ok(rms(low) > .6); assert.ok(rms(high) < .005);
  assert.ok(Math.abs(spectralSummary(powerSpectrum(low.slice(200, 520)), 16000)!.centroidHz - 2000) < 1);
  assert.throws(() => resample(tone(2000, 16000), 16000, 32000));
});
test("tempo scale and interval rearrangement separate duration from normalized shape", () => {
  const input = (times: number[]) => ({ durationSeconds: 2, clickTimesSeconds: times, selectedIntervalSeconds: { start: 0, end: 2 } });
  const a = input([.1, .2, .4, .8]), b = input([.1, .3, .7, 1.5]), c = input([.1, .5, .6, .8]);
  const same = compareTiming(a, b), changed = compareTiming(a, c);
  assert.equal(same.status, "comparable"); if (same.status === "comparable") assert.ok(same.value < 1e-15);
  assert.equal(changed.status, "comparable"); if (changed.status === "comparable") assert.ok(changed.value > .1);
});
test("Composer pulse, different pulse shape and added background affect spectral evidence", () => {
  const markers = [.04, .10], pcm = renderClickSchedule(markers.map(seconds => ({ seconds })), .16);
  const a = analyzePCM(pcm, RENDERER.sampleRate, markers.map(t => t + .006)).meanEvent!;
  const noisy = Float32Array.from(pcm, (v, i) => v + .04 * Math.sin(2 * Math.PI * 10000 * i / RENDERER.sampleRate));
  const b = analyzePCM(noisy, RENDERER.sampleRate, markers.map(t => t + .006)).meanEvent!;
  assert.ok(b.centroidHz > a.centroidHz); assert.ok(spectrumDistance(a.bandFractions, b.bandFractions) > .2);
  const c = spectralSummary(powerSpectrum(tone(6000, 48000, .02)), 48000)!;
  assert.ok(c.bandFractions[1] > .999); assert.ok(c.centroidHz > a.centroidHz);
});
test("static report validates source bytes and refuses altered/stale results", async () => {
  const { readFileSync } = await import("node:fs");
  const { loadNativeReport } = await import("../src/spectral/native.ts");
  const bytes = readFileSync("public/native-spectrum-v1/report.json");
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(bytes);
    assert.equal((await loadNativeReport(new AbortController().signal)).clips.length, 4);
    const ac = new AbortController(); ac.abort(); await assert.rejects(() => loadNativeReport(ac.signal), /Aborted/);
    const changed = Buffer.from(bytes); changed[0] = 32;
    globalThis.fetch = async () => new Response(changed);
    await assert.rejects(() => loadNativeReport(new AbortController().signal), /checksum/);
  } finally { globalThis.fetch = original; }
});
