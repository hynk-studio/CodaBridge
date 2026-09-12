import { it } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createWorker as sourceFactory } from "../../server/worker.ts";
import { happyTransport, requestFor, TEST_ENV } from "../fixtures/provider.ts";

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
  assert.equal(manifest.project_id, undefined);
  assert.ok(
    (await readFile(artifact, "utf8")).includes(
      "https://api.openai.com/v1/responses",
    ),
  );
});
