import { it } from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../server/worker.ts";
import { buildEvidence } from "../src/domain/evidence.ts";
import { recordings } from "../src/domain/catalog.ts";
import type { CompletedInvestigation } from "../src/investigation.ts";
import {
  assistantMessage,
  explanation,
  finalOutput,
  functionOutput,
  identifierExplanation,
  INTERMEDIATE_TEXT,
  mixedOutput,
  mixedTransport,
  requestFor,
  responsePayload,
  scriptedTransport,
  TEST_ENV,
} from "./fixtures/provider.ts";

it("accepts supplied numeric filenames, source IDs and metric labels after actual retrieval", async () => {
  const mock = scriptedTransport([
    functionOutput(),
    finalOutput(identifierExplanation()),
  ]);
  const response = await createWorker({ transport: mock.transport }).fetch(
    requestFor(),
    TEST_ENV,
  );
  assert.equal(response.status, 200);
  const result = (await response.json()) as CompletedInvestigation;
  assert.deepEqual(result.explanation, identifierExplanation());
  assert.equal(result.execution, "mock-transport-test");
});

it("mixed assistant commentary and function call dispatch tools before accepting the final answer", async () => {
  const mock = mixedTransport();
  const response = await createWorker({ transport: mock.transport }).fetch(
    requestFor(),
    TEST_ENV,
  );
  assert.equal(response.status, 200);
  const result = (await response.json()) as CompletedInvestigation;
  assert.deepEqual(result.explanation, identifierExplanation());
  assert.equal(result.actions.at(-1)?.name, "find_alternatives");
  assert.equal(result.execution, "mock-transport-test");
  assert.equal(mock.calls.length, 2);
  const replay = mock.calls[1].payload.input as Record<string, unknown>[];
  assert.deepEqual(replay.slice(2, 5), mixedOutput().output);
  assert.equal(replay[3].phase, "commentary");
  assert.equal(replay[5].type, "function_call_output");
  assert.equal(replay[5].call_id, "call_mock_0");
  const toolResult = JSON.parse(String(replay[5].output));
  assert.equal(toolResult.result.matches[0].sourceId, "dswp-11");
  assert.ok(
    toolResult.evidence.some(
      (item: { id: string }) => item.id === "recording:dswp-11",
    ),
  );
  assert.equal("include" in mock.calls[0].payload, false);
  const packet = JSON.stringify(
    buildEvidence(recordings[0], recordings[1], "absolute", undefined, result),
  );
  for (const hidden of [
    INTERMEDIATE_TEXT,
    "test-opaque-reasoning-do-not-export",
    "msg_mock_intermediate",
    TEST_ENV.OPENAI_API_KEY,
  ])
    assert.ok(!packet.includes(hidden));
});

function withText(text: string) {
  const value = identifierExplanation();
  value.possibleInterpretations[0].text = text;
  return value;
}

for (const text of [
  "The available alternative is 11.wav.",
  "The recording is `dswp-11`; inspect its measurements separately.",
  "The comparison uses Mean absolute normalized interval difference v1.0.0.",
  "The supplied metric version is v1.0.0.",
]) {
  it(`accepts an exact supplied label: ${text}`, async () => {
    const mock = scriptedTransport([
      functionOutput(),
      finalOutput(withText(text)),
    ]);
    assert.equal(
      (
        await createWorker({ transport: mock.transport }).fetch(
          requestFor(),
          TEST_ENV,
        )
      ).status,
      200,
    );
  });
}

for (const text of [
  "Another example is 99.wav.",
  "Another example is dswp-99.",
  "Another example is 111.wav.",
  "Another example is copy-dswp-11.",
  "Another example is dswp-11x.",
  "Another example is 11.wav.backup.",
  "The comparison uses normalized-interval-mad v9.0.0.",
  "The distance for 11.wav is 0.09.",
  "The distance is 11.",
  "See https://example.com/11.wav for evidence.",
]) {
  it(`rejects unmatched digits/URLs, without substring exceptions: ${text}`, async () => {
    const mock = scriptedTransport([
      functionOutput(),
      finalOutput(withText(text)),
    ]);
    const response = await createWorker({ transport: mock.transport }).fetch(
      requestFor(),
      TEST_ENV,
    );
    assert.equal(
      ((await response.json()) as { code: string }).code,
      "UNSUPPORTED_GENERATED_CONTENT",
    );
  });
}

it("a known catalog filename needs supplied recording evidence, not merely a catalog ID", async () => {
  const value = explanation();
  value.possibleInterpretations[0].text = "Another example is 11.wav.";
  const mock = scriptedTransport([finalOutput(value)]);
  const response = await createWorker({ transport: mock.transport }).fetch(
    requestFor(),
    TEST_ENV,
  );
  assert.equal(
    ((await response.json()) as { code: string }).code,
    "UNSUPPORTED_GENERATED_CONTENT",
  );
});

