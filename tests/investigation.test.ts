import { it } from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../server/worker.ts";
import { createAnalysisTools } from "../server/tools.ts";
import { LIMITS } from "../server/provider.ts";
import {
  recordings,
  selectionBinding,
  selectionKey,
} from "../src/domain/catalog.ts";
import { compareTiming } from "../src/domain/timing.ts";
import { buildEvidence, timingInput } from "../src/domain/evidence.ts";
import { measuredObservation } from "../src/domain/observation.ts";
import type { CompletedInvestigation } from "../src/investigation.ts";
import {
  explanation,
  finalOutput,
  functionOutput,
  happyTransport,
  inputFor,
  requestFor,
  scriptedTransport,
  TEST_ENV,
} from "./fixtures/provider.ts";

const [a, b, alternative, unequal] = recordings;
it("mock transport exercises the real handler, retrieval, reference validation and receipts", async () => {
  const mock = happyTransport();
  const response = await createWorker({ transport: mock.transport }).fetch(
    requestFor(),
    TEST_ENV,
  );
  assert.equal(response.status, 200);
  const result = (await response.json()) as CompletedInvestigation;
  assert.equal(result.execution, "mock-transport-test");
  assert.deepEqual(result.binding, selectionBinding(a, b));
  assert.equal(result.providerResponses.length, 2);
  assert.deepEqual(result.providerResponses[1].usage, {
    inputTokens: 100,
    outputTokens: 30,
    totalTokens: 130,
  });
  const comparison = result.evidence.find((e) => e.kind === "comparison");
  assert.equal(comparison?.kind, "comparison");
  assert.deepEqual(
    comparison.comparison,
    compareTiming(timingInput(a), timingInput(b)),
  );
  const retrieval = result.evidence.find((e) => e.kind === "retrieval");
  assert.equal(retrieval?.kind, "retrieval");
  assert.deepEqual(
    retrieval.matches.map((r) => r.sourceId),
    [alternative.id],
  );
  assert.equal(retrieval.rejected[0].sourceId, unequal.id);
  assert.equal(retrieval.rejected[0].comparison.status, "not-comparable");
  assert.equal(result.actions.at(-1)?.initiatedBy, "model");
  assert.ok(
    JSON.stringify(mock.calls[1].payload).includes(
      "test-opaque-reasoning-do-not-export",
    ),
  );
  assert.ok(
    !JSON.stringify(result).includes("test-opaque-reasoning-do-not-export"),
  );
  assert.ok(!JSON.stringify(result).includes(TEST_ENV.OPENAI_API_KEY));
  assert.equal(
    buildEvidence(a, b, "absolute", undefined, result).investigation?.status,
    "completed",
  );
  assert.equal(
    buildEvidence(b, a, "absolute", undefined, result).investigation,
    null,
  );
  assert.equal(response.headers.get("cache-control"), "no-store");
});

it("availability and valid requests stay disabled without both explicit gates and a server key", async () => {
  const mock = happyTransport();
  const worker = createWorker({ transport: mock.transport });
  for (const env of [
    {},
    { OPENAI_API_KEY: TEST_ENV.OPENAI_API_KEY },
    { ...TEST_ENV, CODABRIDGE_ACCESS_REVIEWED: "false" },
    { ...TEST_ENV, OPENAI_API_KEY: "" },
  ]) {
    const status = await worker.fetch(
      new Request("http://localhost/api/investigation/status"),
      env,
    );
    assert.equal(
      ((await status.json()) as { status: string }).status,
      "unavailable",
    );
    assert.equal((await worker.fetch(requestFor(), env)).status, 503);
  }
  assert.equal(mock.calls.length, 0);
});

