import { it } from "node:test";
import assert from "node:assert/strict";
import { Response as LocalResponse } from "miniflare";
import { offlineWorkerd } from "../fixtures/offline-workerd.ts";
import {
  TEST_ENV,
  finalOutput,
  functionOutput,
  inputFor,
} from "../fixtures/provider.ts";
import { labInput, labExplanation } from "../fixtures/lab-provider.ts";
import { RESPONSES_URL } from "../../server/provider.ts";
import { comparePairing } from "../../src/lab/model.ts";
import { contextSegment } from "../../src/lab/catalog.ts";
import type { LabResult } from "../../src/lab/contract.ts";

it("TEST ONLY built native workerd Lab performs bounded tool replay with manual redirects; default direct routes refuse", async () => {
  let calls = 0,
    replayed = false,
    redirect = false;
  const input = labInput(),
    runtime = await offlineWorkerd(
      `
    import worker from "./index.js";
    export default {fetch(request,env){return worker.fetch(request,new URL(request.url).searchParams.has("test-only")?{...env,...${JSON.stringify(TEST_ENV)}}:env);}};
  `,
      async (request) => {
        assert.equal(request.url, RESPONSES_URL);
        calls++;
        if (redirect)
          return new LocalResponse(null, {
            status: 307,
            headers: { location: "https://must-not-follow.invalid" },
          });
        const payload = (await request.json()) as {
          model: string;
          max_output_tokens: number;
          reasoning: unknown;
          input: { type?: string; output?: string }[];
        };
        assert.equal(payload.model, "gpt-6-astra");
        assert.equal(payload.max_output_tokens, 1800);
        assert.deepEqual(payload.reasoning, { effort: "low" });
        const result = payload.input.find(
          (i) => i.type === "function_call_output",
        );
        if (!result)
          return LocalResponse.json(
            functionOutput("control_result", {
              segmentId: input.segmentId,
              offset: input.offset,
            }),
          );
        const evidence = JSON.parse(result.output!);
        assert.deepEqual(
          evidence.result.data.pairs,
          comparePairing(contextSegment, 1).selected.pairs,
        );
        replayed = true;
        return LocalResponse.json(finalOutput(labExplanation()));
      },
    );
  const post = (route: string) =>
    runtime.dispatchFetch(`http://localhost${route}`, {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: JSON.stringify(route === "/api/investigate" ? inputFor() : input),
    });
  try {
    for (const path of ["/api/lab", "/api/composer", "/api/investigate"]) {
      const response = await post(path);
      assert.equal(response.status, 503);
      assert.equal(
        ((await response.json()) as { code: string }).code,
        "NOT_CONFIGURED",
      );
    }
    assert.equal(calls, 0);
    const response = await post("/api/lab?test-only"),
      result = (await response.json()) as LabResult;
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
    assert.ok(replayed);
    assert.equal(result.binding, input.binding);
    assert.deepEqual(result.comparison, comparePairing(contextSegment, 1));
    assert.equal(result.actions.at(-1)!.initiatedBy, "model");
    assert.equal(result.providerResponses.length, 2);
    assert.doesNotMatch(
      JSON.stringify(result),
      /encrypted_content|test-opaque|TEST_ONLY_NOT_A_CREDENTIAL/,
    );
    redirect = true;
    const failed = await post("/api/lab?test-only");
    assert.equal(failed.status, 502);
    assert.equal(calls, 3);
    assert.equal(
      ((await failed.json()) as { code: string }).code,
      "PROVIDER_FAILURE",
    );
  } finally {
    await runtime.dispose();
  }
});
