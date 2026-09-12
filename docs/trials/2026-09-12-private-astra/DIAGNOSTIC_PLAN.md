# Private diagnostic correction; no new live attempt

The [original case 1](README.md) remains **consumed and unresolved**. Its HTTP 502 / `PROVIDER_FAILURE` cannot be retrospectively classified as transport, authentication, model access, quota, request-schema or upstream-server failure. The old observation, evidence packet and screenshot are unchanged. Cases 2 and 3 remain unrun. This correction authorizes no retry or replacement attempt.

## New private boundary

`createWorker({ onPrivateProviderDiagnostic })` accepts a server-code callback. It is absent from the default exported Worker, has no HTTP route, request option or environment switch, and emits no logs. A trusted local trial wrapper can install it **without specifying `transport`**, retaining the native `fetch` of the Worker runtime. Ordinary visitor responses and comparison evidence exports never contain these diagnostics.

The callback receives only the following immutable objects, at most one per attempted provider round (four per investigation):

| `kind` | Retained fields | Meaning |
| --- | --- | --- |
| `PROVIDER_TRANSPORT_FAILURE` | `httpResponseObtained: false` | The adapter did not obtain an HTTP response before fetch threw or the existing deadline/cancellation won. No exception detail is retained. This does **not** prove that no request reached or was processed by the provider. |
| `PROVIDER_HTTP_FAILURE` | `httpResponseObtained: true`, `upstreamStatus`, `errorEnvelopeParseable`, `errorType`, `errorCode` | A non-2xx response was obtained. The status is retained even when its body cannot be read or parsed. |
| `PROVIDER_HTTP_RESPONSE` | `httpResponseObtained: true`, `upstreamStatus` | A 2xx response was obtained, before output validation. This alone establishes no accepted explanation. |

The adapter throws distinct `PROVIDER_TRANSPORT_FAILURE` / `PROVIDER_HTTP_FAILURE` boundary errors. The public handler maps both to the existing HTTP 502 / `PROVIDER_FAILURE` and the same generic failure message. Deadline/cancellation still returns HTTP 504 / `TIMEOUT`, including when an HTTP error body hangs; its private observation still records the obtained status. An empty callback collection means no observation was produced, not a transport verdict.

## Error-envelope limits

Only an explicitly installed private collector causes a non-2xx body to be read. Reading uses the existing investigation deadline and a smaller **4,096-byte** bound. The ordinary handler cancels the body immediately. No path retries.

`errorEnvelopeParseable: true` means a complete, bounded, valid UTF-8 JSON object with an object-valued `error` member was read. It does not require recognized `type`/`code`, certify the envelope's other fields, or validate the request. False covers malformed JSON/envelopes, missing bodies, invalid encoding, size rejection, read exceptions and deadline/cancellation; those causes intentionally remain indistinguishable. A partial or oversized body is never parsed as a valid prefix.

`errorType` and `errorCode` use exact string membership in the finite allowlists in [provider-diagnostics.ts](../../../server/provider-diagnostics.ts). Unknown, missing, null, non-string, prefixed/suffixed or whitespace-altered values become the literal `unknown`. No normalization or free-text matching occurs. Recognized values include `invalid_request_error`, `invalid_api_key`, `model_not_found`, rate/quota codes and server-error codes. The allowlists are deliberately incomplete, not an authoritative enumeration of every OpenAI error.

The parser transiently reads bounded JSON to select those fields; it retains no message, `param`, raw body, payload, headers, Authorization, credential or credential hash, organization/project identifier, URL, stack or private path. Names such as `project_spend_limit_exceeded` are fixed classifications, not project identifiers. Callback exceptions and rejected promises are ignored without logging or another request.

Current [official OpenAI error guidance](https://developers.openai.com/api/docs/guides/error-codes), checked September 12, 2026, distinguishes HTTP, rate/quota and server failures. A status or provider classification narrows investigation; it is not independent proof of a bad key or a unique cause. In particular, a model-access-style response does not separate a missing model from inaccessible model access, and a 401 alone does not prove key revocation. An independently successful key check also does not prove Astra Responses access, quota or schema compatibility.

## Next separately authorized single attempt

1. Review the updated commit and any new single-attempt authority. Keep the original consumed-case journal and historical evidence intact; do not reuse that case's authority. Build and run ordinary checks with `OPENAI_API_KEY` removed from the process environment.
2. Prepare a loopback-only wrapper **inside workerd**, importing `createWorker` from the actual `dist/server/index.js`. For each investigation, install a synchronous callback that appends these objects to a request-local in-memory array. Leave `transport` and `deadlineMs` unset. Calling this factory from Node with the default Node fetch would test a different transport and is not a valid live trial.
3. After the handler settles, collect only that array through the local launcher's private evidence channel, separate from its visitor HTTP response and public evidence export. Do not log arbitrary Worker exceptions or serialize the request, response, environment or callback errors. A collector is code supplied by a trusted operator, not a security sandbox; it must remain local and private. This correction does not install or run a live launcher or evidence sink.
4. Under separate authority, reuse the canonical environment credential only in the temporary runtime. Submit exactly the newly authorized attempt, capture the public outcome and private sanitized observations, then stop. No inference probe, alternate model/proxy/Node fetch, retry, remote Worker or limit change. Missing diagnostics are a collection gap, never permission to retry.

The endpoint, default Worker fetch, redirects, model, request schema, **20-second deadline, 1,800-token output budget, four rounds/tool calls**, output validation and all existing byte limits are unchanged. Tests use explicitly synthetic transports and dummy credentials only. They establish local classification, bounds, public/export separation and preserved tool/validation behavior; they prove neither key validity, model access, real transport reachability nor live request compatibility. Live latency, output sufficiency, usage/cost, answer quality and hosted Sites behavior remain unverified. Operator flags still provide neither authentication nor a shared spending cap. No live provider request, public enablement, Sites creation/save/deployment, merge or force-push occurred in this correction.
