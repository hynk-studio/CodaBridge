import assert from "node:assert/strict";
import test from "node:test";
import { joinTables, interpret, summarize, verifiedJoin } from "../src/spectral/model.ts";
import { EXTRA_FIELDS, SHARED_FIELDS } from "../src/spectral/contract.ts";
const base = { codanum: "1", autovpkcodastr: "ai", autovbycoda: "?", mismatchN: "1", mismatchpct: "50", meandist_pk1: "10", meandist_pk2: "20", meandiff_pk1: "10", meandiff_pk2: "20", focal: "False", whale: "", codatype: "2-NOISE", handv: "", Duration: "1.0", URN: "-1", AIS_Data: "1*" };
function csv(rows: Record<string, string>[], env = false) { const keys = env ? [...SHARED_FIELDS, ...EXTRA_FIELDS] : SHARED_FIELDS; return keys.join(",") + "\n" + rows.map(r => keys.map(k => r[k]).join(",")).join("\n") + "\n"; }
test("join retains raw special codes, missingness, both lines and field provenance without audio", () => {
  const r = joinTables(csv([base]), csv([base], true), 1);
  assert.equal(r.status, "verified"); assert.equal(r.rows[0].spectralLine, 2); assert.equal(r.rows[0].environmentLine, 2);
  assert.equal(r.rows[0].raw.AIS_Data, "1*"); assert.equal(r.rows[0].interpreted.URN, null); assert.equal(r.rows[0].interpreted.whale, null);
  assert.equal(r.fields.Duration.unit, "seconds"); assert.equal(r.waveformMapping, "unavailable"); assert.equal(summarize(r.rows).unknownProducer, 1);
});
test("duplicate, missing and unmatched IDs cannot silently select rows", () => {
  for (const right of [[base, base], [{ ...base, codanum: "2" }], [{ ...base, codanum: "" }]]) {
    const r = joinTables(csv([base]), csv(right, true), right.length); assert.equal(r.status, "blocked"); assert.deepEqual(r.rows, []); assert.ok(r.issues.length);
  }
});
test("all shared differences and schema failures block admission", () => {
  const r = joinTables(csv([base]), csv([{ ...base, handv: "i", focal: "True" }], true), 1);
  assert.equal(r.counts.sharedFieldDifferences, 2); assert.equal(r.rows.length, 0);
  assert.equal(joinTables('bad\n1\n', csv([base], true), 1).status, "blocked");
  assert.equal(joinTables('"unterminated', csv([base], true), 1).status, "blocked");
});
test("non-finite values remain missing, not zero; booleans and raw tokens are not conflated", async () => {
  const r = interpret({ ...base, Duration: "Infinity", mismatchN: "", focal: "-1" });
  assert.equal(r.Duration, null); assert.equal(r.mismatchN, null); assert.equal(r.focal, null);
  await assert.rejects(() => verifiedJoin([new File(["wrong"], "codasp.csv")]), /both/);
  await assert.rejects(() => verifiedJoin([new File(["wrong"], "codasp.csv"), new File(["wrong"], "codasp_w_urn.csv")]), /Expected pinned/);
});
