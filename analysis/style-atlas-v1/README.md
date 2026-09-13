# Observed Timing / Style Atlas v1

Descriptive derivation authorized by [issue #15](https://github.com/hynk-studio/CodaBridge/issues/15). [Executed findings and product verification](../../docs/MVP_06.md). No fitting, clustering, new biological categories, provider access or external metadata ingestion.

From the repository root with Node 22.18+ and Python 3.9+ (stdlib only):

```sh
env -u OPENAI_API_KEY npm run atlas:generate
env -u OPENAI_API_KEY npm run atlas:check
env -u OPENAI_API_KEY npm run atlas:verify
env -u OPENAI_API_KEY node --experimental-strip-types --test tests/atlas.test.ts
```

`generate` runs the complete unchanged CSV through `parseAnnotations`, creates all 3,790 record features, retains the original 50 exclusions, and generates all 28 count summaries (including empty counts). It preflights every output and refuses to overwrite different bytes. `check` reproduces everything in memory, compares exact serialized bytes, and writes nothing. Outputs are the public report/summary, the new `src/atlas/manifest.json`, and [method.json](method.json); no historical artifact is regenerated.

The compact measurement definitions in `src/atlas/method.ts` were written before the first derivation. `methodSha256` hashes the newline-terminated compact JSON array of producer file identities, in recorded order; each file's SHA-256 and bytes are independently checked. This binds the definitions, extractor, existing timing/parser owners and generator without inventing a self-referential artifact-commit hash. The report records the actual starting base. These are descriptive method definitions, not a confirmatory preregistration or a freeze on later application development.

`verify` validates the browser schema, sends 51 fixed same-count nearest-reference probes to [verify.py](verify.py), and independently checks source, producer and artifact hashes, every raw row binding, feature, quantile, root contribution and exclusion. Python consumes the preserved full parser-derived intermediate in `analysis/dialogue-transfer/inputs/validated.json` plus original CSV strings. It does not implement another acceptance policy. Its numerical checks use independent stdlib arithmetic (`statistics.pstdev`, weighted linear quantiles); agreement tolerance is `1e-10`. No old estimator runs.

Quantiles use sorted values and `h=(N−1)q`, with linear interpolation at q=0.10/0.50/0.90. Empty groups return null; singletons repeat their value; ties remain unchanged. UI ranges require at least 20 records and three roots, independent of shape or outcome. The download retains all numeric sparse summaries. Roots are provenance labels, not independent animals or encounters. Per-position quantiles, including medians, never supply an audition or an allegedly observed template.

The browser lazily fetches the 48,349-byte summary and 4,769,558-byte report only when Atlas/reference is enabled. It checks streamed byte bounds, exact lengths, SHA-256, versions, source/method identity, all row dimensions and bindings, reconstructed timing/features and full count/support parity before showing results. Validated bytes are cached only in process for reuse and direct download. Failures have an explicit retry; no fallback fixture or stale comparison is substituted. All user timing comparisons stay local.

Annotation playback has its own maximum 29-event/120-second whole-row schedule and overlap-based attenuation, using the unchanged shared renderer/player. Composer's stricter 12-click and 0.04-second limits remain unchanged. An audio-bound failure leaves source inspection and downloading available.
