import { it } from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../server/worker.ts";
import { labTools, parseLabRequest } from "../server/lab.ts";
import {
  TEST_ENV,
  finalOutput,
  functionOutput,
  scriptedTransport,
  responsePayload,
} from "./fixtures/provider.ts";
import {
  labInput,
  labRequest,
  labTransport,
  labExplanation,
} from "./fixtures/lab-provider.ts";
import { contextSegment, labBinding } from "../src/lab/catalog.ts";
import { comparePairing } from "../src/lab/model.ts";
import { investigationPacket } from "../src/lab/export.ts";
import type { LabResult } from "../src/lab/contract.ts";
import type { ProviderTransport } from "../server/provider.ts";

it("Lab model access is server-disabled by default, including direct POSTs", async () => {
  const mock = labTransport(),
    worker = createWorker(mock);
  for (const env of [
    {},
    { ...TEST_ENV, OPENAI_API_KEY: undefined },
    { ...TEST_ENV, CODABRIDGE_ACCESS_REVIEWED: "false" },
    { ...TEST_ENV, CODABRIDGE_INVESTIGATION_ENABLED: "false" },
  ]) {
    const response = await worker.fetch(labRequest(), env);
    assert.equal(response.status, 503);
    assert.equal((await response.json()).code, "NOT_CONFIGURED");
  }
  assert.equal(mock.calls.length, 0);
});

