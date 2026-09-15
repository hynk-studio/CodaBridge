import { test } from "node:test";
import assert from "node:assert/strict";
import { actionSummary, type RecordedAction } from "../src/astra/actions.ts";

test("retrospective actions use an allowlist and preserve the recorded initiator", () => {
  assert.deepEqual(actionSummary({ name: "control_result", initiatedBy: "model" }), {
    label: "Look up a duration reassignment control", attribution: "Requested by Astra",
  });
  assert.deepEqual(actionSummary({ name: "control_result", initiatedBy: "server" }), {
    label: "Look up a duration reassignment control", attribution: "Performed by CodaBridge",
  });
  for (const name of ["private creator text", "__proto__", "constructor", "toString"]) {
    assert.equal(actionSummary({ name, initiatedBy: "server" }).label, "Other recorded action");
  }
  assert.equal(actionSummary({ name: "control_result", initiatedBy: "unknown" } as unknown as RecordedAction).attribution,
    "Initiator not recorded");
});

test("action summaries never inspect tool arguments or other request/provider fields", () => {
  const action = {
    name: "find_creation_alternatives", initiatedBy: "model" as const,
    get arguments() { throw new Error("Private arguments must not be read"); },
    get providerPayload() { throw new Error("Provider content must not be read"); },
  };
  assert.deepEqual(actionSummary(action), {
    label: "Find recordings for the creation block", attribution: "Requested by Astra",
  });
});
