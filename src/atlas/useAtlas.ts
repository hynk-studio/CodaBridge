import { useEffect, useState } from "react";
import { loadAtlas, type LoadedAtlas } from "./load.ts";

type State = { status: "idle" | "loading" } | { status: "failed"; error: string } | { status: "ready"; data: LoadedAtlas };
export function useAtlas(enabled: boolean) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    loadAtlas(controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ status: "ready", data });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ status: "failed", error: error instanceof Error ? error.message : "Atlas unavailable." });
    });
    return () => controller.abort();
  }, [enabled, attempt]);
  return { state, retry: () => setAttempt(n => n + 1) };
}
