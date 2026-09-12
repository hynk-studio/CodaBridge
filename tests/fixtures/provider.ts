// Test-only Responses transport. Never imported by client or production server.
import assert from "node:assert/strict";
import {
  RESPONSES_URL,
  MODEL,
  type ProviderTransport,
} from "../../server/provider.ts";
import { recordings, selectionKey } from "../../src/domain/catalog.ts";

export const TEST_ENV = {
  CODABRIDGE_INVESTIGATION_ENABLED: "true",
  CODABRIDGE_ACCESS_REVIEWED: "true",
  OPENAI_API_KEY: "TEST_ONLY_NOT_A_CREDENTIAL",
};
export function inputFor(a = recordings[0], b = recordings[1]) {
  return {
    sourceIds: [a.id, b.id],
    selectionKey: selectionKey(a, b),
    question: "Find another recording closest to A under the timing metric.",
  };
}
export function requestFor(value: unknown = inputFor()) {
  return new Request("http://localhost/api/investigate", {
    method: "POST",
    headers: { "content-type": "application/json", origin: "http://localhost" },
    body: JSON.stringify(value),
  });
}
export function responsePayload(output: unknown[], index = 0) {
  return {
    id: `resp_mock_${index}`,
    model: MODEL,
    created_at: 1789185600,
    status: "completed",
    usage: { input_tokens: 100, output_tokens: 30, total_tokens: 130 },
    output,
  };
}
export function functionOutput(
  name = "find_alternatives",
  args: unknown = { referenceId: "dswp-1", limit: 2 },
  index = 0,
) {
  return responsePayload(
    [
      {
        type: "reasoning",
        id: `rs_mock_${index}`,
        summary: [],
        encrypted_content: "test-opaque-reasoning-do-not-export",
      },
      {
        type: "function_call",
        id: `fc_mock_${index}`,
        call_id: `call_mock_${index}`,
        name,
        arguments: JSON.stringify(args),
        status: "completed",
      },
    ],
    index,
  );
}
export function explanation(reference = "comparison:dswp-1:dswp-2") {
  return {
    possibleInterpretations: [
      {
        text: "The relative spacing differs under this timing metric; the displayed measurements describe this selected pair only.",
        evidenceIds: [reference],
      },
    ],
    limitations: [
      {
        text: "Estimated transient groups may include echoes or noise. They do not establish biological coda boundaries or meaning.",
        evidenceIds: ["recording:dswp-1"],
      },
    ],
  };
}
export function finalOutput(value: unknown = explanation()) {
  return responsePayload(
    [
      {
        type: "message",
        id: "msg_mock",
        role: "assistant",
        status: "completed",
        content: [
          { type: "output_text", text: JSON.stringify(value), annotations: [] },
        ],
      },
    ],
    1,
  );
}
export function scriptedTransport(outputs: unknown[]) {
  const calls: {
    url: string;
    payload: Record<string, unknown>;
    signal: AbortSignal | null | undefined;
  }[] = [];
  const transport: ProviderTransport = async (url, init) => {
    assert.equal(url, RESPONSES_URL);
    assert.equal(
      new Headers(init.headers).get("authorization"),
      `Bearer ${TEST_ENV.OPENAI_API_KEY}`,
    );
    const payload = JSON.parse(String(init.body)) as Record<string, unknown>;
    assert.equal(payload.model, MODEL);
    assert.equal(payload.store, false);
    assert.equal(payload.parallel_tool_calls, false);
    calls.push({ url, payload, signal: init.signal });
    if (calls.length > outputs.length)
      throw new Error("Unexpected additional provider request in test");
    const output = outputs[calls.length - 1];
    if (output instanceof Error) throw output;
    return output instanceof Response ? output : Response.json(output);
  };
  return { transport, calls };
}
export function happyTransport() {
  return scriptedTransport([
    functionOutput(),
    finalOutput(explanation("retrieval:dswp-1:2")),
  ]);
}
