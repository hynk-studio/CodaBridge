import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { Recording } from "../src/domain/types.ts";
import { DETECTOR, estimateClicks, readWav } from "./wav.ts";

const root = new URL("../", import.meta.url);
const revision = "a2e5d6dd02fc60343e1288c33314e14e8b7aa5be";
const originals = [
  {
    filename: "1.wav",
    sha256: "8d2ff688c55f4fa77ac4ecde320b71dbdc8d409db899bbcf80ed235ecc009057",
  },
  {
    filename: "2.wav",
    sha256: "fc1847c125ebf0f5329ee0d421fa191d89a7ff40443372de944ef1df8e051417",
  },
  {
    filename: "11.wav",
    sha256: "6e4cc5f55a2ec915b23e05ebfd3bc9e4f13d87956139dc8ac36ea3f1e05a97a3",
  },
  {
    filename: "7.wav",
    sha256: "9af722759e0d1125e161b87cb71e01adc026d35b6500d0d62504d2bbe978ce60",
  },
];
const sha256 = (bytes: Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const card = await readFile(new URL("data/DSWP-source-card.md", root));
if (
  sha256(card) !==
  "8c54b9f2ba60fc4d7ffede0590552a89fd234de676783a248cd4635730227f7d"
)
  throw new Error("Pinned source card changed");
const remoteMetadata = JSON.parse(
  await readFile(new URL("data/source-file-metadata.json", root), "utf8"),
) as {
  revision: string;
  files: { path: string; size: number; lfs: { oid: string } }[];
};
if (remoteMetadata.revision !== revision)
  throw new Error("Remote metadata revision mismatch");
const recordings: Recording[] = [];
for (const original of originals) {
  const bytes = await readFile(
    new URL(`public/audio/dswp-${original.filename}`, root),
  );
  if (sha256(bytes) !== original.sha256)
    throw new Error(`Original checksum mismatch: ${original.filename}`);
  const sourceFile = remoteMetadata.files.find(
    (file) => file.path === original.filename,
  );
  if (
    !sourceFile ||
    sourceFile.size !== bytes.length ||
    sourceFile.lfs.oid !== original.sha256
  )
    throw new Error(
      `Pinned source LFS metadata mismatch: ${original.filename}`,
    );
  const wav = readWav(bytes);
  const samples = estimateClicks(wav.pcm, wav.sampleRate);
  recordings.push({
    id: `dswp-${original.filename.replace(".wav", "")}`,
    label: `DSWP / ${original.filename}`,
    audio: {
      path: `/audio/dswp-${original.filename}`,
      sha256: original.sha256,
      bytes: bytes.length,
      durationSeconds: wav.duration,
      sampleRateHz: wav.sampleRate,
      channels: wav.channels,
      frames: wav.frames,
      encoding: "WAV / PCM signed 16-bit little-endian",
      transformations: [],
    },
    source: {
      dataset: "orrp/DSWP",
      revision,
      filename: original.filename,
      url: `https://huggingface.co/datasets/orrp/DSWP/resolve/${revision}/${original.filename}`,
      datasetCardUrl: `https://huggingface.co/datasets/orrp/DSWP/blob/${revision}/README.md`,
      datasetCardSha256: sha256(card),
      attribution:
        "Dominica Sperm Whale Project; DSWP dataset distributed by Orr Paradise and colleagues.",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      citation:
        "Orr Paradise, Pranav Muralikrishnan, Liangyuan Chen, Hugo Flores Garcia, Bryan Pardo, Roee Diamant, David F. Gruber, Shane Gero, Shafi Goldwasser. Towards A Translative Model of Sperm Whale Vocalization. NeurIPS 2025.",
      paperUrl: "https://arxiv.org/abs/2512.02206",
      acquiredOn: "2026-09-12",
    },
    annotation: {
      status: "machine-estimated",
      method: "relative-peak-transient-groups",
      version: "1.0.0",
      parameters: DETECTOR,
      timestampOrigin: "original-file-start",
      selectedIntervalSeconds: { start: 0, end: wav.duration },
      clickSampleIndices: samples,
      clickTimesSeconds: samples.map((sample) => sample / wav.sampleRate),
      sourceAnnotations: "not-provided",
      humanReview: "not-performed",
      corrections: [],
      limitations: [
        "Whole-file candidate sequence; biological coda boundaries are unverified.",
        "Amplitude threshold and grouping can miss clicks, merge nearby events, or count echoes/noise.",
        "Timestamps locate amplitude peaks, not biological click onsets; sample resolution is not annotation accuracy.",
      ],
    },
  });
}
const output = JSON.stringify(recordings, null, 2) + "\n";
const path = new URL("src/data/recordings.json", root);
if (process.argv.includes("--check")) {
  if ((await readFile(path, "utf8")) !== output)
    throw new Error(
      "Curated metadata/annotations do not reproduce. Review before running data:prepare.",
    );
  console.log(
    `PASS: ${originals.length} original byte hashes, PCM metadata, source-card hash, and deterministic annotations reproduce.`,
  );
} else {
  await writeFile(path, output);
  console.log(`Wrote ${fileURLToPath(path)}`);
}
