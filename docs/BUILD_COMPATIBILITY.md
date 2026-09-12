# Build and Sites compatibility

Checked September 12, 2026. **Local static build verified; account-specific Sites packaging/save/deployment not performed.**

## Actual starter and output

Used the official [Vite React/TypeScript starter](https://vite.dev/guide/) from **`create-vite@9.2.1`**, initialized in an ignored temporary directory, then copied its package/TypeScript/Vite configuration into the existing branch. README, AGENTS, the brief, and Git history were preserved. Starter demo content was not shipped. The Sites plugin's bundled Vinext starter was inspected; its server/auth/storage stack was unnecessary for this browser-only slice.

Locked versions: Vite 8.3.0, React/React DOM 19.3.0, TypeScript 6.0.3, `@vitejs/plugin-react` 6.1.1. `package-lock.json` is authoritative. Host: macOS arm64, Node 25.9.0, npm 11.12.1. Node 22.18+ is required for native TypeScript scripts/tests; the minimum release was not independently tested.

```sh
npm ci
npm run build  # tsc -b && vite build
npm run preview
```

Output: `dist/index.html`, versioned client JavaScript/CSS in `dist/assets/`, and the two original WAVs in `dist/audio/`. There is no production Node server or Worker entrypoint. Runtime requests load same-origin static assets; decoding, comparison and downloads run in the browser. No auth, storage, runtime variable, model, or analytics service is required.

## Sites checks

The current [official Sites guide](https://learn.chatgpt.com/docs/sites), reached from `developers.openai.com/codex/sites`, distinguishes local editing/testing, saved versions, and deployments; deployment URLs are production deployments. Local build success is not deployed evidence.

Installed OpenAI Sites plugin **0.1.66** instructions support framework static exports with an `index.html` and `static.directory` selecting public output such as `dist`. Both building/hosting instructions were read. Its local helper was executed successfully:

```sh
node /Users/hynk/.codex/plugins/cache/openai-bundled/sites/0.1.66/scripts/build-site.mjs
```

The helper invokes the project's build script; it does not prove account-specific hosting acceptance. Static artifact checks confirm the entrypoint and byte-identical WAV copies. `.openai/hosting.json` contains only `{"static":{"directory":"dist"}}`, with no fabricated, borrowed, or active `project_id`. No Sites connector call was made.

## Deferred boundary

Site registration/activation, source upload, packaging with real linkage, saved hosted versions, visitor access, and deployed audio delivery/content-type/range behavior remain unverified. When separately authorized, acquire genuine linkage and verify those boundaries against the accepted source commit. GitHub push is not deployment.

The app matches the documented static output shape; actual hosted operation needs that later check. A future Astra adapter requires a separately designed server boundary and verified model/runtime access. A conventional Node/Next server is not assumed to deploy unchanged. Missing Sites account access does not affect local operation.