it("rejects malformed, oversized, unknown, forged and stale requests before any provider call", async () => {
  const mock = happyTransport();
  const worker = createWorker({ transport: mock.transport });
  const cases: unknown[] = [
    null,
    [],
    {},
    { ...inputFor(), sourceIds: [a.id] },
    { ...inputFor(), sourceIds: ["invented", b.id] },
    { ...inputFor(), question: " " },
    { ...inputFor(), question: "a".repeat(801) },
    { ...inputFor(), selectionKey: "stale" },
    { ...inputFor(), measurements: { value: 0 } },
    { ...inputFor(), OPENAI_API_KEY: "visitor-key" },
  ];
  for (const value of cases)
    assert.ok((await worker.fetch(requestFor(value), TEST_ENV)).status >= 400);
  for (const body of ["{", "x".repeat(LIMITS.requestBytes + 1)]) {
    const response = await worker.fetch(
      new Request("http://localhost/api/investigate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
      TEST_ENV,
    );
    assert.ok(response.status >= 400);
  }
  const bytes = new TextEncoder().encode(" ".repeat(LIMITS.requestBytes + 1));
  const streamRequest = new Request("http://localhost/api/investigate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: new ReadableStream({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    }),
    duplex: "half",
  } as RequestInit);
  assert.equal((await worker.fetch(streamRequest, TEST_ENV)).status, 413);
  assert.equal(mock.calls.length, 0);
});

it("requires same-origin JSON POST and handles unknown API paths", async () => {
  const worker = createWorker();
  for (const [request, expected] of [
    [new Request("http://localhost/api/investigate"), 405],
    [new Request("http://localhost/api/missing"), 404],
    [
      new Request("http://localhost/api/investigate", {
        method: "POST",
        body: "x",
      }),
      415,
    ],
    [
      new Request("http://localhost/api/investigate", {
        method: "POST",
        headers: { origin: "https://untrusted.example" },
      }),
      403,
    ],
  ] as const)
    assert.equal((await worker.fetch(request)).status, expected);
});

it("rejects invalid tool arguments, arbitrary tools, forged measurements and invented references", async () => {
  const forged = {
    ...explanation(),
    measurements: { normalizedIntervalMad: 0 },
  };
  const outputs = [
    functionOutput("fetch_url", { url: "https://example.com" }),
    functionOutput("recording_details", { sourceId: "unknown" }),
    functionOutput("recording_details", {
      sourceId: a.id,
      measurements: { value: 0 },
    }),
    functionOutput("compare_selected", { sourceIds: [a.id, b.id] }),
    functionOutput("find_alternatives", { referenceId: a.id, limit: 3 }),
    functionOutput("find_alternatives", {
      referenceId: alternative.id,
      limit: 1,
    }),
    finalOutput(explanation("source:invented")),
    finalOutput(forged),
    finalOutput({
      ...explanation(),
      possibleInterpretations: [
        { text: "The distance is 99.", evidenceIds: ["recording:dswp-1"] },
      ],
    }),
  ];
  for (const payload of outputs) {
    const mock = scriptedTransport([payload]);
    const response = await createWorker({ transport: mock.transport }).fetch(
      requestFor(),
      TEST_ENV,
    );
    assert.ok(response.status >= 400);
    assert.equal(
      ((await response.json()) as { status: string }).status,
      "failed",
    );
    assert.equal(mock.calls.length, 1);
  }
});

it("retrieval excludes both selected recordings and byte-identical duplicates", () => {
  const duplicateA = { ...structuredClone(a), id: "copy-of-a" };
  const duplicateAlternative = {
    ...structuredClone(alternative),
    id: "zz-copy-of-alternative",
  };
  const tools = createAnalysisTools(
    [a, b],
    [...recordings, duplicateA, duplicateAlternative],
  );
  const result = tools.dispatch("find_alternatives", {
    referenceId: a.id,
    limit: 2,
  });
  assert.equal(result.kind, "retrieval");
  assert.deepEqual(
    result.matches.map((r) => r.sourceId),
    [alternative.id],
  );
  assert.deepEqual(result.excludedDuplicates, [
    duplicateA.id,
    duplicateAlternative.id,
  ]);
  assert.equal(result.candidateCount, 2);
});

it("retains no-match, empty catalog and unequal-count results without alignment", () => {
  const noCandidates = createAnalysisTools([a, b], [a, b]).dispatch(
    "find_alternatives",
    { referenceId: a.id, limit: 2 },
  );
  assert.equal(noCandidates.kind, "retrieval");
  assert.equal(noCandidates.status, "no-match");
  assert.equal(noCandidates.candidateCount, 0);
  const incompatible = createAnalysisTools([unequal, a]).dispatch(
    "find_alternatives",
    { referenceId: unequal.id, limit: 2 },
  );
  assert.equal(incompatible.kind, "retrieval");
  assert.equal(incompatible.status, "no-match");
  assert.equal(incompatible.rejected.length, 2);
  assert.ok(
    incompatible.rejected.every(
      (r) =>
        r.comparison.status === "not-comparable" &&
        r.comparison.code === "UNEQUAL_CLICK_COUNTS",
    ),
  );
});

