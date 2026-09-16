// TEST ONLY. Deterministic Responses fixtures, never a production import or live call.
import assert from "node:assert/strict";
import {
  contextSegment,
  DATASET_ID,
  DEFAULT_LAB_QUESTION,
  labBinding,
} from "../../src/lab/catalog.ts";
import { comparePairing } from "../../src/lab/model.ts";
import {
  MODEL,
  RESPONSES_URL,
  type ProviderTransport,
} from "../../server/provider.ts";
import { assistantMessage, functionOutput, finalOutput } from "./provider.ts";

// Exact saved v5 output, reused only as a rejection fixture (not a new live run).
export const HOSTED_INCOMPLETE_EXPLANATION = {
  possibleInterpretations: [{
    text: "Measured duration similarity varies with reassignment, but the observed pairing is not uniquely closest. Across seven fixed positive-overlap pairs, the observed mean absolute duration gap is 0.13286695714285718 seconds; selected offset 1 gives 0.1438996285714286 seconds (a larger gap means less similar durations). The eight distinct nonzero controls, with no equivalent controls, range from 0.08378658571428575 to 0.19408779999999992 seconds, with median 0.16526225714285714. Two controls have smaller gaps than observed. Tentatively, this shows sensitivity to duration assignment, not evidence by—",
    evidenceIds: ["compare_observed_pairing:sw061b001_124-from-row-2-60s-v1"],
  }],
  limitations: [{
    text: "The selected control was inspected, but the interpretation above is incomplete; no causal or semantic conclusion follows.",
    evidenceIds: ["control_result:sw061b001_124-from-row-2-60s-v1:1"],
  }],
};

export function labInput(offset = 1) {
  const selectedRowId = contextSegment.calls[0].id;
  return {
    datasetId: DATASET_ID,
    segmentId: contextSegment.id,
    callers: contextSegment.callers,
    offset,
    selectedRowId,
    binding: labBinding(offset, selectedRowId),
    question: DEFAULT_LAB_QUESTION,
  };
}
export function labRequest(input: unknown = labInput()) {
  return new Request("http://localhost/api/lab", {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}
export function labExplanation(offset = 1, prose?: string) {
  const result = comparePairing(contextSegment, offset),
    observedId = `compare_observed_pairing:${contextSegment.id}`,
    controlId = `control_result:${contextSegment.id}:${offset}`;
  return {
    comparisonInterpretation: {
      text:
        prose ??
        `The observed mean absolute duration gap is ${result.observed.valueSeconds!.toFixed(6)} seconds across ${result.pairCount} fixed overlap pairs. Control ${offset} gives ${result.selected.valueSeconds!.toFixed(6)} seconds. The ${result.distinctControlCount} controls range from ${result.controlSummary!.minSeconds.toFixed(6)} to ${result.controlSummary!.maxSeconds.toFixed(6)} seconds, so the observed value lies within that range. This one segment does not show that the observed pairing is uniquely close.`,
      evidenceIds: [observedId, controlId],
    },
    alternativeAccounts: [{
      text: "Own persistence, shared setting, coda-type composition and selection offer alternative accounts of similar durations.",
      evidenceIds: [controlId, observedId],
    }],
    annotationUncertainty: {
      text: "Source annotations and reconstructed timing retain uncertainty; they are not original audio. A/B labels are local, not verified animal identities.",
      evidenceIds: [observedId],
    },
    limitations: [
      {
        text: "Duration accepts unequal click counts. Rotation has a seam and may reuse calls. This is a descriptive control, not the paper's permutation test or evidence of causality, independence or whale meaning.",
        evidenceIds: [observedId, controlId],
      },
    ],
  };
}
export function labTransport(prose?: string) {
  const calls: Record<string, unknown>[] = [];
  const transport: ProviderTransport = async (url, init) => {
    assert.equal(url, RESPONSES_URL);
    assert.equal(init.redirect, "manual");
    const payload = JSON.parse(String(init.body));
    calls.push(payload);
    assert.equal(payload.model, MODEL);
    assert.equal(payload.max_output_tokens, 1800);
    assert.deepEqual(payload.reasoning, { effort: "low" });
    assert.equal(payload.text.format.name, "context_lab_investigation");
    const context = JSON.parse(payload.input[0].content);
    const tool = payload.input.find(
      (i: { type?: string }) => i.type === "function_call_output",
    );
    if (!tool) {
      const response = functionOutput("control_result", {
        segmentId: context.selection.segmentId,
        offset: context.selection.offset,
      });
      response.output.unshift(
        assistantMessage(
          "TEST ONLY intermediate commentary: inspecting the selected duration reassignment.",
          "commentary",
        ) as (typeof response.output)[number],
      );
      return Response.json(response);
    }
    const supplied = JSON.parse(tool.output);
    assert.equal(supplied.result.kind, "control_result");
    assert.deepEqual(
      supplied.result.data.pairs,
      comparePairing(contextSegment, context.selection.offset).selected.pairs,
    );
    assert.ok(
      payload.input.some(
        (i: { type?: string; encrypted_content?: string }) =>
          i.type === "reasoning" && i.encrypted_content,
      ),
    );
    return Response.json(
      finalOutput(labExplanation(context.selection.offset, prose)),
    );
  };
  return { transport, calls };
}
