import { it } from "node:test";
import assert from "node:assert/strict";
import { Response as LocalResponse } from "miniflare";
import { offlineWorkerd } from "../fixtures/offline-workerd.ts";
import {
  composerInput,
  modifiedCopyInput,
  QUANTITATIVE_COMPOSER_PROSE,
  INCORRECT_COMPOSER_PROSE,
} from "../fixtures/composer-provider.ts";
import { TEST_ENV, finalOutput, functionOutput } from "../fixtures/provider.ts";
import { RESPONSES_URL } from "../../server/provider.ts";
import type { ComposerResult } from "../../src/composer/contract.ts";
import { compareBlock } from "../../src/composer/analysis.ts";

it("TEST ONLY native workerd accepts unverified numeric Composer prose after actual edited-copy retrieval; URLs still reject", async () => {
  const input = modifiedCopyInput(),
    before = structuredClone(input);
  let prose = QUANTITATIVE_COMPOSER_PROSE,
    calls = 0,
    replays = 0;
  const runtime = await offlineWorkerd(
    `
    import worker from "./index.js";
    export default {fetch(request, env) {return worker.fetch(request, {...env, ...${JSON.stringify(TEST_ENV)}});}};
  `,
    async (request) => {
      assert.equal(request.url, RESPONSES_URL);
      calls++;
      const payload = (await request.json()) as {
        input: { type?: string; output?: string }[];
      };
      const output = payload.input.find(
        (i) => i.type === "function_call_output",
      );
      if (!output)
        return LocalResponse.json(
          functionOutput("find_creation_alternatives", {
            blockId: input.activeId,
            limit: 3,
          }),
        );
      replays++;
      const evidence = JSON.parse(output.output!);
      assert.equal(evidence.result.kind, "find_creation_alternatives");
      assert.deepEqual(
        evidence.result.data,
        compareBlock(input.draft, input.activeId, input.previous),
      );
      return LocalResponse.json(
        finalOutput({
          possibleInterpretations: [
            { text: prose, evidenceIds: [evidence.result.id] },
          ],
          limitations: [
            {
              text: "The small catalog and estimated markers do not establish whale meaning.",
              evidenceIds: [evidence.result.id],
            },
          ],
        }),
      );
    },
  );
  try {
    for (const text of [
      QUANTITATIVE_COMPOSER_PROSE,
      INCORRECT_COMPOSER_PROSE,
      "See https://example.invalid/ for Block 2.",
    ]) {
      prose = text;
      const response = await runtime.dispatchFetch(
        "http://localhost/api/composer",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost",
          },
          body: JSON.stringify(input),
        },
      );
      const result = (await response.json()) as ComposerResult & {
        code?: string;
      };
      if (text.includes("https://")) {
        assert.equal(response.status, 502);
        assert.equal(result.code, "UNSUPPORTED_GENERATED_CONTENT");
      } else {
        assert.equal(response.status, 200);
        assert.equal(result.binding, input.binding);
        assert.equal(result.explanation!.possibleInterpretations[0].text, text);
        assert.deepEqual(
          result.analysis,
          compareBlock(input.draft, input.activeId, input.previous),
        );
        assert.equal(result.proposal, null);
        assert.equal(result.actions.at(-1)!.initiatedBy, "model");
      }
      assert.deepEqual(input, before);
    }
    assert.equal(calls, 6);
    assert.equal(replays, 3);
  } finally {
    await runtime.dispose();
  }
});

it("TEST ONLY native workerd artifact constructs manual Composer requests, dispatches tools and accepts validated final output", async () => {
  const input = composerInput("investigate"),
    edit = composerInput("edit", input.draft);
  let calls = 0,
    mode = "investigate",
    toolOutputObserved = false;
  const runtime = await offlineWorkerd(
    `
    import worker from "./index.js";
    export default { fetch(request, env) { return worker.fetch(request, new URL(request.url).pathname.endsWith("status") ? env : {...env, ...${JSON.stringify(TEST_ENV)}}); } };
  `,
    async (request) => {
      // Native workerd fetch is terminated at an in-process outbound fixture.
      // No endpoint is reachable externally, no Node fetch fallback is involved.
      assert.equal(request.url, RESPONSES_URL);
      calls++;
      const payload = (await request.json()) as {
        model: string;
        max_output_tokens: number;
        input: { type?: string; output?: string }[];
      };
      assert.equal(payload.model, "gpt-6-astra");
      assert.equal(payload.max_output_tokens, 1800);
      if (mode === "redirect")
        return new LocalResponse(null, {
          status: 307,
          headers: { location: "https://never-follow.invalid" },
        });
      if (mode === "edit")
        return LocalResponse.json(
          finalOutput({
            revision: input.draft.revision,
            operations: [
              {
                op: "set_gap",
                blockId: input.activeId,
                gapIndex: 0,
                seconds: 0.3,
              },
            ],
          }),
        );
      const output = payload.input.find(
        (i) => i.type === "function_call_output",
      );
      if (!output)
        return LocalResponse.json(
          functionOutput("find_creation_alternatives", {
            blockId: input.activeId,
            limit: 2,
          }),
        );
      const evidence = JSON.parse(output.output!);
      toolOutputObserved = true;
      assert.equal(evidence.result.data.eligibleCount, 2);
      return LocalResponse.json(
        finalOutput({
          possibleInterpretations: [
            {
              text: "The real examples differ in relative spacing from the synthetic draft.",
              evidenceIds: [evidence.result.id],
            },
          ],
          limitations: [
            {
              text: "Timing similarity and estimated markers do not establish biological meaning.",
              evidenceIds: [evidence.result.id],
            },
          ],
        }),
      );
    },
  );
  try {
    const post = (value: unknown) =>
      runtime.dispatchFetch("http://localhost/api/composer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost",
        },
        body: JSON.stringify(value),
      });
    const response = await post(input),
      result = (await response.json()) as ComposerResult;
    assert.equal(response.status, 200);
    assert.equal(calls, 2);
    assert.ok(toolOutputObserved);
    assert.equal(result.actions.at(-1)!.initiatedBy, "model");
    assert.equal(result.providerResponses.length, 2);
    assert.doesNotMatch(
      JSON.stringify(result),
      /encrypted_content|test-opaque|TEST_ONLY_NOT_A_CREDENTIAL/,
    );
    mode = "edit";
    const proposal = (await (await post(edit)).json()) as ComposerResult;
    assert.equal(proposal.proposal!.preview.blocks[0].times[1], 0.3);
    assert.equal(calls, 3);
    mode = "redirect";
    const redirected = await post(edit);
    assert.equal(redirected.status, 502);
    assert.equal(
      ((await redirected.json()) as { code: string }).code,
      "PROVIDER_FAILURE",
    );
    assert.equal(calls, 4); // One initial request; alternate destination would fail the URL assertion.
    const unavailable = await runtime.dispatchFetch(
      "http://localhost/api/investigation/status",
    );
    assert.equal(
      ((await unavailable.json()) as { code: string }).code,
      "NOT_CONFIGURED",
    );
  } finally {
    await runtime.dispose();
  }
});
