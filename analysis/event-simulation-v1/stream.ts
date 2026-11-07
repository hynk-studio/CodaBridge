import { createHash } from "node:crypto";
import { once } from "node:events";
import { generate, prepare, protocol, type Family, type Variant } from "./generator.ts";
for (const family of protocol.families as Family[]) for (const variant of protocol.variants as Variant[]) {
  const n = variant === "clean" ? protocol.primaryRealizations : protocol.observationRealizations;
  for (let i = 0; i < n; i++) {
    const seed = protocol.seedStart + i, generated = generate(family, variant, seed);
    const row = { family, variant, seed, annotationSha256: createHash("sha256").update(generated.csv).digest("hex"), observation: generated.counts, ...prepare(generated.csv) };
    if (!process.stdout.write(JSON.stringify(row) + "\n")) await once(process.stdout, "drain");
  }
}