it("provider failure, refusal, incomplete and oversized outputs do not retry or leak errors", async () => {
  const refusal = {
    ...finalOutput(),
    output: [
      {
        type: "message",
        role: "assistant",
        status: "completed",
        content: [{ type: "refusal", refusal: TEST_ENV.OPENAI_API_KEY }],
      },
    ],
  };
  for (const output of [
    new Error(TEST_ENV.OPENAI_API_KEY),
    new Response(TEST_ENV.OPENAI_API_KEY, { status: 429 }),
    new Response("x".repeat(LIMITS.providerBytes + 1)),
    { ...finalOutput(), status: "incomplete" },
    refusal,
    finalOutput({
      ...explanation(),
      possibleInterpretations: [
        { text: TEST_ENV.OPENAI_API_KEY, evidenceIds: ["recording:dswp-1"] },
      ],
    }),
  ]) {
    const mock = scriptedTransport([output]);
    const response = await createWorker({ transport: mock.transport }).fetch(
      requestFor(),
      TEST_ENV,
    );
    assert.ok(response.status >= 400);
    assert.ok(!(await response.text()).includes(TEST_ENV.OPENAI_API_KEY));
    assert.equal(mock.calls.length, 1);
  }
});

it("deadline aborts a hanging provider even when its mocked transport ignores abort", async () => {
  let signal: AbortSignal | null | undefined;
  const worker = createWorker({
    deadlineMs: 15,
    transport: async (_url, init) => {
      signal = init.signal;
      return new Promise(() => {});
    },
  });
  const response = await worker.fetch(requestFor(), TEST_ENV);
  assert.equal(response.status, 504);
  assert.equal(signal?.aborted, true);
});

it("deadline also bounds streaming request and provider bodies", async () => {
  const worker = createWorker({
    deadlineMs: 15,
    transport: async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode("{"));
          },
        }),
      ),
  });
  assert.equal((await worker.fetch(requestFor(), TEST_ENV)).status, 504);
  const request = new Request("http://localhost/api/investigate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: new ReadableStream(),
    duplex: "half",
  } as RequestInit);
  assert.equal((await worker.fetch(request, TEST_ENV)).status, 504);
});

it("excessive tool rounds stop at the fixed budget", async () => {
  const mock = scriptedTransport(
    Array.from({ length: 6 }, (_, i) =>
      functionOutput("compare_selected", {}, i),
    ),
  );
  const response = await createWorker({ transport: mock.transport }).fetch(
    requestFor(),
    TEST_ENV,
  );
  assert.equal(
    ((await response.json()) as { code: string }).code,
    "TOOL_ROUND_LIMIT",
  );
  assert.equal(mock.calls.length, LIMITS.rounds);
});

it("caller cancellation stops the provider path", async () => {
  const controller = new AbortController();
  const request = new Request(requestFor(), { signal: controller.signal });
  const worker = createWorker({
    transport: async () => {
      controller.abort();
      return new Promise(() => {});
    },
  });
  assert.equal((await worker.fetch(request, TEST_ENV)).status, 504);
});

it("measurement labels are deterministic and binding changes with selection or versions", () => {
  assert.match(
    measuredObservation(timingInput(a), timingInput(b)),
    /0.119 s in A/,
  );
  assert.match(
    measuredObservation(timingInput(a), timingInput(b)),
    /shorter in A/,
  );
  const changed = structuredClone(a);
  changed.annotation.version = "2.0.0";
  assert.notEqual(selectionKey(a, b), selectionKey(changed, b));
  assert.notEqual(selectionKey(a, b), selectionKey(b, a));
});

it("missing provider metadata stays absent rather than being fabricated", async () => {
  const payload = finalOutput();
  const mock = scriptedTransport([
    { status: payload.status, output: payload.output },
  ]);
  const response = await createWorker({ transport: mock.transport }).fetch(
    requestFor(),
    TEST_ENV,
  );
  const result = (await response.json()) as CompletedInvestigation;
  assert.equal(result.status, "completed");
  assert.deepEqual(result.providerResponses, [{}]);
});
