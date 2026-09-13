import {
  COMPOSER_LIMITS,
  CREATION_IDENTITY,
  parseDraft,
  span,
  type Draft,
} from "./model.ts";

export const RENDERER = Object.freeze({
  version: "click-pulse-1",
  sampleRate: 48000,
  gain: 0.16,
  pulseSeconds: 0.012,
  leadSeconds: 0.05,
  tailSeconds: 0.04,
});
export function eventSchedule(draft: Draft) {
  const valid = parseDraft(draft);
  let start = RENDERER.leadSeconds;
  const events: { blockId: string; marker: number; seconds: number }[] = [];
  for (const [index, b] of valid.blocks.entries()) {
    b.times.forEach((t, i) =>
      events.push({ blockId: b.id, marker: i, seconds: start + t }),
    );
    start += span(b) + (index < valid.blocks.length - 1 ? b.spacingAfter : 0);
  }
  return { renderer: RENDERER, events, duration: start + RENDERER.tailSeconds };
}
export function renderSamples(draft: Draft) {
  const schedule = eventSchedule(draft);
  if (schedule.duration > COMPOSER_LIMITS.phraseSeconds + 0.1)
    throw new Error("Audio duration limit.");
  return {
    samples: renderClickSchedule(schedule.events, schedule.duration),
    schedule,
  };
}
// Shared pulse renderer; Composer retains its own stricter draft limits above.
// Research reconstructions use a separate, bounded schedule, never a fake Draft.
export function renderClickSchedule(
  events: { seconds: number }[],
  duration: number,
  attenuation = 1,
) {
  if (
    !Number.isFinite(duration) ||
    duration <= 0 ||
    duration > 120.1 ||
    events.length > 1740 ||
    !Number.isFinite(attenuation) ||
    attenuation <= 0 ||
    attenuation > 1 ||
    events.some(
      (e) =>
        !Number.isFinite(e.seconds) || e.seconds < 0 || e.seconds >= duration,
    )
  )
    throw new Error("Synthetic schedule limit.");
  const samples = new Float32Array(Math.ceil(duration * RENDERER.sampleRate));
  const pulseFrames = Math.floor(RENDERER.pulseSeconds * RENDERER.sampleRate);
  for (const event of events) {
    const start = Math.round(event.seconds * RENDERER.sampleRate);
    for (let i = 0; i < pulseFrames && start + i < samples.length; i++) {
      const t = i / RENDERER.sampleRate;
      const envelope =
        Math.sin((Math.PI * i) / pulseFrames) ** 2 * Math.exp(-t * 240);
      samples[start + i] +=
        RENDERER.gain *
        attenuation *
        envelope *
        Math.sin(2 * Math.PI * 1400 * t);
    }
  }
  return samples;
}
export function wavBytes(draft: Draft) {
  const { samples } = renderSamples(draft);
  const credit = [...new Set(draft.ancestry.map((s) => s.recordingId))].join(
    ", ",
  );
  const metadata = new TextEncoder().encode(
    `${CREATION_IDENTITY}. ${draft.title}. Creator intention: ${draft.intention || "not assigned"}. Creator-assigned block meanings: ${draft.blocks.map((b, i) => `${i + 1}: ${b.meaning || "not assigned"}`).join("; ")}. Seed timing: Dominica Sperm Whale Project / DSWP, distributed by Orr Paradise and colleagues, ${credit}, CC BY 4.0. Meaning to sperm whales: unknown.\0`,
  );
  return encodeWav(samples, metadata);
}
export function encodeWav(samples: Float32Array, metadata: Uint8Array) {
  if (
    !samples.length ||
    samples.length > Math.ceil(120.1 * RENDERER.sampleRate) ||
    metadata.length > 8192 ||
    samples.some((s) => !Number.isFinite(s))
  )
    throw new Error("WAV bounds.");
  const metadataSize = metadata.length + (metadata.length % 2);
  const bytes = new ArrayBuffer(44 + samples.length * 2 + 20 + metadataSize);
  const view = new DataView(bytes);
  const ascii = (offset: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, bytes.byteLength - 8, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, RENDERER.sampleRate, true);
  view.setUint32(28, RENDERER.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) =>
    view.setInt16(
      44 + i * 2,
      Math.round(Math.max(-1, Math.min(1, sample)) * 32767),
      true,
    ),
  );
  const offset = 44 + samples.length * 2;
  ascii(offset, "LIST");
  view.setUint32(offset + 4, 12 + metadataSize, true);
  ascii(offset + 8, "INFOICMT");
  view.setUint32(offset + 16, metadata.length, true);
  new Uint8Array(bytes, offset + 20).set(metadata);
  return bytes;
}

let current: SyntheticPlayer | null = null;
export function stopSynthetic() {
  current?.stop();
}
export class SyntheticPlayer {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private generation = 0;
  private changed: (state: string) => void;
  constructor(changed: (state: string) => void) {
    this.changed = changed;
  }
  async play(draft: Draft) {
    return this.playBuffer(() => renderSamples(draft).samples);
  }
  async playRendered(samples: Float32Array) {
    if (
      !samples.length ||
      samples.length > Math.ceil(120.1 * RENDERER.sampleRate) ||
      samples.some((s) => !Number.isFinite(s))
    )
      throw new Error("Synthetic buffer limit.");
    return this.playBuffer(() => samples);
  }
  private async playBuffer(render: () => Float32Array) {
    // One process-local playback owner coordinates separate browser components.
    stopSynthetic();
    this.stop();
    // eslint-disable-next-line typescript/no-this-alias
    current = this;
    const generation = ++this.generation;
    if (typeof AudioContext === "undefined")
      throw new Error(
        "Synthetic audio is unavailable in this browser. You can still edit and save a WAV.",
      );
    const context = new AudioContext();
    this.context = context;
    try {
      const samples = render();
      const buffer = context.createBuffer(
        1,
        samples.length,
        RENDERER.sampleRate,
      );
      buffer.getChannelData(0).set(samples);
      await context.resume();
      if (this.generation !== generation || this.context !== context) return;
      const source = context.createBufferSource();
      this.source = source;
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => {
        if (this.source === source) this.stop();
      };
      source.start(context.currentTime);
      this.changed("Playing synthetic clicks");
    } catch {
      if (generation !== this.generation) return;
      this.stop();
      throw new Error(
        "Synthetic playback could not start. Editing and WAV saving remain available.",
      );
    }
  }
  async pauseResume() {
    const context = this.context;
    if (!context) return;
    const generation = this.generation;
    try {
      if (context.state === "running") {
        await context.suspend();
        if (generation === this.generation)
          this.changed("Synthetic playback paused");
      } else {
        await context.resume();
        if (generation === this.generation)
          this.changed("Playing synthetic clicks");
      }
    } catch {
      if (generation === this.generation) this.stop();
    }
  }
  stop() {
    this.generation++;
    const source = this.source,
      context = this.context;
    this.source = null;
    this.context = null;
    if (source) {
      source.onended = null;
      try {
        source.stop();
      } catch {
        /* already ended */
      }
      source.disconnect();
    }
    if (context && context.state !== "closed")
      void context.close().catch(() => {});
    if (current === this) current = null;
    this.changed("Synthetic playback stopped");
  }
}
