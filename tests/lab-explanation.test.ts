import { it } from "node:test";
import assert from "node:assert/strict";
import { labExplanationSchema, labTools, validateLabExplanation } from "../server/lab.ts";
import { explanationSchema } from "../server/provider.ts";
import { createWorker } from "../server/worker.ts";
import { investigationPacket } from "../src/lab/export.ts";
import type { LabResult } from "../src/lab/contract.ts";
import {
  HOSTED_INCOMPLETE_EXPLANATION,
  labExplanation,
  labInput,
  labRequest,
  labTransport,
} from "./fixtures/lab-provider.ts";
import { TEST_ENV, finalOutput, functionOutput, scriptedTransport } from "./fixtures/provider.ts";

function evidence() {
  const input = labInput(), tools = labTools(input);
  tools.dispatch("exchange_info", { segmentId: input.segmentId, rowId: input.selectedRowId }, "server");
  tools.dispatch("compare_observed_pairing", { segmentId: input.segmentId }, "server");
  tools.dispatch("control_result", { segmentId: input.segmentId, offset: 1 });
  return tools.evidence;
}

it("Lab rejects the exact hosted 600-character em-dash ending, including inside the new provider shape", () => {
  const failed = HOSTED_INCOMPLETE_EXPLANATION;
  assert.equal(failed.possibleInterpretations[0].text.length, 600);
  assert.ok(failed.possibleInterpretations[0].text.endsWith("not evidence by—"));
  assert.throws(() => validateLabExplanation(failed, evidence()), /INVALID_FIELDS/);
  const value = labExplanation();
  value.comparisonInterpretation = structuredClone(failed.possibleInterpretations[0]);
  assert.throws(() => validateLabExplanation(value, evidence()), /INVALID_EXPLANATION/);
});

it("every Lab category requires complete sentence punctuation after trimming", () => {
  for (const field of ["comparisonInterpretation", "alternativeAccounts", "annotationUncertainty", "limitations"] as const) {
    for (const text of ["A sentence that stops before", "A sentence that stops—", "A sentence that stops…"]) {
      const value = labExplanation(), row = value[field];
      (Array.isArray(row) ? row[0] : row).text = `${text}  \n`;
      assert.throws(() => validateLabExplanation(value, evidence()), /INVALID_EXPLANATION/);
    }
  }
  for (const end of [".", "!", "?"]) {
    const value = labExplanation(1, `A complete TEST ONLY sentence${end} \n`);
    assert.equal(validateLabExplanation(value, evidence()).possibleInterpretations[0].text,
      `A complete TEST ONLY sentence${end}`);
  }
});

it("Lab requires all four distinct fields and one to three alternatives and additional limitations", () => {
  const value = labExplanation();
  for (const field of Object.keys(value)) {
    const missing: Record<string, unknown> = { ...value };
    delete missing[field];
    assert.throws(() => validateLabExplanation(missing, evidence()), /INVALID_FIELDS/);
  }
  assert.throws(() => validateLabExplanation({
    possibleInterpretations: [value.comparisonInterpretation], limitations: value.limitations,
  }, evidence()), /INVALID_FIELDS/);
  for (const field of ["alternativeAccounts", "limitations"] as const) {
    for (const rows of [[], null, value[field][0], Array(4).fill(value[field][0])])
      assert.throws(() => validateLabExplanation({ ...value, [field]: rows }, evidence()), /INVALID_EXPLANATION/);
    const maximum = { ...value, [field]: Array(3).fill(value[field][0]) };
    const result = validateLabExplanation(maximum, evidence());
    assert.equal(result[field === "alternativeAccounts" ? "possibleInterpretations" : "limitations"].length, 4);
  }
  const valid = validateLabExplanation(value, evidence());
  assert.equal(valid.possibleInterpretations.length, 2);
  assert.equal(valid.limitations.length, 2);
});

it("Lab has 800-character headroom without truncating generated text", () => {
  for (const length of [600, 601, 800]) {
    const text = "x".repeat(length - 1) + ".";
    assert.equal(validateLabExplanation(labExplanation(1, text), evidence()).possibleInterpretations[0].text, text);
  }
  assert.throws(() => validateLabExplanation(labExplanation(1, "x".repeat(800) + "."), evidence()), /INVALID_TEXT/);
});

it("Lab mapping preserves public arrays, exact evidence IDs and citation order in every category", () => {
  const value = labExplanation(), refs = [...evidence().keys()];
  value.alternativeAccounts.push({ text: "A second TEST ONLY alternative account.", evidenceIds: [refs[2], refs[0]] });
  value.limitations.push({ text: "A second TEST ONLY additional limitation.", evidenceIds: [refs[1], refs[0]] });
  const rows = [value.comparisonInterpretation, ...value.alternativeAccounts, value.annotationUncertainty, ...value.limitations];
  for (const [i, row] of rows.entries()) row.evidenceIds = i % 2 ? [...refs].reverse() : [...refs];
  const before = structuredClone(value);
  const result = validateLabExplanation(value, evidence());
  assert.deepEqual(result, {
    possibleInterpretations: [value.comparisonInterpretation, ...value.alternativeAccounts],
    limitations: [value.annotationUncertainty, ...value.limitations],
  });
  assert.deepEqual([...result.possibleInterpretations, ...result.limitations].map(row => row.evidenceIds), rows.map(row => row.evidenceIds));
  assert.deepEqual(value, before);
  for (const field of ["comparisonInterpretation", "alternativeAccounts", "annotationUncertainty", "limitations"] as const) {
    const invalid = structuredClone(value), row = invalid[field];
    (Array.isArray(row) ? row[0] : row).evidenceIds = ["control_result:wrong-segment:1"];
    assert.throws(() => validateLabExplanation(invalid, evidence()), /INVENTED_REFERENCE/);
  }
});

