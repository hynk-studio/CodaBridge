import { it } from "node:test";
import assert from "node:assert/strict";
import { Response as LocalResponse } from "miniflare";
import { constructorMatrixWorker, offlineWorkerd } from "../fixtures/offline-workerd.ts";
import { RESPONSES_URL } from "../../server/provider.ts";
import { inputFor, TEST_ENV } from "../fixtures/provider.ts";

it("native workerd Request constructor matrix needs no fetch or credential", async (context) => {
  let outboundCalls = 0;
  const runtime = await offlineWorkerd(constructorMatrixWorker, () => {
    outboundCalls++;
    return new LocalResponse(null, { status: 599 });
  });
  try {
    const response = await runtime.dispatchFetch("http://localhost/private-probe/matrix");
    const matrix = await response.json();
    context.diagnostic(JSON.stringify(matrix));
    assert.deepEqual(matrix, {
      url_only: true,
      post: true,
      post_content_type: true,
      post_content_type_body: true,
      full_manual: true,
      full_error: false,
      full_manual_signal: true,
      full_default_signal: true,
    });
    assert.equal(outboundCalls, 0);
  } finally {
    await runtime.dispose();
  }
});

it("built adapter in native workerd rejects synthetic redirects without following or forwarding Authorization", async (context) => {
  // TEST ONLY: native Worker fetch terminates at this in-process fixture binding.
  // Neither the provider URL nor either redirect target can reach a network.
  let upstreamStatus = 301;
  let location = "https://redirect.invalid/test-only";
  let initialCalls = 0;
  let redirectedCalls = 0;
  let initialAuthorizationPresent = false;
  let forwardedAuthorizationPresent = false;
  const runtime = await offlineWorkerd(`
    import worker, { createWorker } from "./index.js";
    export default {
      async fetch(request) {
        if (new URL(request.url).pathname !== "/private-probe/redirect")
          return worker.fetch(request, {});
        const diagnostics = [];
        const app = createWorker({ onPrivateProviderDiagnostic: value => diagnostics.push(value) });
        const response = await app.fetch(new Request("http://localhost/api/investigate", {
          method: "POST",
          headers: { "content-type": "application/json", origin: "http://localhost" },
          body: ${JSON.stringify(JSON.stringify(inputFor()))}
        }), ${JSON.stringify(TEST_ENV)});
        return Response.json({ status: response.status, result: await response.json(), diagnostics });
      }
    };
  `, (request) => {
    if (request.url !== RESPONSES_URL) {
      redirectedCalls++;
      forwardedAuthorizationPresent ||= request.headers.has("authorization");
      return new LocalResponse(null, { status: 599 });
    }
    initialCalls++;
    initialAuthorizationPresent = request.headers.has("authorization");
    return new LocalResponse(null, { status: upstreamStatus, headers: { location } });
  });
  try {
    for (const status of [301, 302, 303, 307, 308]) {
      await context.test(`HTTP ${status} is a generic failure; no second fetch`, async () => {
        upstreamStatus = status;
        // Cover same-origin and cross-origin redirects, including redirects that
        // retain POST semantics. All destinations terminate at the same fixture.
        location = status === 302 ? `${RESPONSES_URL}?test-only-redirect` : "https://redirect.invalid/test-only";
        initialCalls = 0;
        redirectedCalls = 0;
        initialAuthorizationPresent = false;
        forwardedAuthorizationPresent = false;
        const response = await runtime.dispatchFetch("http://localhost/private-probe/redirect");
        const observation = await response.json() as {
          status: number;
          result: { code: string; explanation?: unknown; diagnostic?: unknown };
          diagnostics: unknown[];
        };
        assert.equal(observation.status, 502);
        assert.equal(observation.result.code, "PROVIDER_FAILURE");
        assert.equal(observation.result.explanation, undefined);
        assert.equal(observation.result.diagnostic, undefined);
        assert.deepEqual(observation.diagnostics, [{
          kind: "PROVIDER_HTTP_FAILURE",
          httpResponseObtained: true,
          upstreamStatus: status,
          errorEnvelopeParseable: false,
          errorType: "unknown",
          errorCode: "unknown",
        }]);
        assert.equal(initialCalls, 1);
        assert.equal(initialAuthorizationPresent, true);
        assert.equal(redirectedCalls, 0);
        assert.equal(forwardedAuthorizationPresent, false);
        assert.ok(!JSON.stringify(observation).includes(TEST_ENV.OPENAI_API_KEY));
        assert.ok(!JSON.stringify(observation).includes(location));
      });
    }
    const callsBeforeDisabledCheck = initialCalls;
    const disabled = await runtime.dispatchFetch("http://localhost/api/investigation/status");
    assert.equal((await disabled.json() as { status: string }).status, "unavailable");
    assert.equal(initialCalls, callsBeforeDisabledCheck);
  } finally {
    await runtime.dispose();
  }
});
