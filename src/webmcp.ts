import type { buildEvidence } from "./domain/evidence.ts";

type Evidence = ReturnType<typeof buildEvidence>;
interface ModelContext {
  registerTool(
    tool: {
      name: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
      execute: (input: unknown) => Evidence;
    },
    options?: { signal: AbortSignal },
  ): void | Promise<void>;
}
declare global {
  interface Document {
    readonly modelContext?: ModelContext;
  }
}

export function registerEvidenceTool(
  context: ModelContext | undefined,
  getEvidence: () => Evidence,
) {
  if (!context?.registerTool) return () => {};
  const lifecycle = new AbortController();
  try {
    void Promise.resolve(
      context.registerTool(
        {
          name: "read_current_comparison_evidence",
          description:
            "Read the currently selected recordings, original timing, computed comparison, sources, and limitations. Does not play audio, change selection, download, or call a model.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute(input) {
            if (
              !input ||
              typeof input !== "object" ||
              Array.isArray(input) ||
              Object.keys(input).length
            )
              throw new Error("Expected an empty object.");
            return structuredClone(getEvidence());
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {
      lifecycle.abort();
    });
  } catch {
    lifecycle.abort();
  }
  return () => lifecycle.abort();
}