it("Lab sends the stricter provider schema in both existing rounds without changing the shared A/B schema", async () => {
  const sharedBefore = structuredClone(explanationSchema), mock = labTransport();
  const response = await createWorker(mock).fetch(labRequest(), TEST_ENV);
  assert.equal(response.status, 200);
  assert.equal(mock.calls.length, 2);
  for (const call of mock.calls) {
    const format = (call.text as { format: { strict: boolean; schema: typeof labExplanationSchema } }).format;
    assert.equal(format.strict, true);
    assert.deepEqual(format.schema.required, ["comparisonInterpretation", "alternativeAccounts", "annotationUncertainty", "limitations"]);
    assert.equal(format.schema.additionalProperties, false);
    const properties = format.schema.properties;
    assert.deepEqual(Object.keys(properties), format.schema.required);
    for (const section of [properties.alternativeAccounts, properties.limitations]) {
      assert.equal(section.minItems, 1);
      assert.equal(section.maxItems, 3);
    }
    for (const cited of [properties.comparisonInterpretation, properties.alternativeAccounts.items, properties.annotationUncertainty, properties.limitations.items]) {
      assert.equal(cited.additionalProperties, false);
      assert.deepEqual(cited.required, ["text", "evidenceIds"]);
      assert.equal(cited.properties.text.maxLength, 800);
      assert.equal(cited.properties.evidenceIds.minItems, 1);
      assert.equal(cited.properties.evidenceIds.maxItems, 6);
    }
  }
  assert.deepEqual(explanationSchema, sharedBefore);
  assert.deepEqual(explanationSchema.required, ["possibleInterpretations", "limitations"]);
  for (const section of Object.values(explanationSchema.properties)) {
    assert.equal(section.minItems, 1);
    assert.equal(section.maxItems, 4);
    assert.equal(section.items.properties.text.maxLength, 600);
  }
});

it("invalid Lab output fails generically after the selected control with no additional provider request or retry", async () => {
  const input = labInput(), valid = labExplanation();
  for (const output of [
    HOSTED_INCOMPLETE_EXPLANATION,
    labExplanation(1, HOSTED_INCOMPLETE_EXPLANATION.possibleInterpretations[0].text),
    labExplanation(1, "This sentence is incomplete"),
    { ...valid, alternativeAccounts: [] },
  ]) {
    const mock = scriptedTransport([
      functionOutput("control_result", { segmentId: input.segmentId, offset: 1 }),
      finalOutput(output),
      finalOutput(valid), // An unauthorized retry would turn the request into a success.
    ]);
    const response = await createWorker(mock).fetch(labRequest(), TEST_ENV);
    assert.ok(response.status >= 400);
    const result = await response.json();
    assert.equal(result.status, "failed");
    assert.equal(result.message, "The investigation could not be validated. Listening and comparison remain available.");
    assert.deepEqual(Object.keys(result), ["status", "code", "message"]);
    assert.equal(mock.calls.length, 2);
  }
});

it("Lab exports retain version 1 and the public result shape, including unchanged historical answers", async () => {
  const input = labInput();
  const response = await createWorker(labTransport()).fetch(labRequest(), TEST_ENV);
  const result = await response.json() as LabResult;
  assert.equal(response.status, 200);
  assert.deepEqual(Object.keys(result), ["status", "binding", "execution", "startedAt", "completedAt", "providerResponses", "actions", "evidence", "comparison", "explanation"]);
  for (const explanation of [result.explanation, HOSTED_INCOMPLETE_EXPLANATION]) {
    const saved = { ...result, explanation }, bytes = JSON.stringify(saved);
    const packet = investigationPacket(input.question, 1, input.selectedRowId, saved);
    assert.equal(packet.format, "codabridge-context-investigation");
    assert.equal(packet.version, 1);
    assert.deepEqual(Object.keys(packet), ["format", "version", "savedAnalysisStatus", "identity", "datasetId", "source", "segment", "question", "selection", "comparison", "generated", "limitations"]);
    assert.equal(JSON.stringify(packet.generated), bytes);
    assert.deepEqual(Object.keys(packet.generated!.explanation), ["possibleInterpretations", "limitations"]);
    assert.doesNotMatch(JSON.stringify(packet), /comparisonInterpretation|alternativeAccounts|annotationUncertainty/);
  }
});
