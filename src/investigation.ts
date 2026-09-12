import type { buildEvidence } from "./domain/evidence.ts";

// Reserved contract only. There is no transport, credential access, model ID, or fabricated answer.
export interface InvestigationRequest {
  evidence: ReturnType<typeof buildEvidence>;
  question: string;
}
export type InvestigationResult = {
  status: "unavailable";
  reason: "Astra investigation is not enabled in this build.";
};
export const investigationAvailability: InvestigationResult = {
  status: "unavailable",
  reason: "Astra investigation is not enabled in this build.",
};