it("TEST ONLY Lab dispatches selected control, replays actual evidence and accepts cited numeric prose without exporting reasoning", async () => {
  const input = labInput(),
    before = structuredClone(input),
    sourceBefore = structuredClone(contextSegment),
    mock = labTransport();
  const response = await createWorker(mock).fetch(labRequest(input), TEST_ENV),
    result = (await response.json()) as LabResult;
  assert.equal(response.status, 200);
  assert.equal(result.execution, "mock-transport-test");
  assert.equal(mock.calls.length, 2);
  assert.equal(result.providerResponses.length, 2);
  assert.equal(result.binding, input.binding);
  assert.deepEqual(
    result.comparison,
    comparePairing(contextSegment, input.offset),
  );
  assert.deepEqual(
    result.actions.map((a) => [a.name, a.initiatedBy]),
    [
      ["exchange_info", "server"],
      ["compare_observed_pairing", "server"],
      ["control_result", "model"],
    ],
  );
  assert.deepEqual(result.actions.at(-1)!.arguments, {
    segmentId: input.segmentId,
    offset: 1,
  });
  assert.deepEqual(result.explanation, labExplanation());
  assert.ok(
    result.explanation.possibleInterpretations.every((item) =>
      item.evidenceIds.every((id) => result.evidence.some((e) => e.id === id)),
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(result),
    /encrypted_content|test-opaque|intermediate commentary|TEST_ONLY_NOT_A_CREDENTIAL/,
  );
  assert.deepEqual(input, before);
  assert.deepEqual(contextSegment, sourceBefore);
  const exported = investigationPacket(
    input.question,
    input.offset,
    input.selectedRowId,
    result,
  );
  assert.deepEqual(exported.generated, result);
  assert.match(exported.savedAnalysisStatus, /Historical/);
  assert.throws(
    () => investigationPacket(input.question, 2, input.selectedRowId, result),
    /Obsolete/,
  );
});

it("source-bound Lab tools recompute observed results and reject unknown IDs, offsets, extra fields and arbitrary tools", () => {
  const input = labInput(),
    tools = labTools(input);
  for (const [name, args] of [
    ["invented", {}],
    ["exchange_info", { segmentId: input.segmentId, rowId: "invented" }],
    ["exchange_info", { segmentId: "invented", rowId: input.selectedRowId }],
    ["control_result", { segmentId: input.segmentId, offset: 9 }],
    ["control_result", { segmentId: input.segmentId, offset: 1, distance: 0 }],
    [
      "compare_observed_pairing",
      { segmentId: input.segmentId, url: "https://example.invalid" },
    ],
  ] as const)
    assert.throws(() => tools.dispatch(name, args));
  const row = tools.dispatch("exchange_info", {
    segmentId: input.segmentId,
    rowId: contextSegment.calls[1].id,
  });
  assert.equal(row.kind, "exchange_info");
  const observed = tools.dispatch("compare_observed_pairing", {
    segmentId: input.segmentId,
  });
  assert.deepEqual(
    (observed.data as { observed: unknown }).observed,
    comparePairing(contextSegment, 0).observed,
  );
});

it("bad request bindings and forged authoritative fields reject before any provider request", async () => {
  const mock = labTransport(),
    worker = createWorker(mock),
    input = labInput();
  for (const patch of [
    { datasetId: "other" },
    { segmentId: "other" },
    { callers: ["2", "1"] },
    { selectedRowId: "other" },
    { offset: 1.2 },
    { offset: -1 },
    { offset: 9 },
    { binding: "stale" },
    { offset: 2 },
    { score: 0 },
    { question: "x".repeat(801) },
  ]) {
    const response = await worker.fetch(
      labRequest({ ...input, ...patch }),
      TEST_ENV,
    );
    assert.ok(response.status >= 400);
  }
  assert.equal(mock.calls.length, 0);
  assert.notEqual(
    labBinding(1, input.selectedRowId),
    labBinding(2, input.selectedRowId),
  );
  assert.notEqual(
    labBinding(1, input.selectedRowId),
    labBinding(1, contextSegment.calls[1].id),
  );
  assert.equal(parseLabRequest(input).binding, input.binding);
});

it("Lab validates shape, structured citations, refusals, URLs and secrets; prose cannot supply trusted scores", async () => {
  const input = labInput(),
    reference = `compare_observed_pairing:${contextSegment.id}`;
  const simple = (text: string, ref = reference) => ({
    possibleInterpretations: [{ text, evidenceIds: [ref] }],
    limitations: [
      {
        text: "A descriptive control does not establish meaning.",
        evidenceIds: [reference],
      },
    ],
  });
  for (const final of [
    simple("Invented reference", "missing"),
    simple("See https://example.invalid"),
    simple(TEST_ENV.OPENAI_API_KEY),
    { ...simple("hello"), score: 0 },
    { possibleInterpretations: [], limitations: [] },
    { operations: [{ op: "delete_source" }] },
    simple("x".repeat(601)),
  ]) {
    const response = await createWorker(
      scriptedTransport([finalOutput(final)]),
    ).fetch(labRequest(input), TEST_ENV);
    assert.ok(response.status >= 400);
  }
  const refusal = responsePayload([
    {
      type: "message",
      id: "m",
      role: "assistant",
      status: "completed",
      content: [{ type: "refusal", refusal: "TEST ONLY refusal" }],
    },
  ]);
  const rejected = await createWorker(scriptedTransport([refusal])).fetch(
    labRequest(input),
    TEST_ENV,
  );
  assert.equal(rejected.status, 502);
  const incorrect = "The observed value is 99 seconds and proves translation.";
  const accepted = await createWorker(
    scriptedTransport([finalOutput(simple(incorrect))]),
  ).fetch(labRequest(input), TEST_ENV);
  assert.equal(accepted.status, 200);
  const result = (await accepted.json()) as LabResult;
  assert.equal(result.explanation.possibleInterpretations[0].text, incorrect); // Limitation, not a factuality pass.
  const packet = investigationPacket(
    input.question,
    input.offset,
    input.selectedRowId,
    result,
  );
  assert.deepEqual(packet.comparison, comparePairing(contextSegment, 1));
  assert.notEqual(packet.comparison.observed.valueSeconds, 99);
  assert.match(packet.savedAnalysisStatus, /Historical/);
});

it("unknown tool, duplicate calls, rounds, deadlines and cross-origin constraints remain finite", async () => {
  const input = labInput(),
    call = functionOutput("control_result", {
      segmentId: input.segmentId,
      offset: 1,
    });
  const duplicate = scriptedTransport([call, call]);
  const rejected = await createWorker(duplicate).fetch(labRequest(), TEST_ENV);
  assert.equal(rejected.status, 502);
  assert.equal(duplicate.calls.length, 2);
  const loop = scriptedTransport(
    Array.from({ length: 4 }, (_, i) =>
      functionOutput(
        "control_result",
        { segmentId: input.segmentId, offset: i },
        i,
      ),
    ),
  );
  const bounded = await createWorker(loop).fetch(labRequest(), TEST_ENV);
  assert.equal((await bounded.json()).code, "TOOL_ROUND_LIMIT");
  assert.equal(loop.calls.length, 4);
  const unknown = await createWorker(
    scriptedTransport([functionOutput("execute_code", {})]),
  ).fetch(labRequest(), TEST_ENV);
  assert.equal((await unknown.json()).code, "UNKNOWN_TOOL");
  const slow: ProviderTransport = async (_url, init) =>
    new Promise((_resolve, reject) =>
      init.signal!.addEventListener(
        "abort",
        () => reject(new Error("TEST ONLY aborted")),
        { once: true },
      ),
    );
  const timeout = await createWorker({ transport: slow, deadlineMs: 5 }).fetch(
    labRequest(),
    TEST_ENV,
  );
  assert.equal(timeout.status, 504);
  assert.equal((await timeout.json()).code, "TIMEOUT");
  const cross = labRequest();
  cross.headers.set("origin", "https://other.invalid");
  const response = await createWorker(labTransport()).fetch(cross, TEST_ENV);
  assert.equal(response.status, 403);
});
