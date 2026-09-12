import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist/client" },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:4173",
        changeOrigin: true,
        configure(proxy) {
          proxy.on("proxyReq", (outgoing, incoming) => {
            // Map only this fixed local UI origin across the development proxy.
            // Foreign origins remain intact and are rejected by the Worker.
            if (incoming.headers.origin === "http://127.0.0.1:5173")
              outgoing.setHeader("origin", "http://127.0.0.1:4173");
          });
        },
      },
    },
  },
});
