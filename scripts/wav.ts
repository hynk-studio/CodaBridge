// Deliberately narrow offline reader for the selected original PCM16 WAV files.
export function readWav(bytes: Buffer) {
  if (
    bytes.length < 44 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WAVE"
  )
    throw new Error("Expected a RIFF/WAVE file");
  let format:
    | { channels: number; sampleRate: number; bits: number; blockAlign: number }
    | undefined;
  let samples: Buffer | undefined;
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const kind = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > bytes.length) throw new Error("Truncated WAV chunk");
    if (kind === "fmt ") {
      if (size < 16 || bytes.readUInt16LE(start) !== 1)
        throw new Error("Only PCM is supported");
      format = {
        channels: bytes.readUInt16LE(start + 2),
        sampleRate: bytes.readUInt32LE(start + 4),
        bits: bytes.readUInt16LE(start + 14),
        blockAlign: bytes.readUInt16LE(start + 12),
      };
    }
    if (kind === "data") samples = bytes.subarray(start, start + size);
    offset = start + size + (size % 2);
  }
  if (
    !format ||
    !samples ||
    format.channels !== 1 ||
    format.bits !== 16 ||
    format.blockAlign !== 2 ||
    format.sampleRate <= 0 ||
    samples.length % 2
  )
    throw new Error("Expected mono 16-bit PCM with complete frames");
  const pcm = new Float32Array(samples.length / 2);
  for (let i = 0; i < pcm.length; i++)
    pcm[i] = samples.readInt16LE(i * 2) / 32768;
  return {
    ...format,
    frames: pcm.length,
    duration: pcm.length / format.sampleRate,
    pcm,
  };
}

export const DETECTOR = {
  envelopeWindowSeconds: 0.002,
  relativeThreshold: 0.18,
  groupGapSeconds: 0.07,
};

export function estimateClicks(pcm: Float32Array, sampleRate: number) {
  const window = Math.round(sampleRate * DETECTOR.envelopeWindowSeconds);
  const bins: { amplitude: number; sample: number; bin: number }[] = [];
  for (let i = 0; i < pcm.length; i += window) {
    let sample = i;
    for (let j = i + 1; j < Math.min(i + window, pcm.length); j++)
      if (Math.abs(pcm[j]) > Math.abs(pcm[sample])) sample = j;
    bins.push({ amplitude: Math.abs(pcm[sample]), sample, bin: bins.length });
  }
  const peak = Math.max(...bins.map((bin) => bin.amplitude));
  if (!peak) return [];
  const above = bins.filter(
    (bin) => bin.amplitude >= peak * DETECTOR.relativeThreshold,
  );
  const groups: (typeof above)[] = [];
  for (const bin of above) {
    const previous = groups.at(-1);
    if (
      !previous ||
      ((bin.bin - previous[previous.length - 1].bin) * window) / sampleRate >
        DETECTOR.groupGapSeconds
    )
      groups.push([bin]);
    else previous.push(bin);
  }
  return groups.map(
    (group) =>
      group.reduce((a, b) => (b.amplitude > a.amplitude ? b : a)).sample,
  );
}
