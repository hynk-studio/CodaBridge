import { it } from "node:test";
import assert from "node:assert/strict";
import { requestResponse, LIMITS } from "../server/provider.ts";
import {
  ERROR_ENVELOPE_BYTES,
  type PrivateProviderDiagnostic,
} from "../server/provider-diagnostics.ts";
import { BoundaryError } from "../server/validation.ts";
import { createWorker } from "../server/worker.ts";
import { buildEvidence } from "../src/domain/evidence.ts";
import { recordings } from "../src/domain/catalog.ts";
import type { CompletedInvestigation } from "../src/investigation.ts";
import {
  functionOutput,
  happyTransport,
  mixedTransport,
  requestFor,
  scriptedTransport,
  TEST_ENV,
} from "./fixtures/provider.ts";
import {
  errorResponse,
  HTTP_ERROR_CASES,
  PRIVATE_SENTINELS,
} from "./fixtures/provider-errors.ts";

const genericFailure = {
  status: "failed",
  code: "PROVIDER_FAILURE",
  message:
    "The investigation could not be validated. Listening and comparison remain available.",
};
function assertPrivateStringsAbsent(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const sentinel of PRIVATE_SENTINELS)
    assert.ok(!serialized.includes(sentinel));
}
async function failedAttempt(output: Response | Error) {
  const diagnostics: PrivateProviderDiagnostic[] = [];
  const mock = scriptedTransport([output]);
  const response = await createWorker({
    transport: mock.transport,
    onPrivateProviderDiagnostic: (item) => { diagnostics.push(item); },
  }).fetch(requestFor(), TEST_ENV);
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), genericFailure);
  assert.equal(mock.calls.length, 1);
  assertPrivateStringsAbsent(diagnostics);
  assert.ok(diagnostics.every(Object.isFrozen));
  return diagnostics;
}

it("transport throw has no obtained HTTP response and exposes only the fixed private category", async () => {
  const error = new Error(PRIVATE_SENTINELS.join(" "));
  assert.deepEqual(await failedAttempt(error), [{
    kind: "PROVIDER_TRANSPORT_FAILURE", httpResponseObtained: false,
  }]);
  const mock = scriptedTransport([error]);
  await assert.rejects(
    requestResponse([], TEST_ENV.OPENAI_API_KEY, new AbortController().signal, mock.transport),
    { code: "PROVIDER_TRANSPORT_FAILURE", status: 502, message: "PROVIDER_TRANSPORT_FAILURE" },
  );
});

for (const [status, type, code] of HTTP_ERROR_CASES) {
  it(`HTTP ${status}/${code} retains finite private fields and keeps the public failure identical`, async () => {
    assert.deepEqual(await failedAttempt(errorResponse(status, type, code)), [{
      kind: "PROVIDER_HTTP_FAILURE",
      httpResponseObtained: true,
      upstreamStatus: status,
      errorEnvelopeParseable: true,
      errorType: type,
      errorCode: code,
    }]);
  });
}

it("the adapter's HTTP failure code is distinct even without a private collector", async () => {
  const mock = scriptedTransport([errorResponse(401)]);
  await assert.rejects(
    requestResponse([], TEST_ENV.OPENAI_API_KEY, new AbortController().signal, mock.transport),
    { code: "PROVIDER_HTTP_FAILURE", status: 502, message: "PROVIDER_HTTP_FAILURE" },
  );
});

for (const [name, body] of [
  ["non-JSON", PRIVATE_SENTINELS.join(" ")],
  ["truncated JSON", '{"error":'],
  ["null root", "null"],
  ["array root", "[]"],
  ["missing error", "{}"],
  ["null error", '{"error":null}'],
  ["array error", '{"error":[]}'],
  ["string error", '{"error":"invalid_api_key"}'],
  ["invalid UTF-8", new Uint8Array([0xff])],
] as const) {
  it(`${name} does not retain an error envelope or private body`, async () => {
    assert.deepEqual(await failedAttempt(new Response(body, { status: 502 })), [{
      kind: "PROVIDER_HTTP_FAILURE", httpResponseObtained: true, upstreamStatus: 502,
      errorEnvelopeParseable: false, errorType: "unknown", errorCode: "unknown",
    }]);
  });
}

