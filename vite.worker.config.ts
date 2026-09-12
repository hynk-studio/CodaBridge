import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  ssr: { target: "webworker", noExternal: true },
  build: {
    ssr: "server/worker.ts",
    outDir: "dist/server",
    target: "es2022",
    rollupOptions: { output: { entryFileNames: "index.js" } },
  },
});
