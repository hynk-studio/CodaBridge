// TEST ONLY. No model call and no production import. Exercises the actual server adapter.
import assert from "node:assert/strict";
import { createDraft, binding, type Draft } from "../../src/composer/model.ts";
import type { ComposerRequest } from "../../src/composer/contract.ts";
import type { ProviderTransport } from "../../server/provider.ts";
import { RESPONSES_URL, MODEL } from "../../server/provider.ts";
import { assistantMessage, finalOutput, functionOutput } from "./provider.ts";

export function composerInput(
  mode: "edit" | "investigate" = "edit",
  draft = createDraft("dswp-1"),
): ComposerRequest {
  const activeId = draft.blocks.at(-1)!.id;
  return {
    mode,
    draft,
    activeId,
    previous: null,
    binding: binding(draft, activeId),
    question:
      mode === "edit"
        ? "Make the active block 1.25 times as long, preserving interval ratios."
        : "Find real recordings closest to my active block.",
  };
}
export function composerRequest(input: unknown = composerInput()) {
  return new Request("http://localhost/api/composer", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(input),
  });
}
export function composerTransport(edit: "scale" | "duplicate-scale" = "scale") {
  const calls: {
    payload: Record<string, unknown>;
    redirect: RequestRedirect | undefined;
  }[] = [];
  const transport: ProviderTransport = async (url, init) => {
    assert.equal(url, RESPONSES_URL);
    assert.equal(init.redirect, "manual");
    const payload = JSON.parse(String(init.body));
    assert.equal(payload.model, MODEL);
    assert.equal(payload.max_output_tokens, 1800);
    assert.deepEqual(payload.reasoning, { effort: "low" });
    const context = JSON.parse(payload.input[0].content) as {
      draft: Draft;
      activeId: string;
    };
    calls.push({ payload, redirect: init.redirect });
    if (payload.text.format.name === "composer_edit_proposal")
      return Response.json(
        finalOutput({
          revision: context.draft.revision,
          operations:
            edit === "duplicate-scale"
              ? [
                  {
                    op: "duplicate_block",
                    blockId: context.activeId,
                    newBlockId: "fixture-copy",
                  },
                  {
                    op: "scale_duration",
                    blockId: "fixture-copy",
                    factor: 1.25,
                  },
                ]
              : [
                  {
                    op: "scale_duration",
                    blockId: context.activeId,
                    factor: 1.25,
                  },
                ],
        }),
      );
    const toolResult = payload.input.find(
      (item: { type?: string }) => item.type === "function_call_output",
    );
    if (!toolResult) {
      const output = functionOutput("find_creation_alternatives", {
        blockId: context.activeId,
        limit: 3,
      });
      output.output.unshift(
        assistantMessage(
          "TEST ONLY intermediate commentary: checking the real catalog.",
          "commentary",
        ) as (typeof output.output)[number],
      );
      return Response.json(output);
    }
    const evidence = JSON.parse(toolResult.output);
    assert.equal(evidence.result.kind, "find_creation_alternatives");
    assert.ok(Array.isArray(evidence.result.data.matches));
    return Response.json(
      finalOutput({
        possibleInterpretations: [
          {
            text: "The returned real examples are ranked by relative spacing of the active synthetic block; the seed remains a separate baseline.",
            evidenceIds: [evidence.result.id],
          },
        ],
        limitations: [
          {
            text: "This small catalog and estimated markers cannot establish whale meaning or biological coda boundaries. Unequal counts cannot be compared with this metric.",
            evidenceIds: [evidence.result.id],
          },
        ],
      }),
    );
  };
  return { transport, calls };
}
