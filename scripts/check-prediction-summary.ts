import { readFileSync } from "node:fs";
import { validatePredictionSummary } from "../src/lab/prediction.ts";
const summary = validatePredictionSummary(JSON.parse(readFileSync("public/prediction/summary.json", "utf8")));
console.log(JSON.stringify({ schema: summary.schemaVersion, status: summary.status, selectedExamples: summary.selectedExamples.length }));
