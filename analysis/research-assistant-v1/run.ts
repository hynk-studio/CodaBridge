import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { cases, modelInput, toolEvidence, VERSION } from "./cases.ts";
import { fixtureTransport } from "./fixtures.ts";
import { runStructuredCase, score } from "./evaluate.ts";
const root = "analysis/research-assistant-v1/";
const results = [];
for (const c of cases) {
  const f = fixtureTransport(c), run = await runStructuredCase(c, f.transport, new AbortController().signal);
  for (const request of f.requests) { const text = JSON.stringify(request); assert.ok(!text.includes('"expected"') && !text.includes('"family"') && !text.includes('"recipe"')); }
  results.push({ execution: "fixture-only; no model invocation", ...score(c,run), input: run.input, output: run.answer, issued: run.issued, fixtureTransportRounds: f.requests.length });
}
const artifacts = {
  "model-inputs.json": { version: VERSION, modality: "structured-evidence-only", cases: cases.map(c => ({ split: c.split, input: modelInput(c), availableTools: ["measure_timing","inspect_overlap","inspect_spectrum","inspect_context"] })) },
  "answer-key.json": { version: VERSION, hiddenFromRequests: true, cases: cases.map(c => ({ id:c.id,split:c.split,family:c.family,recipe:{a:c.a,b:c.b,pulse:c.pulse ?? "click-pulse-1",rendererVersion:"click-pulse-1 / eval-pulse-6000-v1",seed:null},expected:c.expected,requiredTools:c.required,abstentions:c.abstain,evidence:c.required.map(t=>toolEvidence(c,t)) })) },
  "fixture-results.json": { version: VERSION, execution: "fixture-only", actualModelRuns: 0, actualAudioInputs: 0, modelQualityScore: null, perceptionScore: null, results },
};
for (const [path,data] of Object.entries(artifacts)) {
  const text = JSON.stringify(data,null,2)+"\n";
  if (process.argv.includes("--check")) assert.equal(readFileSync(root+path,"utf8"),text); else writeFileSync(root+path,text);
}
console.log("10/10 fixture orchestrations completed; 5 development and 5 distinct evaluation recipe families. Actual model runs: 0. Interpretation/next-check usefulness: unscored.");
