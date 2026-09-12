# Offline Request constructor diagnosis and correction

**The installed workerd runtime accepts `redirect: "manual"` and rejects `redirect: "error"`. Every header, body and AbortSignal control succeeded.** The conditional correction authorized for [Draft PR #3](https://github.com/hynk-studio/CodaBridge/pull/3) therefore changes only that redirect option in `server/provider.ts`.

Starting local/PR head: **`d4c9fb632db11161eaf2bfdcbd23e38337632e13`**. Review: **5186002102**. The existing branch and PR #2 dependency are preserved.

## Constructor matrix, before the application patch

Each case used `new Request` inside native workerd, the provider's existing URL string `https://api.openai.com/v1/responses`, and no fetch. POST cases added the options cumulatively: method, `content-type: application/json`, then the harmless string body `{}`. The signal was a local `AbortController.signal` with the existing 20-second timer pattern, cleared after construction. Only these pass/fail booleans were emitted; exceptions were caught without inspecting or recording their text.

```json
{
  "url_only": true,
  "post": true,
  "post_content_type": true,
  "post_content_type_body": true,
  "full_manual": true,
  "full_error": false,
  "full_manual_signal": true,
  "full_default_signal": true
}
```

`full_default_signal` omits redirect and retains POST, headers, body and the signal. The matrix made **zero fetch calls**. No real credential was read or bound. The optional real Authorization repetition was unnecessary because the failing option was isolated without Authorization; authenticated key binding remains untested by this task.

Runtime: Node **v25.9.0**, Miniflare **5.20260911.0-alpha**, workerd **1.20260911.1**, compatibility date **2026-09-12**. The test uses the failed trial's custom Miniflare conversion/Workers ESM execution shape, actual built Worker and local assets. Test-only differences are an ephemeral loopback port, a constructor wrapper instead of a trial submission, no credential binding, and an in-process outbound binding that prevents external egress. Telemetry and runtime logging are disabled. No Node Request substitute or Node fetch fallback was used for the matrix.

## Narrow correction and redirect regression

`redirect: "error"` becomes **`redirect: "manual"`**. No automatic redirect following is enabled. The existing non-2xx branch still rejects every 3xx; no validation or diagnostic acceptance rules change. Endpoint, model `gpt-6-astra`, low reasoning, 20-second deadline, 1800 output tokens per response, four rounds/tool calls, prompts, schemas and all byte bounds are unchanged.

The regression runs the actual built factory with its default native Worker fetch. A clearly labeled **test-only in-process outbound service** supplies synthetic HTTP **301, 302, 303, 307 and 308** responses, including same-origin and cross-origin redirect destinations. No network endpoint is contacted and no real credential is present. Each case verifies:

- Exactly one initial fixture call, with the dummy Authorization header present.
- Zero calls to the redirect destination, so no Authorization forwarding occurs.
- Local HTTP 502 with generic public `PROVIDER_FAILURE` and no accepted explanation.
- Private `PROVIDER_HTTP_FAILURE` with the fixture status, `errorEnvelopeParseable: false`, and fixed `unknown` type/code; the dummy credential and redirect destination are absent from the returned test observation.

Before rebuilding, all five redirect cases failed against the old artifact with `PROVIDER_TRANSPORT_FAILURE`, as expected for the reproduced incompatibility. After rebuilding with the one-line change, all five passed. The native constructor matrix also passes as a permanent regression in the built-server suite, with error-mode failure pinned to this installed runtime behavior.

## Verification

Every command below ran with `env -u OPENAI_API_KEY`. Fixtures and runtime control remained local; no provider transport probe, authenticated request, model inference or evaluator request ran.

| Command | Actual result |
| --- | --- |
| `node --experimental-strip-types --test tests/artifact/workerd-redirect.test.ts` before the patch | Initial constructor-only run: **1 passed**; exact matrix above. |
| Same command with the new redirect cases against the old built artifact | Expected regression failure: five redirect cases received transport failure instead of HTTP failure; no external egress. |
| `node --experimental-strip-types --test tests/provider-compatibility.test.ts tests/provider-diagnostics.test.ts tests/investigation.test.ts` | **88 passed**. Existing success, mixed tool flow, final validation and diagnostic privacy coverage retained. |
| `npm test` | **111 passed**. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed. |
| `npm run data:verify` | Passed: four original byte hashes, PCM metadata, source-card hash and deterministic annotations reproduce. |
| `npm run build` | Passed: client and Worker artifacts plus unchanged empty hosting metadata. |
| `npm run test:server-build` | **12 passed**, including the native matrix and five synthetic redirects. |
| `node --experimental-strip-types .tmp/constructor-browser-check.ts` → `npm run test:browser` | **22 passed** at existing desktop/mobile sizes. The temporary launcher served the built Worker/assets with external egress intercepted and zero outbound fixture calls. The unchanged browser suite reused this loopback preview; normal Wrangler startup was not invoked. |
| `git diff --check` | Passed. |

The temporary browser launcher was deleted, runtimes disposed and the trial port closed. The generated screenshot change was discarded; prior screenshots and all historical trial files are unchanged. The native default Worker status remained `unavailable` and checked-in investigation flags remain false. No credential source was accessed or modified. Test fixtures remain under `tests/` and do not ship in the client or server artifacts.

## Limits and next action

This controlled reproduction establishes the incompatible RequestInit option in this local runtime and verifies the narrow correction with synthetic redirects. It does **not** retrospectively classify the causes of the [first failed inference](../2026-09-12-private-astra/README.md) or the [consumed diagnostic retry](../2026-09-12-private-astra-diagnostic-retry/README.md). Their original observations, authorizations and evidence remain unchanged and consumed. The [earlier transport probes](../2026-09-12-worker-transport/README.md) were not repeated.

Credential validity, authenticated binding, Astra access/request compatibility, live latency/output sufficiency and hosted Sites operation remain unproven. No live response, response/model ID or usage receipt was obtained. GitHub review/readback, commit push and this PR update are the only external repository operations; diagnosis and verification used local runtime control and fixtures only. No merge, deployment, public enablement or new product feature is included.

**Next: review this correction; any real Astra attempt requires separate authorization.** No inference authorization was consumed or reused in this task.
