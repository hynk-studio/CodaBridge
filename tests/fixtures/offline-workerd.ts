// TEST ONLY: installed workerd, with every outbound fetch intercepted in process.
// No real credentials, external network, provider service, or fallback transport.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  Miniflare,
  convertV4MiniflareOptions,
  Log,
  LogLevel,
  Response as LocalResponse,
  type V4FetchHandler,
} from "miniflare";
import { RESPONSES_URL } from "../../server/provider.ts";

export async function offlineWorkerd(
  wrapper: string,
  outboundService: V4FetchHandler = () => new LocalResponse(null, { status: 599 }),
  port = 0,
) {
  // Same installed runtime, compatibility date, ESM artifact and asset setup as
  // the private trial. The test-only outbound binding makes egress impossible.
  const options = convertV4MiniflareOptions({
    name: "codabridge-offline-constructor-test",
    host: "127.0.0.1",
    port,
    compatibilityDate: "2026-09-12",
    modulesRoot: resolve("dist/server"),
    modules: [
      { type: "ESModule", path: resolve("dist/server/offline-test.js"), contents: wrapper },
      { type: "ESModule", path: resolve("dist/server/index.js"), contents: await readFile("dist/server/index.js", "utf8") },
    ],
    assets: {
      directory: resolve("dist/client"),
      binding: "ASSETS",
      run_worker_first: ["/api/*", "/private-probe/*"],
      routerConfig: { has_user_worker: true },
    },
    outboundService,
    cf: false,
    telemetry: { enabled: false },
    log: new Log(LogLevel.NONE),
  });
  options.logRequests = false;
  options.handleStructuredLogs = () => {};
  options.handleUncaughtError = () => {};
  const runtime = new Miniflare(options);
  try {
    await runtime.ready;
    return runtime;
  } catch {
    await runtime.dispose();
    throw new Error("Offline test runtime could not start");
  }
}

export const constructorMatrixWorker = `
export default {
  fetch() {
    const url = ${JSON.stringify(RESPONSES_URL)};
    const headers = { "content-type": "application/json" };
    const full = { method: "POST", headers, body: "{}" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    function construct(init) {
      try { new Request(url, init); return true; }
      catch { return false; }
    }
    try {
      return Response.json({
        url_only: construct(undefined),
        post: construct({ method: "POST" }),
        post_content_type: construct({ method: "POST", headers }),
        post_content_type_body: construct(full),
        full_manual: construct({ ...full, redirect: "manual" }),
        full_error: construct({ ...full, redirect: "error" }),
        full_manual_signal: construct({ ...full, redirect: "manual", signal: controller.signal }),
        full_default_signal: construct({ ...full, signal: controller.signal })
      });
    } finally { clearTimeout(timer); }
  }
};`;
