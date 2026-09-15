import { it } from "node:test";
import assert from "node:assert/strict";
import { createWorker } from "../server/worker.ts";
import type { ProviderTransport } from "../server/provider.ts";
import type { PrivateProviderDiagnostic } from "../server/provider-diagnostics.ts";
import type { LabResult } from "../src/lab/contract.ts";
import { TEST_ENV, requestFor } from "./fixtures/provider.ts";
import { composerRequest } from "./fixtures/composer-provider.ts";
import { labInput, labRequest, labTransport } from "./fixtures/lab-provider.ts";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

// TEST ONLY. Explicit delivery gates let the fake clock advance independently
// of provider responses. No native fetch, real delay, or live credential.
function heldLabTransport() {
  const fixture = labTransport();
  const rounds = Array.from({ length: 2 }, () => ({
    started: deferred<AbortSignal>(),
    deliver: deferred<void>(),
  }));
  let calls = 0;
  const transport: ProviderTransport = async (url, init) => {
    const round = rounds[calls++];
    assert.ok(round, "No unexpected provider call or retry");
    assert.ok(init.signal);
    round.started.resolve(init.signal);
    await round.deliver.promise;
    return fixture.transport(url, init);
  };
  return { transport, rounds, callCount: () => calls };
}

const timeoutBody = {
  status: "failed",
  code: "TIMEOUT",
  message: "The investigation timed out. No explanation was accepted.",
};
const transportFailure = {
  kind: "PROVIDER_TRANSPORT_FAILURE",
  httpResponseObtained: false,
};

it("TEST ONLY Lab accepts its control tool round after 20 seconds within the 60-second total cap", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const mock = heldLabTransport(), input = labInput();
  const response = createWorker(mock).fetch(labRequest(input), TEST_ENV);
  const firstSignal = await mock.rounds[0].started.promise;
  t.mock.timers.tick(7000);
  mock.rounds[0].deliver.resolve();
  const secondSignal = await mock.rounds[1].started.promise;
  assert.equal(secondSignal, firstSignal);
  t.mock.timers.tick(21000);
  assert.equal(secondSignal.aborted, false);
  mock.rounds[1].deliver.resolve();
  const completed = await response;
  assert.equal(completed.status, 200);
  const result = (await completed.json()) as LabResult;
  assert.equal(result.status, "completed");
  assert.equal(result.binding, input.binding);
  assert.deepEqual(result.actions.map((action) => [action.name, action.initiatedBy]), [
    ["exchange_info", "server"],
    ["compare_observed_pairing", "server"],
    ["control_result", "model"],
  ]);
  assert.deepEqual(result.actions[2].arguments, { segmentId: input.segmentId, offset: 1 });
  assert.equal(result.providerResponses.length, 2);
  t.mock.timers.tick(60000);
  assert.equal(mock.callCount(), 2);
});

it("TEST ONLY Lab aborts round two at 60 seconds total without restarting its timer or retrying", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const mock = heldLabTransport(), diagnostics: PrivateProviderDiagnostic[] = [];
  const response = createWorker({
    transport: mock.transport,
    onPrivateProviderDiagnostic: (event) => { diagnostics.push(event); },
  }).fetch(labRequest(), TEST_ENV);
  const firstSignal = await mock.rounds[0].started.promise;
  t.mock.timers.tick(7000);
  mock.rounds[0].deliver.resolve();
  const secondSignal = await mock.rounds[1].started.promise;
  assert.equal(secondSignal, firstSignal);
  t.mock.timers.tick(52999);
  assert.equal(secondSignal.aborted, false);
  t.mock.timers.tick(1);
  assert.equal(secondSignal.aborted, true);
  const failed = await response;
  assert.equal(failed.status, 504);
  assert.deepEqual(await failed.json(), timeoutBody);
  assert.deepEqual(diagnostics, [
    { kind: "PROVIDER_HTTP_RESPONSE", httpResponseObtained: true, upstreamStatus: 200 },
    transportFailure,
  ]);
  t.mock.timers.tick(60000);
  assert.equal(mock.callCount(), 2);
});

for (const [path, request, cap] of [
  ["/api/lab", labRequest, 60000],
  ["/api/investigate", requestFor, 20000],
  ["/api/composer", composerRequest, 20000],
] as const) {
  for (const [name, deadlineMs, expected] of [
    ["production cap", undefined, cap],
    ["oversized test override is clamped", 120000, cap],
    ["test override can shorten the cap", 5, 5],
  ] as const) {
    it(`TEST ONLY ${path}: ${name}`, async (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const mock = heldLabTransport(), diagnostics: PrivateProviderDiagnostic[] = [];
      const response = createWorker({
        transport: mock.transport, deadlineMs,
        onPrivateProviderDiagnostic: (event) => { diagnostics.push(event); },
      }).fetch(request(), TEST_ENV);
      const signal = await mock.rounds[0].started.promise;
      t.mock.timers.tick(expected - 1);
      assert.equal(signal.aborted, false);
      t.mock.timers.tick(1);
      assert.equal(signal.aborted, true);
      const failed = await response;
      assert.equal(failed.status, 504);
      assert.deepEqual(await failed.json(), timeoutBody);
      assert.deepEqual(diagnostics, [transportFailure]);
      t.mock.timers.tick(120000);
      assert.equal(mock.callCount(), 1);
    });
  }

  it(`TEST ONLY ${path}: user cancellation aborts immediately without advancing time or retrying`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const mock = heldLabTransport(), controller = new AbortController();
    const response = createWorker(mock).fetch(new Request(request(), { signal: controller.signal }), TEST_ENV);
    const signal = await mock.rounds[0].started.promise;
    controller.abort();
    assert.equal(signal.aborted, true);
    const failed = await response;
    assert.equal(failed.status, 504);
    assert.deepEqual(await failed.json(), timeoutBody);
    t.mock.timers.tick(120000);
    assert.equal(mock.callCount(), 1);
  });
}
