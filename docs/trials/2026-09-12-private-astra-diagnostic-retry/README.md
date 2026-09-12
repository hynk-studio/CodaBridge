# Single diagnostic retry: transport failure, stopped

**The one newly authorized investigation was submitted and failed. Native Worker fetch did not obtain an upstream HTTP response.** The private observer returned only:

```json
{"kind":"PROVIDER_TRANSPORT_FAILURE","httpResponseObtained":false}
```

The local application returned **HTTP 502 / `PROVIDER_FAILURE`** and displayed **Failed** with the existing generic message. No Astra explanation was accepted. Upstream HTTP status, error type/code, returned response/model IDs and token usage are unavailable. Whether the provider received or processed a request, and any charge, remain unknown; failure is not presumed free. There is no accepted answer to assess for quality or grounding.

## Authority and single submission

- [Owner authorization 5644852584](https://github.com/hynk-studio/CodaBridge/pull/3#issuecomment-5644852584), following [diagnostic review 5185926603](https://github.com/hynk-studio/CodaBridge/pull/3#pullrequestreview-5185926603).
- Local and remote source matched **`dfee97c742751fd003cded92c1c3477cc1675265`** before execution. No newer retry report or consumed record existed. Draft PR #3 and its PR #2 stack were preserved.
- A: **`dswp-1`**. B: **`dswp-2`**. Exact question: **“What differs in the timing of A and B, and what cannot be concluded?”**
- The browser clicked Investigate once at **2026-09-12 09:02:19.999 UTC**. The private launcher durably marked authorization consumed at **09:02:20.037 UTC**, before invoking the application handler. The diagnostic was retained at **09:02:20.062 UTC**. These are local timestamps, not model-latency measurements.
- The wrapper checked the authorized selection/question and used a one-submission guard plus exclusive creation of the consumed record. The browser observed one local investigation response; the observer produced one transport-failure item and the handler stopped. **No second investigation, replacement, further case, health-check inference, alternate-model call or evaluator call was made.** The authorization is consumed.

This classifies this retry's observed boundary only: fetch failed before the adapter obtained an HTTP response. It does not identify the exception cause or prove key validity/invalidity, Astra access, request-schema compatibility, provider non-receipt or zero cost. No application/transport repair, parameter change or further diagnostic request followed. The [first historical failed trial](../2026-09-12-private-astra/README.md) and all its files remain unchanged, unresolved and consumed; its old generic failure is not retrospectively reclassified.

## Actual runtime and privacy boundary

The actual built `dist/server/index.js` ran inside local workerd, through the default real provider adapter and native Worker fetch. Its SHA-256 was **`20a34a5fb80519f3a0ba28c2d8a5a264db8e5eb3b559f815e8f514106dcc9d3b`** (artifact hash only). Runtime: Node **v25.9.0**, Miniflare **5.20260911.0-alpha**, workerd **1.20260911.1**, compatibility date **2026-09-12**, bound only to loopback. The existing UI ran in Codex in-app Browser.

A temporary trusted Worker wrapper installed only `onPrivateProviderDiagnostic` on `createWorker`; `transport` and `deadlineMs` were unset. Separate private local service bindings recorded consumption and collected the already sanitized observer objects. They did not carry provider traffic. No mocked transport, provider shim, Node fallback fetch, alternate proxy/endpoint/model, remote Worker or deployment was used in this live path.

The existing canonical environment key was reused read-only, solely as an in-memory trial binding after builds. The launcher removed it from its inherited environment before starting workerd. No credential file, CLI value, repository copy, key hash, browser credential configuration or new key was created. Runtime exception/log output was suppressed; no raw error text, payload, headers, opaque reasoning, private paths or account identifiers are retained. The original credential source was not modified.

Both investigation flags were true only in that temporary runtime. The reviewed **`gpt-6-astra`**, low reasoning, **20-second deadline**, **1,800 output tokens per response**, **four rounds/tool calls**, prompts, schemas, recordings, metrics and every existing validation/privacy bound were unchanged. Existing flags remain operator acknowledgements, not authentication or a shared spending cap.

## Evidence

- [Sanitized observation](observation.json): consumed authorization, source/artifact/runtime, exact case, one private diagnostic, fixed application result, explicit unknowns and cleanup.
- [Current page evidence](current-evidence.json): the same selected original recordings and deterministic measurements, read once through the page's read-only WebMCP tool after failure. **`investigation: null`**; this is not an accepted server result, provider receipt or model tool-action record. Its generation time is the snapshot time. No UI download-delivery claim is made.
- [Actual failed UI capture](retry-failed.jpg): captured from the same stopped attempt, without resubmission. The public UI contains the generic failure, not the private diagnostic.

## Checks and cleanup

| Actual command/check | Result |
| --- | --- |
| `env -u OPENAI_API_KEY npm run build` | Passed, including TypeScript, client and actual Worker ESM artifacts. |
| `env -u OPENAI_API_KEY npm run data:verify` | Four original byte hashes, PCM metadata, source-card hash and deterministic annotations reproduce. |
| `env -u OPENAI_API_KEY node --check .tmp/private-diagnostic-retry-launcher.mjs` | Passed before launch. The temporary launcher was subsequently removed. |
| `env -u OPENAI_API_KEY npm run test:server-build` | **5 passed** before execution. These use explicitly test-only transports and are separate from the real trial outcome. |
| `node .tmp/private-diagnostic-retry-launcher.mjs` | Actual loopback workerd runtime became available. Initial GET `/` and availability both returned 200; startup submitted no investigation. |
| One in-app Browser submission; private callback and local response read | One diagnostic above; local 502 / `PROVIDER_FAILURE`; Failed UI and null investigation snapshot. No raw provider or local request payload/headers were retained. |
| Trial shutdown | Trial execution session ended; port closed before normal preview. Temporary launcher removed, transient bindings ended with the runtime, trial tab closed and the bounded keep-awake lease stopped. |
| `env -u OPENAI_API_KEY npm run preview`, then GET `/api/investigation/status` | **200 / `unavailable` / `NOT_CONFIGURED`** at **2026-09-12 09:04:49 UTC**. Both checked-in flags verified false. This was an availability read, not an investigation. |
| Normal preview shutdown and socket check | Normal preview stopped; loopback port closed. |
| Evidence inspection and `git diff --check` | Passed. Exact diagnostic shape, selected sources and null investigation verified; screenshot visually inspected; original trial directory and application source unchanged. |

No new full unit/browser suite was run for this reporting-only change; the diagnostic correction's earlier verification remains historical evidence. Live Astra compatibility, accepted answer quality, latency/output sufficiency, usage/cost, public access/budget decisions and hosted Sites verification remain unresolved. No cases 2/3, additional inference, application patch, account/provider change, provisioning, public enablement, Sites save/deployment, merge or force-push occurred.
