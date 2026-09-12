# Non-inference Worker transport diagnosis

**The new probes reproduce a local Request-construction failure, including without Authorization. General workerd egress and unauthenticated OpenAI GET/POST transport succeeded.** This identifies a construction boundary to investigate; it does not assign a cause retroactively to either consumed inference attempt.

Source: **`0a7f1cb94075c973218682f5b83a9d9f9571625f`**, matching local/remote HEAD before execution. Existing Draft PR #3 remains stacked on PR #2. The [first trial](../2026-09-12-private-astra/README.md) and [consumed diagnostic retry](../2026-09-12-private-astra-diagnostic-retry/README.md), including all their evidence, are unchanged.

## Observed results

Phase 0 ran inside workerd without network activity. Only these fixed booleans were retained:

```json
{
  "trimmed_exact": true,
  "contains_cr": false,
  "contains_lf": false,
  "contains_other_invalid_header_control": false,
  "contains_invalid_header_control": false,
  "authorization_headers_constructible": true,
  "authorization_request_constructible": false,
  "request_constructible_without_authorization": false
}
```

The header-control check covered CR/LF and the remaining HTTP-invalid C0 controls/DEL, excluding permitted horizontal tab. The Request check used the adapter's POST endpoint, header construction, AbortSignal and `redirect: "error"`, with a fixed `{}` body solely for construction. A separate no-network control removed Authorization while retaining the other options; it also failed. No exception text was collected, and the key was not normalized or modified.

| Boundary | Native custom-workerd observation |
| --- | --- |
| Phase 1: general egress, one unauthenticated GET to `https://example.com/` | HTTP response obtained: **true**, status **200**. |
| Phase 2: OpenAI HTTPS, one unauthenticated GET to `https://api.openai.com/v1/models` | HTTP response obtained: **true**, status **401**. Transport succeeded; this was deliberately unauthenticated. |
| Phase 3: OpenAI POST, one unauthenticated POST to `https://api.openai.com/v1/responses` | HTTP response obtained: **true**, status **401**. Body was only `{}`, without a model, user/source material or Authorization. No inference was requested. |
| Phase 4: authenticated non-inference models GET | **Skipped**: Phase 0's required Authorization Request construction did not succeed. Authenticated binding/access and request completion remain untested. |
| Normal Wrangler egress comparison | **Skipped**: custom Phase 1 obtained an HTTP response, so the comparison condition was not met. |

Exactly **three** Worker network fetch invocations ran, all unauthenticated, one per authorized Phase 1–3. There were **zero authenticated network probes and zero model inference requests**. No retries, replacement probes, alternative endpoints/models or evaluator calls occurred. The consumed inference authorization was not reused.

## Runtime, controls and evidence

The custom execution shape matched the failed trial: Node **v25.9.0**, Miniflare **5.20260911.0-alpha**, workerd **1.20260911.1**, compatibility date **2026-09-12**, Workers ESM wrapper around the same built artifact, local assets and private claim/evidence bindings, native Worker fetch, loopback only, telemetry/log output disabled. The temporary wrapper added only private probe dispatch. Investigation flags stayed **false**, including inside this runtime. No application handler investigation was submitted.

Minimal network probes used a 20-second deadline and `redirect: "manual"` to return a redirect without a second request. This was a diagnostic harness option, not an application/provider-parameter change. Phase 0 retained the adapter's existing `redirect: "error"`. [Cloudflare's Request documentation](https://developers.cloudflare.com/workers/runtime-apis/request/), checked September 12, 2026, documents these modes; documentation alone does not explain which initializer field failed in this local runtime.

The existing canonical environment key was reused read-only in memory for Phase 0 and removed from the launcher's inherited environment before workerd started. No key value, length, prefix, hash, locator, derived identifier or header was retained. Every network response body was cancelled unread; only status/response-obtained booleans were selected. No bodies, inventories, headers, provider error text, account identifiers, stacks or private paths were recorded. Node controlled the local runtime only; no Node fetch, curl, proxy, remote Worker or hosted runtime substituted for Worker egress.

[Sanitized observation](observation.json) records the booleans/statuses, phase timing, explicit skips, artifact identity and cleanup. `env -u OPENAI_API_KEY node --check .tmp/non-inference-worker-probes.mjs` passed before `node .tmp/non-inference-worker-probes.mjs` executed the bounded phases. The probe journal marked each phase before execution and guarded against repetition. The runtime was disposed, its loopback port was confirmed closed, and the temporary harness was deleted. Checked-in/default access remains disabled; the original credential source is unchanged.

Sanitized-field/source-binding checks and `git diff --check` passed. No application source, provider parameters, recordings, metrics, dependencies or existing reports changed; no full application test suite was rerun for this report-only change. No patch, merge, deployment or public enablement occurred.

## Conclusion and smallest next action

These observations do not support a general custom-workerd egress failure or an OpenAI-only HTTPS/POST reachability failure at probe time. They reproduce a Request initializer failure independently of Authorization. Clean key-format booleans and successful Headers construction do not prove credential validity; Phase 4 was correctly not run. DNS versus TLS internals, authenticated OpenAI access, Astra request compatibility and the precise failing initializer field remain unestablished.

**Next: isolate the failing Request initializer option with a no-network constructor regression test.** Do not change the key or retry inference based on this report.
