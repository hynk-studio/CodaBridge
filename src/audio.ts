import type { Recording } from "./domain/types.ts";

export type WaveBin = { min: number; max: number };

export function waveformBins(samples: Float32Array, count = 300): WaveBin[] {
  const width = Math.max(1, Math.ceil(samples.length / count));
  const bins: WaveBin[] = [];
  for (let i = 0; i < samples.length; i += width) {
    let min = 0;
    let max = 0;
    for (let j = i; j < Math.min(i + width, samples.length); j++) {
      min = Math.min(min, samples[j]);
      max = Math.max(max, samples[j]);
    }
    bins.push({ min, max });
  }
  return bins;
}

export async function loadAudio(recording: Recording, signal: AbortSignal) {
  const response = await fetch(recording.audio.path, { signal });
  if (!response.ok)
    throw new Error(`Audio unavailable (HTTP ${response.status}).`);
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== recording.audio.bytes)
    throw new Error("Audio size does not match the source record.");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (hash !== recording.audio.sha256)
    throw new Error("Audio checksum does not match the source record.");
  if (typeof AudioContext === "undefined")
    throw new Error("This browser does not support audio decoding.");
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(bytes.slice(0));
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    if (
      Math.abs(decoded.duration - recording.audio.durationSeconds) > 0.002 ||
      decoded.numberOfChannels !== recording.audio.channels
    )
      throw new Error(
        "Decoded audio does not match the recorded duration or channels.",
      );
    return {
      blob: new Blob([bytes], { type: "audio/wav" }),
      bins: waveformBins(decoded.getChannelData(0)),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "EncodingError")
      throw new Error("This browser could not decode the WAV recording.");
    throw error;
  } finally {
    await context.close();
  }
}
