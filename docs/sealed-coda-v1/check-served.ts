// Local, provider-free evidence probe. Run from the repository root after build
// with the normal preview already listening on 127.0.0.1:4173.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { inputFor } from "../../tests/fixtures/provider.ts";

const base = "http://127.0.0.1:4173";
const sha = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const response = await fetch(base);
assert.equal(response.status, 200);
const html = Buffer.from(await response.arrayBuffer());
assert.ok(html.equals(readFileSync("dist/client/index.html")));
const paths = [...html.toString().matchAll(/(?:src|href)="(\/assets\/[^" ]+)"/g)].map(x => x[1]);
assert.equal(paths.length, 2);
const assets = [];
for (const path of paths) {
  const delivered = await fetch(base + path);
  assert.equal(delivered.status, 200);
  const bytes = Buffer.from(await delivered.arrayBuffer());
  assert.ok(bytes.equals(readFileSync("dist/client" + path)));
  assets.push({ path, bytes: bytes.length, sha256: sha(bytes), exactBuiltBytes: true });
}
const status = await fetch(base + "/api/investigation/status");
assert.equal(status.status, 200);
const availability = await status.json() as { status: string };
assert.equal(availability.status, "unavailable");
const refusals = [];
for (const path of ["/api/investigate", "/api/composer", "/api/lab"]) {
  const result = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify(path === "/api/investigate" ? inputFor() : {}) });
  assert.equal(result.status, 503);
  const body = await result.json() as { status: string; code: string };
  assert.equal(body.status, "unavailable");
  refusals.push({ path, httpStatus: result.status, status: body.status, code: body.code });
}
console.log(JSON.stringify({ scope: "Local built preview; no hosting or live model evidence", base, html: { bytes: html.length, sha256: sha(html), exactBuiltBytes: true }, assets, serverBuildSha256: sha(readFileSync("dist/server/index.js")), availability, refusals }, null, 2));