it("the lexical restriction does not certify a spelled-out numerical statement", async () => {
  const value = explanation();
  value.possibleInterpretations[0].text = "The distance is ninety-nine.";
  const mock = scriptedTransport([finalOutput(value)]);
  const response = await createWorker({ transport: mock.transport }).fetch(
    requestFor(),
    TEST_ENV,
  );
  assert.equal(response.status, 200);
  const result = (await response.json()) as CompletedInvestigation;
  assert.equal(
    result.explanation.possibleInterpretations[0].text,
    value.possibleInterpretations[0].text,
  );
  const comparison = result.evidence.find((item) => item.kind === "comparison");
  assert.deepEqual(
    comparison?.comparison,
    buildEvidence(recordings[0], recordings[1], "absolute").comparison,
  );
});

for (const phase of [undefined, null, "commentary", "final_answer"] as const) {
  it(`a message accompanying a tool call is intermediate even with phase ${phase}`, async () => {
    const first = mixedOutput(
      assistantMessage(
        JSON.stringify({ unaccepted: "not final evidence" }),
        phase,
      ),
    );
    const mock = scriptedTransport([
      first,
      finalOutput(identifierExplanation()),
    ]);
    const response = await createWorker({ transport: mock.transport }).fetch(
      requestFor(),
      TEST_ENV,
    );
    assert.equal(response.status, 200);
    const result = (await response.json()) as CompletedInvestigation;
    assert.deepEqual(result.explanation, identifierExplanation());
    assert.deepEqual(
      (mock.calls[1].payload.input as unknown[])[3],
      first.output[1],
    );
    assert.ok(!JSON.stringify(result).includes("not final evidence"));
  });
}

for (const [label, patch] of [
  ["wrong role", { role: "user" }],
  ["incomplete message", { status: "in_progress" }],
  ["unknown phase", { phase: "thinking" }],
  ["invalid phase type", { phase: {} }],
  ["empty content", { content: [] }],
  [
    "wrong content type",
    { content: [{ type: "input_text", text: "not output" }] },
  ],
  [
    "oversized text",
    { content: [{ type: "output_text", text: "a".repeat(8193) }] },
  ],
  ["refusal", { content: [{ type: "refusal", refusal: "Cannot comply." }] }],
] as const) {
  it(`rejects mixed output with ${label} before another provider request`, async () => {
    const valid = mixedOutput();
    const mock = scriptedTransport([
      {
        ...valid,
        output: [
          valid.output[0],
          { ...assistantMessage(INTERMEDIATE_TEXT, "commentary"), ...patch },
          valid.output[2],
        ],
      },
    ]);
    const response = await createWorker({ transport: mock.transport }).fetch(
      requestFor(),
      TEST_ENV,
    );
    assert.ok(response.status >= 400);
    const failure = (await response.json()) as { status: string; code: string };
    assert.equal(failure.status, "failed");
    if (label === "refusal") assert.equal(failure.code, "PROVIDER_REFUSAL");
    assert.equal(mock.calls.length, 1);
  });
}

it("does not accept commentary-only JSON as a final explanation", async () => {
  const mock = scriptedTransport([
    responsePayload([
      assistantMessage(JSON.stringify(explanation()), "commentary"),
    ]),
  ]);
  const response = await createWorker({ transport: mock.transport }).fetch(
    requestFor(),
    TEST_ENV,
  );
  assert.equal(
    ((await response.json()) as { status: string }).status,
    "failed",
  );
});

it("keeps one-call/one-message bounds and rejects duplicate calls in mixed rounds", async () => {
  const first = mixedOutput();
  for (const outputs of [
    [
      responsePayload([
        ...first.output,
        assistantMessage("Additional message", "commentary"),
      ]),
    ],
    [
      responsePayload([
        ...first.output,
        functionOutput("compare_selected", {}, 1).output[1],
      ]),
    ],
    [first, first],
  ]) {
    const mock = scriptedTransport(outputs);
    const response = await createWorker({ transport: mock.transport }).fetch(
      requestFor(),
      TEST_ENV,
    );
    assert.equal(
      ((await response.json()) as { status: string }).status,
      "failed",
    );
    assert.equal(mock.calls.length, outputs.length);
  }
});

it("mixed output still rejects unknown tools and forged arguments", async () => {
  for (const tool of [
    functionOutput("unknown_tool"),
    functionOutput("recording_details", {
      sourceId: "dswp-1",
      measurements: { value: 0 },
    }),
  ]) {
    const mock = scriptedTransport([
      responsePayload([
        assistantMessage(INTERMEDIATE_TEXT, "commentary"),
        ...tool.output,
      ]),
    ]);
    assert.ok(
      (
        await createWorker({ transport: mock.transport }).fetch(
          requestFor(),
          TEST_ENV,
        )
      ).status >= 400,
    );
    assert.equal(mock.calls.length, 1);
  }
});
