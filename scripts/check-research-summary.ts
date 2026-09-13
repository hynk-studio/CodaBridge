import { readFileSync } from "node:fs";
import { validateResearchSummary } from "../src/lab/researchPrediction.ts";
const bytes = readFileSync("public/prediction-v02/summary.json");
if (bytes.length > 262144) throw new Error("V0.2_SUMMARY_SIZE_BOUND");
const s = validateResearchSummary(JSON.parse(bytes.toString()));
console.log(JSON.stringify({ status: "V0.2 BROWSER SCHEMA PASS", bytes: bytes.length, studies: s.studies.map(s => ({ id: s.id, status: s.status })), selectedExamples: s.examples.length }));
