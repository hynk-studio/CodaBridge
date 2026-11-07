# Structured research-assistant evaluation v1

U4 starts with the provider-free stage of the plan. Ten fixed Composer-rendered synthetic cases use five development and five distinct evaluation recipe families. Evaluation includes mixed count/tempo, noisy event ordering, missing producer/meaning, causal non-identifiability and updated input. Seeds are null for these deterministic recipes; pulse versions and event times are retained. Development and evaluation share primitives, not the same recipe family. This small transparent collection is not a held-out benchmark of general reasoning.

    npm run assistant:eval
    npm run assistant:check
    npm run assistant:test

`model-inputs.json` and real dispatched tool evidence exclude answer keys, recipe/family labels, latent truth and private creator text. `answer-key.json` is a separate reviewer artifact, never a request payload. Structured evidence is computed by existing timing/Composer owners and U2 DSP; no audio is sent. This does not measure audio perception.

The offline runner reuses the production Responses adapter's bounded schema/tool loop, manual redirects, cancellation and token/context limits with an explicit TEST ONLY injected transport and sentinel. It exposes no application endpoint and does not enable a provider or alter production prompts. Changed input is bound by its content hash; stale results fail. Four local tools disclose only bound evidence. Saved tool evidence is recomputed before scoring; unknown tools/arguments, altered evidence, duplicate names and stale bindings fail.

Scores separate measurable accuracy, evidence binding, tool choice, declared unsupported biology, required abstention and next-check structure. Numeric checks use relative tolerance 1e-8. Free-text truth and the usefulness of a proposed check require the [review rubric](RUBRIC.md); those scores stay null. A model can hide an unsupported claim in prose despite a harmless structured label. Schema completeness and a second model's agreement are not correctness.

`fixture-results.json` reports orchestration only. Expected answers drive TEST ONLY transport; its perfect numeric checks are not Astra performance. Actual model runs and waveform runs remain zero. A future bounded model evaluation must record model/config, exact inputs/tool trace, outputs, budgets, failures and reviewed rubric; waveform evaluation additionally requires a verified audio-capable route. No live model, external collection, author contact, Exchange text or credentials were used.

## Initial Work executor verification (2026-11-07, historical)

Three focused tests passed, including all ten adapter/tool round trips, hand-computable count/ratio targets, wrong-value/invented-citation/unsupported-declaration mutants, hidden-input checks, stale binding, canceled invocation, altered evidence/input, duplicate names and oversized strings. Generated artifacts reproduce with `npm run assistant:check`. Typecheck, lint, production client/Worker build and all 15 built-artifact tests passed on Node 24.22.1 / Linux.

The initial assembled U1–U4 suite had 292 passes out of 293 tests; its sole failure also reproduces on unchanged main at machine-precision differences in a frozen v0.2 log-target replay. No old test, study input or result was changed. Browser acceptance was blocked by that executor's socket restrictions; it is independent of this offline fixture result. See the [execution status](../../docs/RESEARCH_UPGRADE_PLAN_2026-11-07.md#execution-status--2026-11-07) for all remaining gaps.

## Cloud follow-up verification (2026-11-07)

All 294 assembled unit tests now pass, including a narrow machine-precision correction to the frozen log-target replay assertion and mutation checks against broader changes. The three U4 tests and all ten fixture orchestrations pass; `assistant:check` reproduces the committed artifacts exactly. No evaluation case, answer key, fixture result or score was changed. Typecheck, lint, production client/Worker build and all 15 built-artifact tests pass.

The Cloud executor also completed 16 U1/U2 desktop/mobile browser acceptance cases and 58 Context Lab/Composer regression cases against the actual Worker preview, with real downloads and screen inspection. These results resolve the earlier browser socket/interface blocker, not the explicitly separate question of model quality. Actual model/audio-input runs remain zero and interpretation/usefulness scores remain null. See the [validation report](../../docs/RESEARCH_UPGRADE_VALIDATION_2026-11-07.md) for commands and the GitHub handoff/closeout.