for (const [name, value] of [
  ["private text", PRIVATE_SENTINELS.join(" ")],
  ["unknown", "future_unknown_provider_value"],
  ["suffix", "invalid_api_key_private_suffix"],
  ["whitespace", " invalid_api_key "],
  ["prototype name", "__proto__"],
  ["object", { code: "invalid_api_key", private: PRIVATE_SENTINELS }],
  ["array", ["invalid_api_key"]],
  ["number", 401],
  ["null", null],
  ["missing", undefined],
] as const) {
  it(`non-allowlisted ${name} type/code collapse to unknown without copying the value`, async () => {
    // JSON.stringify omits undefined fields; bypass the fixture's default args.
    const response = Response.json({ error: { type: value, code: value } }, { status: 400 });
    assert.deepEqual(await failedAttempt(response), [{
      kind: "PROVIDER_HTTP_FAILURE", httpResponseObtained: true, upstreamStatus: 400,
      errorEnvelopeParseable: true, errorType: "unknown", errorCode: "unknown",
    }]);
  });
}

it("a known type does not allow a malicious code through", async () => {
  const [diagnostic] = await failedAttempt(errorResponse(400, "invalid_request_error", PRIVATE_SENTINELS.join(" ")));
  assert.deepEqual(diagnostic, {
    kind: "PROVIDER_HTTP_FAILURE", httpResponseObtained: true, upstreamStatus: 400,
    errorEnvelopeParseable: true, errorType: "invalid_request_error", errorCode: "unknown",
  });
});

it("the private error envelope has a smaller 4096-byte bound, including streamed bodies", async () => {
  const body = JSON.stringify({ error: { type: "invalid_request_error", code: "invalid_value" } });
  const exact = body.padEnd(ERROR_ENVELOPE_BYTES, " ");
  const [accepted] = await failedAttempt(new Response(exact, { status: 400 }));
  assert.equal(accepted.kind, "PROVIDER_HTTP_FAILURE");
  assert.equal(accepted.errorEnvelopeParseable, true);
  for (const declaredLength of [false, true]) {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(exact));
        controller.enqueue(new TextEncoder().encode(" " + PRIVATE_SENTINELS.join(" ")));
      },
      cancel() { cancelled = true; },
    });
    const [diagnostic] = await failedAttempt(new Response(stream, {
      status: 400,
      ...(declaredLength ? { headers: { "content-length": String(ERROR_ENVELOPE_BYTES + 1) } } : {}),
    }));
    assert.equal(diagnostic.kind, "PROVIDER_HTTP_FAILURE");
    assert.equal(diagnostic.errorEnvelopeParseable, false);
    assert.equal(diagnostic.errorType, "unknown");
    assert.equal(cancelled, true);
  }
  assert.equal(LIMITS.deadlineMs, 20000);
  assert.equal(LIMITS.outputTokens, 1800);
  assert.equal(LIMITS.rounds, 4);
  assert.equal(LIMITS.providerBytes, 65536);
});

it("ordinary handler cancels HTTP errors without reading or exposing their body", async () => {
  let cancelled = false;
  let reads = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull() { reads++; },
    cancel() { cancelled = true; },
  }, { highWaterMark: 0 });
  const mock = scriptedTransport([new Response(stream, { status: 403 })]);
  const response = await createWorker({ transport: mock.transport }).fetch(requestFor(), TEST_ENV);
  assert.deepEqual(await response.json(), genericFailure);
  assert.equal(reads, 0);
  assert.equal(cancelled, true);
});

it("a hanging HTTP error body preserves obtained status under the existing deadline", async () => {
  let cancelled = false;
  const diagnostics: PrivateProviderDiagnostic[] = [];
  const mock = scriptedTransport([new Response(new ReadableStream({
    cancel() { cancelled = true; },
  }), { status: 429 })]);
  const response = await createWorker({
    transport: mock.transport, deadlineMs: 15,
    onPrivateProviderDiagnostic: (item) => { diagnostics.push(item); },
  }).fetch(requestFor(), TEST_ENV);
  assert.equal(response.status, 504);
  assert.equal((await response.json()).code, "TIMEOUT");
  assert.deepEqual(diagnostics, [{
    kind: "PROVIDER_HTTP_FAILURE", httpResponseObtained: true, upstreamStatus: 429,
    errorEnvelopeParseable: false, errorType: "unknown", errorCode: "unknown",
  }]);
  assert.equal(cancelled, true);
  assert.equal(mock.calls.length, 1);
});

