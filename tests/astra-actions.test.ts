import { test } from "node:test";
import assert from "node:assert/strict";
import { actionEvidenceIndex, actionSummary, type RecordedAction } from "../src/astra/actions.ts";

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
    evidenceId: "evidence:1",
    get arguments() { throw new Error("Private arguments must not be read"); },
    get providerPayload() { throw new Error("Provider content must not be read"); },
  };
  assert.deepEqual(actionSummary(action), {
    label: "Find recordings for the creation block", attribution: "Requested by Astra",
  });
  assert.equal(actionEvidenceIndex(action, [{ id: "evidence:1" }]), 0);
});

test("action evidence resolves exactly within this result, including repeated tool names", () => {
  const evidence = [{ id: "control:1" }, { id: "control:2" }];
  const actions = ["control:2", "control:1"].map(evidenceId => ({
    name: "control_result", initiatedBy: "model" as const, evidenceId,
  }));
  assert.deepEqual(actions.map(action => actionEvidenceIndex(action, evidence)), [1, 0]);
  assert.equal(actionEvidenceIndex(actions[0], [{ id: "control:1" }]), null);
  for (const evidenceId of [undefined, "", " control:1", "control:1 ", "CONTROL:1", "__proto__"]) {
    assert.equal(actionEvidenceIndex({ ...actions[0], evidenceId }, evidence), null);
  }
  assert.equal(actionEvidenceIndex(actions[0], [{ id: "control:2" }, { id: "control:2" }]), null);
});
