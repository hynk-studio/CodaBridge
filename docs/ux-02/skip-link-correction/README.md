# UX-02 skip-link correction

Reviewed head: `00594407396953aa2020e751b6ea0f2db4e53d87`. Base: `985c883bb6b8cd5bc9084ce77142dc8d6768b17c`. Tested application/test commit: `eba5a6e42cf72f27520cc65fbe50516f6c314643`. The subsequent evidence commit changes this directory only; the current review head is recorded in Draft PR #24.

The owner's reduced Chromium 144 probe motivated this check. The observations below come from the **actual CodaBridge production build**, not that standalone reproduction.

| Keyboard activation of Skip to workspace | Reviewed application | Corrected application |
| --- | --- | --- |
| Route | `#composer → #workspace` | `#composer → #composer` |
| Visible workspace | Composer → Listen | Composer retained |
| Focus | Main, after switching workspace | Existing `main#workspace`, without switching |
| Browser history length | 2 → 3 | 2 → 2 |
| Composer state | Editor left the viewport | Block 2 selected; Undo/Redo enabled before and after |

Computer Use reached the link through **Shift+Tab**, then pressed **Return**. Read-only CDP recorded the route, focus, visibility and history length; it did not modify application state. A new focused Playwright case also failed against the reviewed build at the expected URL assertion before the fix. The corrected fresh build passed that case and the remaining regressions.

The only application change is in `src/App.tsx`: skip activation prevents the anchor's default navigation, focuses main and scrolls it into view. Initial routing and Back/Forward share an explicit map of supported workspace hashes. Other in-page fragments do not request a workspace change. The existing link, main target, navigation controls and Back/Forward remain.

## Executed checks

All commands excluded provider credentials with `env -u OPENAI_API_KEY`. Exact commands, build hashes, Git object identities and observations are in [browser-observation.json](browser-observation.json).

- `npm run typecheck`, `npm run lint`, `npm run build`: passed.
- `npm test`: **249 passed**, zero failed/skipped. The research assertion is unchanged and passed here; the earlier Sites qualification (66 log-target differences, maximum `2.220446049250313e-16`) remains separate.
- `tests/browser/skip-link.spec.ts`: **14 passed**, covering desktop and mobile keyboard traversal, Composer draft/selection/Undo/Redo, Atlas mode/reference, unfinished Exchange rhythm/review stages, sealed file/key binding with unchecked and checked acknowledgement, identical repeated encrypted downloads, real Back/Forward, home/wordmark shortcuts and direct supported hashes.
- Existing UX-02, workspace, Composer, Atlas, Exchange, Sealed and polish browser suites: **146 passed**. This includes actual plain/sealed round trips and Composer/Atlas return paths. Provider/fault/share simulations in existing tests remain TEST ONLY.

Playwright used fresh isolated contexts at 1440×1000 and 390×844 (mobile/touch). Computer Use used Chrome 152 on a separate local origin, `http://127.0.0.1:4184`; its corrected viewport measured 1365×695 CSS pixels. No owner browser storage or clipboard was inspected. Only test-owned storage was read by the isolated regressions. Sealed keys stayed masked in the new cases, with traces/screenshots/video disabled and no key values in this evidence. This is browser acceptance, not physical Android or assistive-technology certification.

## Preserved scope

Git object identities are unchanged from the reviewed head for Exchange/crypto/formats, Composer, Atlas/Lab, domain/server owners, `analysis/`, `public/`, hosting metadata, the research assertion, UX-01 and all original UX-02 evidence. No study fitting, historical artifact regeneration, new format or code-freeze mechanism was introduced. The unrelated local image remains untouched.

Captures: [before activation result](before-composer-skip.png) · [after activation result](after-composer-skip.png). These show the actual application; neither contains opening keys.

Draft #24 remains the review vehicle. Draft #23 remains unchanged at `a6c79b6265033521f423f5884322c1d6b177b7cb`, as does the live [Sites baseline](https://codabridge-android-check.hynk1240.chatgpt.site/). No merge, force-push, deployment, hosted version save/publication, inference enablement or paid model call occurred. Any later rollout must use the reviewed current PR candidate under separate authorization.
