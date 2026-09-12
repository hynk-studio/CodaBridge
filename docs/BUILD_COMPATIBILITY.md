# Build, model and Sites compatibility

Checked September 12, 2026 for MVP-02. **Local client/Worker build and mocked transport verified. Live Astra and hosted Sites are not tested.**

## Actual server artifact

The existing portable React/Vite UI and deterministic domain code remain. Vite builds client assets to `dist/client` and a Workers-compatible ESM entry to `dist/server/index.js`, with a default object exposing `fetch(request, env)`. The server delegates non-API paths through `env.ASSETS.fetch(request)`. No conventional Node server or framework migration is assumed.

The installed OpenAI Sites building/hosting instructions (plugin **0.1.66**) specify that Worker entry and `dist/.openai/hosting.json`. The old static-only manifest is replaced by `{}` and copied into the build. There is no `project_id`, registered Site, or borrowed linkage. The source and packaged manifest have no `static` field. The plugin's local artifact staging checker is used without Site creation, upload, save or deployment.

```sh
npm ci
npm run build
npm run test:server-build
npm run preview
```

`wrangler.local.json` is a local preview configuration, not Sites linkage. `npm run preview` runs **Wrangler 4.131.1/workerd** on loopback port 4173 with telemetry disabled and both access gates false. It serves the actual built Worker and original WAV assets. [Workers fetch handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/) and [assets binding/routing documentation](https://developers.cloudflare.com/workers/static-assets/binding/) describe this local execution shape. Local workerd acceptance is not evidence that Sites has accepted or hosted it.

Host: macOS arm64, Node 25.9.0, npm 11.12.1. Lockfile versions include Vite 8.3.0, React/React DOM 19.3.0, TypeScript 6.0.3 and Playwright 1.63.0. Node 22.18+ remains the declared minimum; that minimum was not independently tested. The MVP-01 starter provenance remains in its historical verification and Git history.

## Provider compatibility

Current official documentation resolves the intended identifier as **`gpt-6-astra`** and lists Responses, function calling and structured outputs. The adapter requests that exact model at `https://api.openai.com/v1/responses`, with low reasoning effort, strict function schemas, strict JSON output, `parallel_tool_calls: false`, `store: false` and a bounded output-token limit. There is no model/endpoint fallback.

Stateless Responses reasoning items are replayed internally with tool-call outputs as documented. Opaque reasoning, raw responses and errors are never exported or logged. Final text, tool arguments and evidence references are validated independently of the provider's schema enforcement. Provider response IDs, model, timestamp and token counts are copied only when actually returned and structurally valid; missing fields stay absent. Local start/completion timestamps are recorded by the handler, not invented provider run metadata.

Official sources checked:

- [Astra model](https://developers.openai.com/api/docs/models/gpt-6-astra)
- [Function calling](https://developers.openai.com/api/docs/guides/function-calling)
- [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Reasoning and stateless replay](https://developers.openai.com/api/docs/guides/reasoning)

No documented identifier/API incompatibility was found. **Actual account entitlement, live model behavior/quality, latency, token consumption and hosted secret injection remain unverified.** A mock transport cannot establish those properties.

## Server access remains disabled

A future explicitly authorized server run must supply all three server-only bindings: `CODABRIDGE_INVESTIGATION_ENABLED` equal to `true`, `CODABRIDGE_ACCESS_REVIEWED` equal to `true`, and `OPENAI_API_KEY`. The second flag is an operator acknowledgement, not an access-control service, spend limiter or proof of review. The repository's local preview deliberately sets both flags to `false`. No enabling configuration or credential was acquired in this task.

Development-time credential use must read the existing `OPENAI_API_KEY` from the process environment when separately authorized; never put its value in a source file, `.env`, CLI argument, screenshot, browser configuration or exported evidence. Future hosted binding setup and access/budget controls require their own review before public enablement. A client `VITE_*` key is never appropriate.

There is no cross-request budget accounting, authentication or abuse-control service in this slice. The finite loop/deadline/output bounds constrain one request only. Sites creation, registration, source upload, version save, deployment, production access and hosted audio/range behavior are all deferred.