it("an HTTP body read exception retains status without its exception detail", async () => {
  const body = new ReadableStream({
    pull(controller) { controller.error(new Error(PRIVATE_SENTINELS.join(" "))); },
  });
  const [diagnostic] = await failedAttempt(new Response(body, { status: 500 }));
  assert.equal(diagnostic.kind, "PROVIDER_HTTP_FAILURE");
  assert.equal(diagnostic.upstreamStatus, 500);
  assert.equal(diagnostic.errorEnvelopeParseable, false);
});

it("a deadline before HTTP preserves TIMEOUT and records no response obtained", async () => {
  const diagnostics: PrivateProviderDiagnostic[] = [];
  let calls = 0;
  const response = await createWorker({
    transport: async () => { calls++; return new Promise(() => {}); },
    deadlineMs: 15,
    onPrivateProviderDiagnostic: (item) => { diagnostics.push(item); },
  }).fetch(requestFor(), TEST_ENV);
  assert.equal(response.status, 504);
  assert.equal((await response.json()).code, "TIMEOUT");
  assert.deepEqual(diagnostics, [{ kind: "PROVIDER_TRANSPORT_FAILURE", httpResponseObtained: false }]);
  assert.equal(calls, 1);
});

for (const factory of [happyTransport, mixedTransport]) {
  it(`${factory.name} retains successful tool flow; private observations are absent from completed/exported evidence`, async () => {
    const diagnostics: PrivateProviderDiagnostic[] = [];
    const mock = factory();
    const response = await createWorker({
      transport: mock.transport,
      onPrivateProviderDiagnostic: (item) => { diagnostics.push(item); },
    }).fetch(requestFor(), TEST_ENV);
    assert.equal(response.status, 200);
    const result = await response.json() as CompletedInvestigation;
    assert.equal(result.execution, "mock-transport-test");
    const exported = buildEvidence(recordings[0], recordings[1], "absolute", undefined, result);
    assertPrivateStringsAbsent(diagnostics);
    assertPrivateStringsAbsent(exported);
    assert.deepEqual(diagnostics, [0, 1].map(() => ({
      kind: "PROVIDER_HTTP_RESPONSE", httpResponseObtained: true, upstreamStatus: 200,
    })));
    assert.ok(!JSON.stringify(exported).includes("httpResponseObtained"));
    assert.ok(!JSON.stringify(exported).includes("upstreamStatus"));
    assert.ok(!JSON.stringify(exported).includes("test-opaque-reasoning-do-not-export"));
    assert.equal(mock.calls.length, 2);
  });
}

it("HTTP 200 observation does not weaken rejection of an invalid provider final output", async () => {
  const diagnostics: PrivateProviderDiagnostic[] = [];
  const mock = scriptedTransport([{}]);
  const response = await createWorker({
    transport: mock.transport,
    onPrivateProviderDiagnostic: (item) => { diagnostics.push(item); },
  }).fetch(requestFor(), TEST_ENV);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, "INCOMPLETE_PROVIDER_OUTPUT");
  assert.deepEqual(diagnostics, [{ kind: "PROVIDER_HTTP_RESPONSE", httpResponseObtained: true, upstreamStatus: 200 }]);
});

it("collector exceptions and rejected promises never become public errors or retries", async () => {
  for (const observer of [
    () => { throw new Error(PRIVATE_SENTINELS.join(" ")); },
    async () => { throw new Error(PRIVATE_SENTINELS.join(" ")); },
  ]) {
    const mock = scriptedTransport([errorResponse(404)]);
    const response = await createWorker({
      transport: mock.transport, onPrivateProviderDiagnostic: observer,
    }).fetch(requestFor(), TEST_ENV);
    assert.deepEqual(await response.json(), genericFailure);
    assert.equal(mock.calls.length, 1);
  }
});

it("private observations stay bounded by four provider rounds", async () => {
  const diagnostics: PrivateProviderDiagnostic[] = [];
  const mock = scriptedTransport(Array.from({ length: 4 }, (_, index) => functionOutput("compare_selected", {}, index)));
  const response = await createWorker({
    transport: mock.transport,
    onPrivateProviderDiagnostic: (item) => { diagnostics.push(item); },
  }).fetch(requestFor(), TEST_ENV);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).code, "TOOL_ROUND_LIMIT");
  assert.equal(diagnostics.length, 4);
  assert.equal(mock.calls.length, 4);
});

it("transport BoundaryErrors cannot introduce a private arbitrary category", async () => {
  assert.deepEqual(await failedAttempt(new BoundaryError(PRIVATE_SENTINELS.join(" "))), [{
    kind: "PROVIDER_TRANSPORT_FAILURE", httpResponseObtained: false,
  }]);
});
