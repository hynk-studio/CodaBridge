# MVP-04 implementation verification · 2026-09-13

## Reviewed foundation integration

Authority: [continuation dispatch](https://github.com/hynk-studio/CodaBridge/pull/5#issuecomment-5648163426), [issue #6](https://github.com/hynk-studio/CodaBridge/issues/6), acceptance review **5187693663**. Before mutation, all accepted heads matched, review threads were resolved, normal checks passed, and no merge-triggered deployment path was found: zero Actions workflows, deployments, repository hooks or rulesets; no Pages site; hosting metadata `{}`. No protection was bypassed or new approval invented.

| PR | Accepted head | Normal merge commit |
| --- | --- | --- |
| #2 | `4d09495f9bb31006d310402c8474a94df03d5086` | `4f983f6bf6d206e509815a4ca4f7f4530e4e9aad` |
| #3 | `414bce9f6065776d2c4609c163460bfa344a216b` | `62572880a6f7dc51b27f2dae0fe722f6296eef30` |
| #5 | `0d24d29067671dc5ed7566dd7014d5eff8327ffa` | `afbaedeb2b10b61775a75a63be3067db3db764aa` |

Each was readied only for its authorized integration. #3 and #5 were retargeted to main in order; their remaining diffs were checked against the accepted parent→child deltas before merge. No squash/rebase/force-push or parent branch deletion occurred. Final main tree **`8b576266b6abe9f5a797eb6f3700138c198b2bd0`** equals accepted #5 exactly. `codex/mvp-04-context-lab` starts from that merge. No newer unreviewed source was included in main; no deployment occurred.

Foundation verification: `npm test` **161 passed**; lint, data verification and build passed; built-server tests **14 passed**. The identical integrated tree received a native artifact check, without three full-suite repetitions. A separately extracted reviewed source produced the key-free handoff artifact and passed its fourteen artifact tests.

## Implementation checks

All commands below ran with **`env -u OPENAI_API_KEY`**. No credential store was read. Environment: Node **25.9.0**, npm **11.12.1**, TypeScript **6.0.2**, Vite **8.3.0**, Wrangler **4.131.1**, Playwright **1.63.0**, installed native workerd with compatibility date **2026-09-12**.

| Command | Observed result |
| --- | --- |
| `node --experimental-strip-types --test tests/lab*.test.ts` | 14 focused parser/control/server tests passed |
| `npm run typecheck` | Passed, including final listening/browser tests |
| `npm test` | 175 unit/server tests passed |
| `npm run data:verify` | Four original WAV hashes/metadata/annotations and exact Context derivation reproduced |
| `npm run lint` | Passed |
| `npm run build` | Client and actual Worker artifacts built; no key supplied |
| `npm run test:server-build` | 15 passed, including new Lab native-workerd dispatch/replay and direct disabled routes |
| `npm run test:browser` | 72 passed across desktop and mobile Chromium |
| `npx playwright test tests/browser/context.spec.ts tests/browser/listening.spec.ts --output=test-results/context-final` | Final 14 passed after card wrapping/codebook preservation assertions; includes two added listening tests, for 74 unique browser cases across the runs |

Initial setup defects were corrected before closeout: TypeScript typed-array/tuple and test media-element types; the native artifact test needed a valid legacy A/B request to reach its existing availability gate. A route-intercepted listening-download test returned canceled downloads; the final test serves the unchanged prepared files over actual loopback HTTP and checks file bytes. No application workaround, false download success or new provider invocation was used.

Coverage includes hand-computable scores **1 / 1 / 3** with median **2**, fixed pair membership, inventory-preserving rotation/reset, equal-score versus equivalent-assignment distinction, simultaneous/nested/touching spans, pair reuse, insufficient data, malformed annotations, unknown callers, padding and precision, long codas, duplicates/reordering, immutable source and unchanged Composer state. The real pinned window is tested separately and its original-pair score is independently recomputed from raw CSV ICIs. [Audit and actual values](CONTEXT_DATA.md).

The TEST ONLY handler fixture requests `control_result` itself, receives actual computed pair mappings as a `function_call_output`, and then returns a cited final explanation. It uses two fixture provider responses and preserves intermediate commentary/opaque reasoning internally without exporting them. Native-workerd checks exercise the built module's default fetch at an in-process test-only outbound boundary; no external provider is reachable from those tests. Default model routes refuse, redirects are not followed, and validation/reference/tool/deadline limits remain.

Browser checks preserve draft, active block, codebook, A/B selection and useful Undo/Redo across the Lab visit; confirm renderer ownership/Stop/mute/solo, no autoplay or incidental model POSTs, obsolete responses after offset/row/question/navigation changes, unavailable audio, plain-text untrusted questions, and actual PNG/JSON delivery. Existing Composer WAV/card/project delivery/restoration, edits and storage failures remain covered. Physical-device coverage and human listening are **not performed**.

## Running app and delivered evidence

All model-enabled captures below are **TEST ONLY provider fixtures**, not live Astra. The exchange data and deterministic comparisons are the pinned real annotations. Captures use isolated automated browser contexts and never overwrite the owner's ordinary draft or prior trial media.

- [Desktop Composer entry](mvp04/desktop-chromium-composer-entry.png) and [mobile entry](mvp04/mobile-chromium-composer-entry.png).
- [Desktop Lab](mvp04/desktop-chromium-real-source-lab.png) and [mobile Lab](mvp04/mobile-chromium-real-source-lab.png): actual annotations, reconstruction controls and duration reassignment; fixture availability enabled for the demonstration only.
- [Desktop running journey, TEST ONLY](mvp04/desktop-TEST-ONLY-journey.webm) and [mobile journey](mvp04/mobile-TEST-ONLY-journey.webm): rapid automated Composer → source exchange → reconstruction → control → fixture answer → download → preserved Composer.
- [Exact TEST ONLY answer/tool receipts](mvp04/desktop-chromium-TEST-ONLY-result.json) and [rendered answer](mvp04/desktop-chromium-TEST-ONLY-explanation.png).
- Actual delivered [investigation PNG](mvp04/desktop-chromium-TEST-ONLY-investigation-card.png) and [bounded investigation JSON](mvp04/desktop-chromium-TEST-ONLY-investigation.json), with current selection, full source rows, mappings and separate generated content. Mobile equivalents are retained alongside them. PNG was visually inspected; JSON was parsed and compared to the selected state and computed result. These exports are historical snapshots.
- [Listening pack and reviewed key-free Worker/client artifact](RELEASE_HANDOFF.md). Six exact WAV downloads, decoded durations/peaks, project parsing/restoration and exclusive playback were verified at 1440 px and 390 px. A separate same-origin loopback audition page check also passed. No human comfort verdict was inferred from decoding.
- [Normal built preview availability](mvp04/default-disabled.json): status returns `unavailable / NOT_CONFIGURED`; direct `/api/lab`, `/api/composer` and valid `/api/investigate` POSTs return HTTP 503. These are local inbound checks, not provider probes.

## Remaining boundaries

No paid model call, credential access, Site operation, public enablement or account/billing change occurred. New Lab production/tool contract, real-model answer quality/latency/output sufficiency and broad reliability remain untested live. Actual original research-audio mapping is unverified; only annotation reconstruction is supplied. The 3,840 versus 3,948 source-count correspondence remains unresolved, without preventing the audited window from being inspected. No Lab snapshot import flow, full predictive experiment or public spending infrastructure is added. Human listening, real phones and hosted runtime/delivery need separate observation and authority. All historical accepted/rejected trials remain unchanged; the new implementation PR remains Draft.
