# CodaBridge

Hear a real recording. Shape a personal synthetic phrase. Compare its timing and keep your coda.

**Composer, Context Lab #8, UI polish #9 and corrected Dialogue Transfer v0.1 #11 are integrated. This branch adds the executed v0.2 research follow-up for Draft review.** Four attributed originals connect to the phrase editor, synthetic playback, source-aware comparison, personal codebook and WAV/card/project downloads. Enter Context Lab without losing the creation: explore a real annotated exchange, compare descriptive pairings, or choose **Dialogue Transfer / Prediction** to compare held-out predictions, reveal the next recorded coda and download the sourced experiment. [v0.2 results and decision note](docs/MVP_05B.md) · [original prediction](docs/MVP_05.md) · [descriptive Lab](docs/MVP_04.md) · [listening pack](docs/RELEASE_HANDOFF.md).

**Default live access remains disabled on the server.** Earlier separately authorized Composer trials accepted a compound edit and, after a prose correction, an investigation of the restored modified creation; their historical failure and acceptance evidence is preserved. The [first separately authorized live Lab investigation](docs/trials/2026-09-13-live-context-lab/README.md) accepted an actual model-initiated control lookup and explanation, with independent answer checks passing for that case. Broader live reliability, human listening and hosted Sites operation remain unverified.

## Run locally

Use Node.js **22.18+** and npm. No account, API key, or `.env` file is needed for the default workspace.

```sh
npm ci
npm run build
npm run preview
```

Open `http://127.0.0.1:4173`. This runs the built Worker and static assets locally in Wrangler/workerd. Listen, reveal the measurements, then choose **Make my version**. Duplicate a block, scale its duration, change one gap, undo, compare field examples and save your files. Astra correctly shows Unavailable. Playback is user-initiated and coordinated across field and synthetic audio. Basic creation, comparison and saving require no credentials. Use `env -u OPENAI_API_KEY` before build/test commands if your shell already has a key.

Choose **Context Lab** to inspect a 60-second annotation segment. Listen with mute/solo, change the control offset, inspect exact source rows and download the investigation PNG/JSON. Return to Composer with the draft, codebook and Undo history intact. Lab reconstructions are separate from the original field clips and your creation.

**Dialogue Transfer / Prediction** uses precomputed offline results from the full annotation corpus. Five deterministically selected held-out examples show completed history and fold-specific duration-bin probabilities; **Reveal actual next coda** discloses the recorded target. The fixed run evaluated **723 codas / 67 exact REC fragments / 19 recording roots**. Partner gain was **+0.00220 bits/coda**, with a conditional 95% group-bootstrap interval **−0.05468 to +0.06934**. The interval includes zero. Older-partner gain versus self-only was **−0.01796 bits/coda**. No causal, independence or animal-meaning claim follows. [Offline protocol and reproduction commands](analysis/dialogue-transfer/README.md).

Choose **Follow-up research · v0.2** for the separate fixed continuous-duration, count and conditional-gap studies. All 55 fits completed. Primary duration gain is **+0.003317 squared log units**, pooled interval **[+0.000499, +0.005666]**; its equal-root macro interval spans zero. Count gain is negative; gap and expanded-coverage duration gains have pooled intervals spanning zero. This is exploratory reuse, with conditional descriptive intervals and unresolved encounter identities. It does not validate whale-response rules or generation on synthetic codas. [All outcomes, controls and limits](docs/MVP_05B.md) · [exact v0.2 reproduction commands](analysis/dialogue-transfer-v02/README.md).

For UI development, keep that preview running and run `npm run dev` in another terminal. Vite serves `http://127.0.0.1:5173` and proxies `/api` to the preview. Rebuild/restart preview after server changes. Without preview, the development UI reports investigation unavailable.

```sh
npm run typecheck
npm test
npm run data:verify
npm run lint
npm run build
npm run test:server-build
npm run test:browser
```

Install Playwright Chromium with `npx playwright install chromium` if absent. Browser tests start and stop their own local production preview. Tests inject a mock **provider transport** through the actual handler; fixtures never ship to visitors. Screenshots of that path are labeled **TEST ONLY**, not live Astra evidence.

## Data and limits

