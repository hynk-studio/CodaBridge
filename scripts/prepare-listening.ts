// Local, key-free listening handoff. Public source + deterministic demonstration,
// never the owner's saved creation or an application-model invocation.
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { createDraft, applyOperations } from "../src/composer/model.ts";
import { projectJson } from "../src/composer/project.ts";
import { eventSchedule, wavBytes, RENDERER } from "../src/composer/sound.ts";
import { recordings } from "../src/domain/catalog.ts";
import { contextSegment, contextSource } from "../src/lab/catalog.ts";
import { exchangeSchedule, exchangeWav } from "../src/lab/sound.ts";

const output = resolve(process.argv[2] ?? ".tmp/listening-pack");
mkdirSync(output, { recursive: true });
const source = recordings.find((r) => r.id === "dswp-1")!;
const seed = createDraft(source.id);
seed.id = "p-listening-demo";
seed.blocks[0].id = "b-seed-demo";
seed.title = "Listening demonstration";
seed.intention = "Compare changes in timing. No whale meaning assigned.";
const uniform = applyOperations(seed, [
  { op: "scale_duration", blockId: seed.blocks[0].id, factor: 1.25 },
]);
const modified = applyOperations(uniform, [
  { op: "set_gap", blockId: uniform.blocks[0].id, gapIndex: 0, seconds: 0.3 },
]);
const phrase = applyOperations(seed, [
  {
    op: "duplicate_block",
    blockId: seed.blocks[0].id,
    newBlockId: "b-copy-demo",
  },
  { op: "scale_duration", blockId: "b-copy-demo", factor: 1.25 },
  { op: "set_gap", blockId: "b-copy-demo", gapIndex: 0, seconds: 0.3 },
]);
const entries: {
  file: string;
  label: string;
  identity: string;
  bytes: number;
  sha256: string;
  durationSeconds: number;
  schedule?: unknown;
}[] = [];
function retain(
  file: string,
  label: string,
  identity: string,
  bytes: Buffer,
  durationSeconds: number,
  schedule?: unknown,
) {
  writeFileSync(join(output, file), bytes);
  entries.push({
    file,
    label,
    identity,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    durationSeconds,
    ...(schedule ? { schedule } : {}),
  });
}
const original = readFileSync(resolve("public", source.audio.path.slice(1)));
if (createHash("sha256").update(original).digest("hex") !== source.audio.sha256)
  throw new Error("Original audio hash differs.");
retain(
  "01-original-field.wav",
  "Original field clip · DSWP / 1.wav",
  "Untransformed field recording; machine marker estimates are not verified coda boundaries",
  original,
  source.audio.durationSeconds,
);
for (const [file, label, draft] of [
  [
    "02-synthetic-seed.wav",
    "Synthetic seed timing · original gap proportions",
    seed,
  ],
  ["03-uniformly-lengthened.wav", "Synthetic block · all gaps ×1.25", uniform],
  [
    "04-single-gap-modified.wav",
    "Synthetic block · first gap 0.300 s after ×1.25 scaling",
    modified,
  ],
  [
    "05-full-phrase.wav",
    "Human-created synthetic phrase · original seed then modified copy",
    phrase,
  ],
] as const) {
  const schedule = eventSchedule(draft);
  retain(
    file,
    label,
    "Synthetic timing sonification, not a whale voice or field recording",
    Buffer.from(wavBytes(draft)),
    schedule.duration,
    schedule,
  );
}
const exchange = exchangeSchedule(contextSegment);
retain(
  "06-annotated-exchange.wav",
  "Research exchange · 60-second annotation reconstruction",
  "Timing reconstruction from research annotations — not the original recording; unrelated to the four field clips",
  Buffer.from(exchangeWav(contextSegment)),
  exchange.duration,
  exchange,
);
writeFileSync(
  join(output, "composer-project.json"),
  projectJson(phrase, [], null, phrase.blocks[1].id),
);
writeFileSync(
  join(output, "manifest.json"),
  JSON.stringify(
    {
      version: 1,
      identity:
        "Key-free local listening demonstration; no model call or human-listening verdict",
      renderer: RENDERER,
      fieldSource: source,
      researchSource: contextSource,
      segmentId: contextSegment.id,
      sourceRows: contextSegment.calls.map((c) => c.sourceLine),
      entries,
      humanChecks:
        "Not performed. Automated decoding and scheduling do not establish audible differences, comfort or physical-device success.",
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  join(output, "listen.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>CodaBridge · listening handoff</title><style>body{font:17px/1.65 system-ui;background:#0c1b23;color:#e5eeee;max-width:820px;margin:32px auto;padding:0 20px}h1,h2{line-height:1.2}a{color:#d6f699}article{border:1px solid #45606a;padding:18px;margin:20px 0;border-radius:12px}audio{width:100%}button{padding:12px 18px;background:#d6f699;border:0;border-radius:7px}small{color:#b7caca}li{margin:10px 0}</style></head><body><h1>Listen. Notice the timing.</h1><p>A key-free CodaBridge demonstration. Start at a comfortable device volume. Each Play is your choice; starting a clip stops the other clips. No model requests, autoplay or wildlife playback.</p><button id="stop">Stop all playback</button>${entries.map((e) => `<article><h2>${e.label}</h2><small>${e.identity} · ${e.durationSeconds.toFixed(3)} s</small><audio controls preload="none" src="${e.file}"></audio><a href="${e.file}" download>Download labeled WAV</a></article>`).join("")}<h2>Keep the example</h2><p><a href="composer-project.json" download>Re-openable Composer demonstration</a> · <a href="manifest.json" download>Source credits, checksums and event schedules</a></p><p>Field clip and seed estimates: ${source.source.attribution} ${source.source.license}. Research annotations: Sharma et al., DOI ${contextSource.doi}, CC BY 4.0. The research exchange is not mapped to this field clip or creation. Meaning to sperm whales is unknown.</p><h2>Five-minute human check · not yet observed</h2><ul><li>Can you distinguish field sound from synthetic timing?</li><li>Are uniform lengthening and the first-gap edit perceptible and understandable?</li><li>Is playback comfortable on your chosen ordinary hardware?</li><li>Can you save and reopen the phrase without developer coaching?</li><li>Does a real phone deliver and reopen the files?</li></ul><script>const clips=[...document.querySelectorAll('audio')];function stop(except){clips.forEach(a=>{if(a!==except){a.pause();a.currentTime=0;}});}clips.forEach(a=>a.addEventListener('play',()=>stop(a)));document.getElementById('stop').addEventListener('click',()=>stop());window.addEventListener('pagehide',()=>stop());</script></body></html>`,
);
console.log(
  JSON.stringify({
    preparedFiles: entries.map((e) => e.file),
    fieldHashVerified: true,
    providerRequests: 0,
    humanListening: "not performed",
  }),
);
