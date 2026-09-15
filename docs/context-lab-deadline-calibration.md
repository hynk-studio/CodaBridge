# Context Lab deadline calibration

Base: accepted release `77badeaa2841ed53a4cd3c476f499dd5972578f8`, tree `14547e2330b55c4b4aeb638c22b21309f2312334`.

| Route | Previous total cap | Proposed total cap |
| --- | ---: | ---: |
| `/api/lab` | 20,000 ms | 60,000 ms |
| `/api/investigate` | 20,000 ms | 20,000 ms |
| `/api/composer` | 20,000 ms | 20,000 ms |

`LIMITS.labDeadlineMs` supplies the Lab-specific cap. The Worker selects the route cap before creating its existing request timer; the trusted deadline override can shorten that cap but cannot raise it. The same AbortSignal still covers request parsing and every provider/tool round. This is a total request deadline, not a fresh allowance per provider call.

## Previously completed diagnostic

The separately authorized local diagnostic on the exact base release established `TOTAL_DEADLINE_CONFIRMED`. The production-equivalent Lab request returned HTTP 504 / `TIMEOUT` at **20,005 ms**: provider round one returned HTTP 200 in **7.150 s**, then round two was aborted by the shared signal after **12.846 s**, without an earlier provider HTTP error.

The same request and unchanged contract completed through a trusted 60-second local outer deadline in **28.114 s**. Its provider rounds returned HTTP 200 in **6.889 s** and **21.159 s**. Both receipts named `gpt-6-astra`; the model requested `control_result` for offset 1, and the final explanation passed the unchanged validators. Input: `zenodo-10817697`, segment `sw061b001_124-from-row-2-60s-v1`, default `row-9`, offset 1; observed/control values were 0.1328669571 / 0.1438996286 seconds.

That evidence motivates calibration specifically for the Lab's multi-round path. It is one local case, not a hosted retest or a general latency guarantee. Longer Lab requests can remain in flight for up to 60 seconds; access gates and budget logic are unchanged. No live provider request was made while implementing or verifying this PR.

## Verification

macOS 26.6.2 arm64; Node v25.9.0; npm 11.12.1. All commands excluded the real `OPENAI_API_KEY`; transports used TEST ONLY fixtures. Dependencies were installed from the unchanged lockfile with `env -u OPENAI_API_KEY npm ci --no-audit --no-fund`.

| Command | Result |
| --- | --- |
| `env -u OPENAI_API_KEY node --experimental-strip-types --test tests/worker-deadline.test.ts` | 14 passed; fake clocks, no real 20+ second wait |
| `env -u OPENAI_API_KEY npm run typecheck` | Passed |
| `env -u OPENAI_API_KEY npm test` | 270 passed; 0 failed/skipped |
| `env -u OPENAI_API_KEY npm run lint` | Passed |
| `env -u OPENAI_API_KEY npm run build` | Client and Worker passed |
| `env -u OPENAI_API_KEY npm run test:server-build` | 15 passed with intercepted outbound transport |
| `env -u OPENAI_API_KEY CI=1 npm run test:browser -- tests/browser/context.spec.ts tests/browser/launch-calibration.spec.ts --grep 'late Lab response\|Lab answer opens once\|public request failures'` | 16 passed across desktop/mobile Chromium; no retries |
| `git diff --check` | Passed |

The new fake-clock regressions cover completion at 28 seconds, the shared 60-second total cap across Lab rounds, both other routes' 20-second caps, oversized/shortened overrides on every route, immediate cancellation, unchanged timeout bodies/private diagnostics, and no retries. Existing suites cover provider HTTP diagnostics, generic failures, Lab tool replay and offset handling, and browser stale-response suppression after row/offset/question/navigation changes.

The reported frozen numerical exact-equality failure did not reproduce in this run; its assertions, qualification and data were not changed. The existing Vite warning remains: client JavaScript **504.83 kB / 150.43 kB gzip**, above the 500 kB warning threshold. Browser tooling also reported `NO_COLOR` being ignored because `FORCE_COLOR` was set. No warning threshold or dependency was changed.

Only the route cap, focused tests and this note change. Model, endpoint, reasoning, prompts, tools, schemas, rounds, tool count, output tokens, byte limits, retry behavior, provider diagnostics, public copy, cancellation, access/budget logic, UI, research/data, Composer, Exchange/crypto and Sites linkage remain unchanged. No merge, deployment, inference enablement or new live Astra call occurred. Stop at Draft PR review.
