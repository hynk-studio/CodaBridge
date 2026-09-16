# Context Lab answer completeness

Base: `ae0396184b0426713a05b3e18fe0d119b49e5009` (`main`, including merged PR #28).

## Earlier hosted v5 evidence

The production request completed with HTTP 200 in **10.7965 s**, returned `gpt-6-astra`, and included model-initiated `control_result` for **offset 1**. It used one `/api/lab` request, with no retry; exact citation/action navigation and teardown succeeded.

Question: “Does the similarity depend on the pairing? Compare the observed calls with the selected reassigned pairing and explain other possible explanations.”

Answer-quality acceptance failed: the final provider round used **241 output tokens**, below the unchanged 1,800-token limit, but the interpretation was **exactly 600 characters** and ended **“not evidence by—”**. The returned limitation said:

> The selected control was inspected, but the interpretation above is incomplete; no causal or semantic conclusion follows.

The comparison did not adequately supply the requested alternative accounts or annotation uncertainty. `boundedText` rejects overlong text; it does not truncate. The old shared schema allowed this incomplete answer at its exact ceiling.

Source: the existing `codabridge-context-offset-1 (2).json`, 87,266 bytes, SHA-256 `b97b1aed16d36edabe11bca0f3fc49c97d8431e14dad4ceacb4df967562d86c2`. The rejection fixture matches its explanation exactly. This is prior live evidence, not a new provider run.

## Contract change

Only Lab requests use the new provider schema: one `comparisonInterpretation`, 1–3 `alternativeAccounts`, one `annotationUncertainty`, and 1–3 additional `limitations`. Each is cited and capped at 800 characters. Instructions require short separate complete sentences. Server validation requires terminal `.`, `!`, or `?` after trimming, with the existing exact evidence resolution. Invalid output takes the existing generic failure path without regeneration or retry.

Validated items map into the existing public arrays in order:

- `possibleInterpretations`: comparison, then alternatives.
- `limitations`: annotation uncertainty, then additional limitations.

This enforces structure and a conservative sentence-ending check, not factuality or semantic completeness. Prose remains unverified. Historical accepted results and version-1 exports retain their original shape and text.

## Offline verification

macOS 26.6.2 arm64; Node v25.9.0; npm 11.12.1. All commands excluded `OPENAI_API_KEY`; provider activity used TEST ONLY fixtures.

| Command | Result |
| --- | --- |
| `env -u OPENAI_API_KEY npm run typecheck` | Passed |
| `env -u OPENAI_API_KEY npm test` | 278 passed |
| `env -u OPENAI_API_KEY npm run lint` | Passed |
| `env -u OPENAI_API_KEY npm run build` | Client and Worker passed |
| `env -u OPENAI_API_KEY npm run test:server-build` | 15 passed; outbound transport intercepted |
| `env -u OPENAI_API_KEY CI=1 npm run test:browser -- tests/browser/context.spec.ts tests/browser/astra-whale.spec.ts tests/browser/launch-calibration.spec.ts` | 142 passed across desktop/mobile; 0 retries |
| `git diff --check` | Passed |

Focused regressions cover the exact hosted rejection, unfinished items in every category, required structure, 800-character bounds, citation order and exact IDs, public/export compatibility, control offset 1, and no retry. Browser coverage includes acceptance/rejection, readable citations, action navigation, stale/cancel behavior and whale lifecycle across desktop/mobile Chromium.

The existing 504.83 kB client bundle warning and numerical qualification are unchanged. Shared A/B and Composer contracts, the Lab 60-second cap and other 20-second caps, model/endpoint/reasoning/tokens, tools/rounds/retries, gates/budgets, public UI/types/exports, research/data, Exchange/crypto and Sites/hosting remain unchanged. No research regeneration, live provider call, inference enablement, deployment or merge occurred. Stop at Draft PR review.
