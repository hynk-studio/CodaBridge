# Private Astra trial: stopped on case 1

**One private local investigation was submitted. It returned HTTP 502 / `PROVIDER_FAILURE`; no explanation was accepted. Cases 2 and 3 remain unrun.** The real adapter was exercised, but an upstream Astra request or response was not confirmed. No retry, replacement, extra inference probe or application correction followed the failure.

Authority: [owner comment 5644528950](https://github.com/hynk-studio/CodaBridge/pull/3#issuecomment-5644528950), following [review 5185738234](https://github.com/hynk-studio/CodaBridge/pull/3#pullrequestreview-5185738234). This report records consumption of the first case; an interrupted or failed attempt must not be treated as unused authorization.

## Executed source and runtime

- Source: `e28bedb1ebdcf8e38a6839cda4d5c484c7a06af1`, branch `codex/mvp-02-grounded-investigation`; Draft PR #3 remains stacked on Draft PR #2.
- Actual built `dist/server/index.js`, default real provider adapter, running in local workerd. Artifact SHA-256: `ace62ff4a05ae2d3941def6204157efc4dcd45c452d962b9022d3ccbe100bfb5` (the artifact hash, never a credential hash).
- Node `v25.9.0`, Miniflare `5.20260911.0-alpha`, workerd `1.20260911.1`; compatibility date `2026-09-12`. Browser: Codex in-app Browser on `http://127.0.0.1:4173/`.
- A temporary launcher supplied in-memory server bindings through Miniflare's workerd configuration pipe. The existing `OPENAI_API_KEY` environment binding was reused read-only after building, then removed from the launcher's inherited environment before starting workerd. No credential file was acquired, copied, changed or retained. Builds and ordinary tests explicitly excluded that variable.
- Before submission, ordinary launcher setup was corrected for the installed Miniflare API converter and its assets/user-worker binding. Those setup failures submitted no investigation. No application semantics, prompts, source data, provider transport, validation, checked-in configuration or limits changed.
- Requested configuration remained `gpt-6-astra`, low reasoning, 20 seconds per investigation, 1,800 output tokens per response, four provider requests per investigation and all existing smaller bounds. No mocked provider transport was injected.

## Observed cases

| Case | Selection and exact question | Outcome |
| --- | --- | --- |
| 1 | `dswp-1` / `dswp-2`: “What differs in the timing of A and B, and what cannot be concluded?” | Submitted once at **2026-09-12 08:04:31.256 UTC**. HTTP **502**, code **`PROVIDER_FAILURE`**. UI displayed **Failed**. No accepted explanation or returned tool-action record; usefulness and grounding cannot be assessed. |
| 2 | `dswp-1` / `dswp-2`: “Find another recording closest to A under the normalized interval metric.” | **Unrun** after the first stop condition. Model-initiated retrieval and its grounding were not tested live. |
| 3 | `dswp-1` / `dswp-7`: “Can this pair be compared with the current normalized interval metric? Explain the limitation.” | **Unrun** after the first stop condition. The four-source catalog was visible, but no unequal-count live investigation was submitted. |

The sanitized failure was: “The investigation could not be validated. Listening and comparison remain available.” The generic error does not establish a particular network, authentication, configuration or upstream HTTP cause. No failure diagnosis was converted into another paid attempt.

Browser CDP observed **one** `/api/investigate` request and its 502 response. Request-to-response-headers latency was **12.487 ms**; this is local application latency, not model latency. The workerd CDP Network observer was enabled but recorded **no provider request events**. Consequently, upstream request count and whether the provider was reached remain **unknown**, not zero. Returned model/response IDs, token usage and charges are also **unknown**. Failed requests are not presumed free; no cost estimate is reported.

## Evidence

- [Sanitized observation](case-1-observation.json): exact submission, browser timing, failure and explicit unknowns/unrun cases.
- [Current page evidence packet](case-1-current-evidence.json): selected original recordings, machine estimates and deterministic comparison; **`investigation: null`**. This is a current-page WebMCP read after the failure, not an accepted server investigation or a provider tool receipt. Its existing `generatedAt` is the packet creation time, not the submission timestamp.
- [Actual failure screenshot](case-1-failed.jpg): the same case's question, Failed state and error, without resubmission. Historical mocked screenshots are unchanged.

The UI's Download evidence action was invoked once and showed “Evidence download requested for the current selection.” The browser download event timed out, so successful file delivery was not confirmed; the corresponding read-only page packet was retained instead. No credentials, headers, raw provider payloads, opaque reasoning or private credential locations are retained. No human listening or annotation review is claimed.

## Checks and cleanup

| Command/check | Result |
| --- | --- |
| `env -u OPENAI_API_KEY npm run build` | Passed, including TypeScript and actual client/Worker artifacts. |
| `env -u OPENAI_API_KEY npm run data:verify` | Four original byte hashes, PCM metadata, source-card hash and deterministic annotations reproduce. |
| `env -u OPENAI_API_KEY npm run test:server-build` | **4 passed**; mocked artifact checks remain separate from this failed real-adapter attempt. |
| `node .tmp/private-live-astra-launcher.mjs` | Temporary loopback runtime became available; startup itself submitted no investigation. Launcher removed after shutdown. |
| Trial shutdown | Trial launcher absent and loopback port closed before normal preview was started. In-memory bindings removed with the runtime; original credential source unchanged. Trial tab and bounded keep-awake lease closed/stopped. |
| `env -u OPENAI_API_KEY npm run preview`, followed by GET `/api/investigation/status` | HTTP **200**, **`unavailable` / `NOT_CONFIGURED`**. Both checked-in access flags remain `false`. This check submitted no investigation. The temporary normal preview was then stopped. |
| Evidence JSON inspection and `git diff --check` | Passed: correct selection, failed outcome, null investigation/usage/request count, and unrun cases retained. No known credential/fixture markers in retained text; screenshot visually inspected. |

The trial is stopped at its required first-failure boundary. Provider-failure diagnosis and any new paid attempt need a separate scope; no application repair or limit relaxation occurred here. Live Astra compatibility, answer quality, retrieval, unequal-count handling, model latency/output sufficiency and usage remain unverified. Public access/shared-budget decisions and hosted Sites verification remain separate. Existing flags are not authentication or a shared spending cap. No public enablement, paid provisioning, account/budget change, Site creation/save/deployment, merge or force-push occurred.
