import type {
  GeneratedExplanation,
  ProviderReceipt,
} from "../investigation.ts";
import type { comparePairing } from "./model.ts";
export interface LabRequest {
  datasetId: string;
  segmentId: string;
  callers: [string, string];
  offset: number;
  selectedRowId: string;
  binding: string;
  question: string;
}
export interface LabEvidence {
  id: string;
  kind: string;
  data: unknown;
}
export interface LabResult {
  status: "completed";
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
  evidence: LabEvidence[];
  comparison: ReturnType<typeof comparePairing>;
  explanation: GeneratedExplanation;
}
