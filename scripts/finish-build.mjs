import { mkdir, readFile, writeFile } from "node:fs/promises";

// A Workers build must not carry the prior static-only hosting declaration.
const manifest = JSON.parse(await readFile(".openai/hosting.json", "utf8"));
if (manifest.static != null)
  throw new Error("A static-only manifest cannot describe the server build.");
await mkdir("dist/.openai", { recursive: true });
await writeFile(
  "dist/.openai/hosting.json",
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  "Worker entry: dist/server/index.js; assets: dist/client; metadata: dist/.openai/hosting.json.",
);
