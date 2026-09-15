const labels = {
  recording_details: "Look up recording details",
  compare_selected: "Compare the selected recordings",
  find_alternatives: "Find alternative recordings",
  compare_creation: "Compare the selected creation block",
  creation_before_after: "Compare before and after timing",
  find_creation_alternatives: "Find recordings for the creation block",
  exchange_info: "Look up annotated exchange details",
  compare_observed_pairing: "Compare observed duration pairings",
  control_result: "Look up a duration reassignment control",
} as const;

export interface RecordedAction {
  name: string;
  initiatedBy: "model" | "server";
  evidenceId?: string;
}

// Exact, unambiguous matches in this result only; no normalization or fallback.
export function actionEvidenceIndex(action: RecordedAction, evidence: readonly { id: string }[]): number | null {
  if (typeof action.evidenceId !== "string" || !action.evidenceId) return null;
  const index = evidence.findIndex(item => item.id === action.evidenceId);
  return index >= 0 && !evidence.slice(index + 1).some(item => item.id === action.evidenceId)
    ? index : null;
}

// Do not render unknown tool names or inspect arguments/private request content.
export function actionSummary(action: RecordedAction) {
  return {
    label: Object.hasOwn(labels, action.name)
      ? labels[action.name as keyof typeof labels]
      : "Other recorded action",
    attribution: action.initiatedBy === "model"
      ? "Requested by Astra"
      : action.initiatedBy === "server" ? "Performed by CodaBridge" : "Initiator not recorded",
  };
}
