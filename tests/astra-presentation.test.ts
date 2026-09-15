import { test } from "node:test";
import assert from "node:assert/strict";
import { citationPresentation } from "../src/astra/citations.ts";
import { ASTRA_REQUEST_FAILED, astraUnavailableCopy } from "../src/astra/copy.ts";

test("citations label accepted evidence kinds, distinguish peers and retain citation order", () => {
  const evidence = [
    { id: "opaque:a", kind: "recording" }, { id: "opaque:b", kind: "recording" },
    { id: "opaque:c", kind: "comparison" }, { id: "opaque:d", kind: "control_result" },
    { id: "opaque:e", kind: "exchange_info" }, { id: "opaque:f", kind: "retrieval" },
    { id: "opaque:g", kind: "creation_before_after" },
  ];
  const bytes = JSON.stringify(evidence);
  assert.deepEqual(["opaque:b", "opaque:a", "opaque:b"].map(id => citationPresentation(id, evidence)), [
    { index: 1, label: "Recording evidence 2" }, { index: 0, label: "Recording evidence 1" },
    { index: 1, label: "Recording evidence 2" },
  ]);
  assert.deepEqual(evidence.slice(2).map(e => citationPresentation(e.id, evidence).label),
    ["Comparison evidence", "Control evidence", "Source evidence", "Retrieval evidence", "Before/after evidence"]);
  assert.equal(JSON.stringify(evidence), bytes);
});

test("unrecognized kinds use stable result positions without reading private content", () => {
  const evidence = ["constructor", "__proto__", "unknown"].map((kind, index) => ({
    id: `id:${index}`, kind,
    get data() { throw new Error("Do not inspect private content for labels"); },
  }));
  assert.deepEqual([2, 0, 2].map(i => citationPresentation(evidence[i].id, evidence).label),
    ["Evidence 3", "Evidence 1", "Evidence 3"]);
});

test("missing, ambiguous and different-result citations never resolve approximately", () => {
  const evidence = [{ id: "exact", kind: "comparison" }];
  for (const id of ["", " exact", "exact ", "EXACT", "exact:other", "other-result"]) {
    assert.deepEqual(citationPresentation(id, evidence), { index: null, label: "Evidence unavailable" });
  }
  assert.equal(citationPresentation("exact", [...evidence, ...evidence]).index, null);
  assert.equal(citationPresentation("exact", []).index, null);
  assert.equal(citationPresentation("exact", evidence).index, 0);
});

test("public copy uses only the known configuration distinction and never server messages", () => {
  assert.equal(astraUnavailableCopy({ status: "unavailable", code: "NOT_CONFIGURED" }),
    "Astra isn't enabled for this deployment. Listening, creation, and local analysis still work.");
  for (const value of [undefined, { status: "failed", code: "NOT_CONFIGURED" },
    { status: "unavailable", code: "PROVIDER_RATE_LIMIT" }, { status: "unavailable" }]) {
    assert.equal(astraUnavailableCopy(value),
      "Astra is unavailable. Listening, creation, and local analysis still work.");
  }
  const value = { status: "unavailable", code: "UNKNOWN", get message() { throw new Error("Private provider error"); } };
  assert.match(astraUnavailableCopy(value), /local analysis still work/);
  assert.equal(ASTRA_REQUEST_FAILED, "Astra couldn't complete this request. Your work is unchanged.");
});