Originals `1.wav`, `2.wav`, `11.wav` and `7.wav` come from [orrp/DSWP](https://huggingface.co/datasets/orrp/DSWP), pinned revision `a2e5d6dd02fc60343e1288c33314e14e8b7aa5be`, under **CC BY 4.0**. Credit: Dominica Sperm Whale Project; Orr Paradise and colleagues, *Towards A Translative Model of Sperm Whale Vocalization*, NeurIPS 2025. [Attribution and methods](docs/DATA_METHODS.md) includes full credit, hashes and selection/annotation provenance.

Markers are **machine-estimated transient groups**. Whole files may contain multiple codas, echoes or unrelated transients; they are not verified biological boundaries, speakers or dialogue turns. The existing normalized-interval metric is descriptive, not translation, a similarity percentage or semantic confidence. Unequal counts stay not comparable.

The browser checks original bytes before decoding. The server independently resolves catalog IDs and recomputes measurements. Generated interpretation is separated from those measurements and cites issued evidence IDs; traceability does not establish factual correctness. Selection changes cancel/obsolete previous investigations, including their export.

Context Lab uses the CC BY 4.0 [paper-cited archive](https://zenodo.org/records/10817697), release `sw-combinatoriality`, pinned commit `7228c8eed2cc27ddd23b74c51aeccec9d762389e`. Its [audit](docs/CONTEXT_DATA.md) retains raw rows and annotation precision, whole long codas, exact REC/local-caller scope and explicit exclusions. The descriptive duration reassignment control remains separate from the paper's permutation test and the offline Dialogue Transfer prediction. Neither establishes whale meaning.

## Review and compatibility

- [MVP-05B executed v0.2 research, numerical verification and decision note](docs/MVP_05B.md)
- [MVP-05 predictive experiment, uncertainty, controls and running-app verification](docs/MVP_05.md)
- [MVP-04 connected Lab contract and exact control](docs/MVP_04.md)
- [Research annotation audit and deterministic selection](docs/CONTEXT_DATA.md)
- [MVP-04 integration, tests, captures and delivered files](docs/MVP_04_VERIFICATION.md)
- [First live Context Lab investigation: tool path, independent quality assessment and actual downloads](docs/trials/2026-09-13-live-context-lab/README.md)
- [Key-free reviewed artifact, listening pack and Sites handoff](docs/RELEASE_HANDOFF.md)
- [MVP-03 contract, engineering limits and implementation](docs/MVP_03.md)
- [Composer quantitative-prose policy and correction checks](docs/MVP_03_NUMERIC_PROSE.md)
- [MVP-03 review corrections, before/after captures and downloads](docs/MVP_03_REFINEMENT.md)
- [First live Composer batch: edit passed, investigation rejected](docs/trials/2026-09-12-live-composer/README.md)
- [Post-correction live Composer investigation: tool path and answer-quality checks passed](docs/trials/2026-09-13-live-composer-investigation/README.md)
- [MVP-03 verification, running-app capture and downloads](docs/MVP_03_VERIFICATION.md)
- [Historical live A/B retrieval and unequal-count batch](docs/trials/2026-09-12-live-retrieval-unequal/README.md)
- [MVP-02 implementation and boundaries](docs/MVP_02.md)
- [Build, model and Sites compatibility](docs/BUILD_COMPATIBILITY.md)
- [MVP-02 verification and screenshots](docs/MVP_02_VERIFICATION.md)
- Historical [MVP-01 contract](docs/MVP_01.md) and [verification](docs/VERIFICATION.md)
- [Parent issue #1](https://github.com/hynk-studio/CodaBridge/issues/1), integrated foundation [PR #2](https://github.com/hynk-studio/CodaBridge/pull/2) → [PR #3](https://github.com/hynk-studio/CodaBridge/pull/3) → [PR #5](https://github.com/hynk-studio/CodaBridge/pull/5)

Public live enablement awaits review of an actual access/budget path. Operator flags are **not authentication** and per-request limits are **not a shared spending cap**. Broader Composer/Lab live reliability, hosted Sites runtime/delivery and scientific validity remain unverified. The bounded offline predictive pilot is executed on this branch; implementation verification does not establish biological transfer or encounter independence. The parent launch and release issues remain open; this new implementation is for Draft review. No Site creation/save/deployment, account/database stack or WhAM is included. Project code licensing remains undecided; third-party licenses remain in force.
