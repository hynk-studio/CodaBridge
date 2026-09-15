import { useEffect, useRef, useState } from "react";
import { selectionKey } from "./domain/catalog.ts";
import type { Recording } from "./domain/types.ts";
import { investigate, type CompletedInvestigation } from "./investigation.ts";

type State =
  | {
      status: "idle" | "pending" | "unavailable" | "failed";
      message: string;
      key: string;
    }
  | { status: "completed"; result: CompletedInvestigation; key: string };

export function useInvestigation(a: Recording, b: Recording) {
  const key = selectionKey(a, b);
  const [availability, setAvailability] = useState<
    "checking" | "available" | "unavailable"
  >("checking");
  const [state, setState] = useState<State>({
    status: "idle",
    message: "Choose a question about the current selection.",
    key,
  });
  const active = useRef<{
    controller: AbortController;
    sequence: number;
  } | null>(null);
  const sequence = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/investigation/status", { signal: controller.signal })
      .then(async (response) => {
        const result = (await response.json()) as { status?: string };
        if (!controller.signal.aborted)
          setAvailability(
            response.ok && result.status === "available"
              ? "available"
              : "unavailable",
          );
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailability("unavailable");
      });
    return () => controller.abort();
  }, []);
  useEffect(
    () => () => {
      active.current?.controller.abort();
      sequence.current++;
    },
    [key],
  );

  function cancel(
    message = "Investigation cancelled. No explanation was accepted.",
  ) {
    active.current?.controller.abort();
    active.current = null;
    sequence.current++;
    setState({ status: "idle", message, key });
  }
  async function run(question: string) {
    active.current?.controller.abort();
    const controller = new AbortController();
    const runSequence = ++sequence.current;
    active.current = { controller, sequence: runSequence };
    setState({
      status: "pending",
      message: "Astra request in progress…",
      key,
    });
    try {
      const result = await investigate(
        { sourceIds: [a.id, b.id], selectionKey: key, question },
        controller.signal,
      );
      if (controller.signal.aborted || sequence.current !== runSequence) return;
      if (result.status === "completed")
        setState({ status: "completed", result, key });
      else
        setState({
          status: result.status,
          message: result.message,
          key,
        });
    } catch {
      if (controller.signal.aborted || sequence.current !== runSequence) return;
      setState({
        status: "failed",
        message:
          "The investigation could not be completed. Try again when the server is available.",
        key,
      });
    } finally {
      if (active.current?.sequence === runSequence) active.current = null;
    }
  }
  // Render/export guard works immediately, even before effect cleanup runs.
  const current: State =
    state.key === key
      ? state
      : {
          status: "idle",
          message:
            "Selection changed. Previous investigation is obsolete; ask about this pair.",
          key,
        };
  return {
    availability,
    state: current,
    run,
    cancel,
    result: current.status === "completed" ? current.result : null,
  };
}
