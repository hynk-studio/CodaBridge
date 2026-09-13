import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { checkedBytes, identity, sources } from "./io.ts";
for (const s of sources()) {
  assert.match(s.commit, /^[a-f0-9]{40}$/);
  assert.equal(s.url, `https://raw.githubusercontent.com/${s.repo}/${s.commit}/${s.path}`);
  assert.ok(s.cachePath.startsWith("data/raw/metadata-linkage/") && !s.cachePath.includes(".."));
  if (existsSync(s.cachePath)) checkedBytes(s.cachePath, s);
  else {
    const response = await fetch(s.url, { redirect: "error", signal: AbortSignal.timeout(60000) });
    assert.ok(response.ok, `${s.id}: HTTP ${response.status}`);
    const b = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(identity(b), { bytes: s.bytes, sha256: s.sha256, gitBlob: s.gitBlob }, s.id);
    mkdirSync(dirname(s.cachePath), { recursive: true }); writeFileSync(s.cachePath, b, { flag: "wx" });
  }
  console.log(`Verified pinned bytes: ${s.id}`);
}
