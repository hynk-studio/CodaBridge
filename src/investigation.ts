import type { selectionBinding } from "./domain/catalog.ts";
import type { Recording } from "./domain/types.ts";
import type { Comparison, METRIC, TimingResult } from "./domain/timing.ts";

export const QUESTION_LIMIT = 800;
export const GUIDED_QUESTIONS = [
  "What differs in the timing of A and B, and what cannot be concluded?",
  "Find another recording closest to A under the normalized interval metric.",
  "How could the estimated markers affect this comparison?",
] as const;

export interface InvestigationRequest {
  sourceIds: [string, string];
  selectionKey: string;
  question: string;
}
export type ToolName =
  | "recording_details"
  | "compare_selected"
  | "find_alternatives";
export type ToolEvidence =
  | {
      kind: "recording";
      id: string;
      recording: Recording;
      timing: TimingResult;
    }
  | {
      kind: "comparison";
      id: string;
      sourceIds: [string, string];
      comparison: Comparison;
      observation: string;
    }
  | {
      kind: "retrieval";
      id: string;
      referenceId: string;
      excludedSelectedIds: [string, string];
      metric: typeof METRIC;
      status: "matches" | "no-match";
      matches: {
        sourceId: string;
        recordingEvidenceId: string;
        value: number;
      }[];
      rejected: {
        sourceId: string;
        recordingEvidenceId: string;
        comparison: Comparison;
      }[];
      excludedDuplicates: string[];
      candidateCount: number;
    };
export interface ToolAction {
  name: ToolName;
  initiatedBy: "server" | "model";
  arguments: Record<string, unknown>;
  evidenceId: string;
}
export interface CitedText {
  text: string;
  evidenceIds: string[];
}
export interface GeneratedExplanation {
  possibleInterpretations: CitedText[];
  limitations: CitedText[];
}
export interface ProviderReceipt {
  // Only fields actually returned by the provider are copied here.
  responseId?: string;
  model?: string;
  createdAt?: number;
  usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
}
export interface CompletedInvestigation {
  status: "completed";
  selectionKey: string;
  binding: ReturnType<typeof selectionBinding>;
  question: string;
  startedAt: string;
  completedAt: string;
  execution: "provider" | "mock-transport-test";
  providerResponses: ProviderReceipt[];
  actions: ToolAction[];
  evidence: ToolEvidence[];
  explanation: GeneratedExplanation;
}
export type InvestigationResult =
  | CompletedInvestigation
  | {
      status: "unavailable" | "failed";
      code: string;
      message: string;
    };

// The browser sends IDs and a version binding, never trusted measurements.
export async function investigate(
  request: InvestigationRequest,
  signal: AbortSignal,
): Promise<InvestigationResult> {
  const response = await fetch("/api/investigate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  const result = (await response.json()) as InvestigationResult;
  if (!["completed", "unavailable", "failed"].includes(result?.status))
    throw new Error("The investigation server returned an invalid response.");
  if (
    result.status === "completed" &&
    (!response.ok || result.selectionKey !== request.selectionKey)
  )
    throw new Error("The result belongs to a different selection or version.");
  return result;
}
