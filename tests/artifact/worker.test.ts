import { it } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createWorker as sourceFactory } from "../../server/worker.ts";
import type { PrivateProviderDiagnostic } from "../../server/provider-diagnostics.ts";
import { errorResponse, PRIVATE_SENTINELS } from "../fixtures/provider-errors.ts";
import {
  happyTransport,
  identifierExplanation,
  INTERMEDIATE_TEXT,
  mixedTransport,
  requestFor,
  scriptedTransport,
  TEST_ENV,
} from "../fixtures/provider.ts";

// Import the actual built ESM, not a source stand-in.
const artifact = new URL("../../dist/server/index.js", import.meta.url);
const built = (await import(artifact.href)) as {
  default: ReturnType<typeof sourceFactory>;
  createWorker: typeof sourceFactory;
};

it("built Worker default fetch serves disabled API and delegates local assets", async () => {
  assert.equal(typeof built.default.fetch, "function");
  const status = await built.default.fetch(
    new Request("http://localhost/api/investigation/status"),
    {},
  );
  assert.equal((await status.json()).status, "unavailable");
  assert.equal((await built.default.fetch(requestFor(), {})).status, 503);
  const asset = await built.default.fetch(new Request("http://localhost/"), {
    ASSETS: { fetch: async () => new Response("asset-binding") },
  });
  assert.equal(await asset.text(), "asset-binding");
});
it("built provider adapter completes the real tool loop against a mock transport", async () => {
  const mock = happyTransport();
  const response = await built
    .createWorker({ transport: mock.transport })
    .fetch(requestFor(), TEST_ENV);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.execution, "mock-transport-test");
  assert.equal(
    result.evidence.find((item: { kind: string }) => item.kind === "retrieval")
      .matches[0].sourceId,
    "dswp-11",
  );
  assert.equal(mock.calls.length, 2);
});
it("client artifact contains no server config, provider adapter or test fixture; Workers metadata is present", async () => {
  const directory = new URL("../../dist/client/", import.meta.url);
  const files = await readdir(directory, { recursive: true });
  for (const file of files.filter((file) =>
    /\.(js|css|html|json|map)$/.test(file),
  )) {
    const text = await readFile(new URL(file, directory), "utf8");
    for (const forbidden of [
      "OPENAI_API_KEY",
      "CODABRIDGE_INVESTIGATION_ENABLED",
      "CODABRIDGE_ACCESS_REVIEWED",
      "api.openai.com",
      TEST_ENV.OPENAI_API_KEY,
      "resp_mock_",
      "test-opaque-reasoning",
      INTERMEDIATE_TEXT,
      "onPrivateProviderDiagnostic",
      "PROVIDER_TRANSPORT_FAILURE",
      "PROVIDER_HTTP_FAILURE",
      "errorEnvelopeParseable",
      ...PRIVATE_SENTINELS,
    ])
      assert.ok(!text.includes(forbidden), `${file} contains ${forbidden}`);
  }
  const manifest = JSON.parse(
    await readFile(
      new URL("../../dist/.openai/hosting.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(manifest.static, undefined);
  const sourceManifest = JSON.parse(
    await readFile(new URL("../../.openai/hosting.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(manifest, sourceManifest);
  assert.ok(
    (await readFile(artifact, "utf8")).includes(
      "https://api.openai.com/v1/responses",
    ),
  );
});

it("built factory observes its default fetch without a transport override (global fetch is TEST ONLY stubbed)", async (context) => {
  // This proves compiled wiring only, not real Worker egress or model access.
  for (const output of [new Error(PRIVATE_SENTINELS.join(" ")), errorResponse(404, "invalid_request_error", "model_not_found")]) {
    const diagnostics: PrivateProviderDiagnostic[] = [];
    const mock = scriptedTransport([output]);
    const fetchStub = context.mock.method(globalThis, "fetch", mock.transport);
    try {
      const response = await built.createWorker({
        onPrivateProviderDiagnostic: (item) => { diagnostics.push(item); },
      }).fetch(requestFor(), TEST_ENV);
      assert.equal(response.status, 502);
      const result = await response.json();
      assert.equal(result.code, "PROVIDER_FAILURE");
      assert.equal(result.diagnostic, undefined);
      assert.equal(mock.calls.length, 1);
      assert.deepEqual(diagnostics, [output instanceof Error ? {
        kind: "PROVIDER_TRANSPORT_FAILURE", httpResponseObtained: false,
      } : {
        kind: "PROVIDER_HTTP_FAILURE", httpResponseObtained: true, upstreamStatus: 404,
        errorEnvelopeParseable: true, errorType: "invalid_request_error", errorCode: "model_not_found",
      }]);
      for (const sentinel of PRIVATE_SENTINELS)
        assert.ok(!JSON.stringify({ result, diagnostics }).includes(sentinel));
    } finally {
      fetchStub.mock.restore();
    }
  }
});

it("built adapter accepts mixed commentary/tool output and supplied numeric source labels", async () => {
  const mock = mixedTransport();
  const response = await built
    .createWorker({ transport: mock.transport })
    .fetch(requestFor(), TEST_ENV);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.explanation, identifierExplanation());
  assert.equal(result.execution, "mock-transport-test");
  assert.equal(mock.calls.length, 2);
  assert.ok(!JSON.stringify(result).includes(INTERMEDIATE_TEXT));
  assert.ok(
    !JSON.stringify(result).includes("test-opaque-reasoning-do-not-export"),
  );
});
