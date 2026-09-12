import type {
  GeneratedExplanation,
  ProviderReceipt,
} from "../investigation.ts";
import type { beforeAfter, compareBlock } from "./analysis.ts";
import type { Block, Draft, Operation } from "./model.ts";
export interface ComposerRequest {
  mode: "edit" | "investigate";
  draft: Draft;
  activeId: string;
  previous: Block | null;
  binding: string;
  question: string;
}
export interface ComposerEvidence {
  id: string;
  kind: string;
  data: unknown;
}
export interface ComposerResult {
  status: "completed";
  mode: ComposerRequest["mode"];
  binding: string;
  execution: "provider" | "mock-transport-test";
  startedAt: string;
  completedAt: string;
  providerResponses: ProviderReceipt[];
  actions: {
    name: string;
    initiatedBy: "server" | "model";
    arguments: Record<string, unknown>;
    evidenceId: string;
  }[];
  evidence: ComposerEvidence[];
  analysis: ReturnType<typeof compareBlock>;
  proposal: {
    operations: Operation[];
    preview: Draft;
    facts: ReturnType<typeof beforeAfter>;
  } | null;
  explanation: GeneratedExplanation | null;
}
