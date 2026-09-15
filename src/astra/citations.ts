type Evidence = { id: string; kind: string };

const labels: Record<string, string> = {
  recording: "Recording evidence",
  comparison: "Comparison evidence",
  retrieval: "Retrieval evidence",
  compare_creation: "Comparison evidence",
  creation_before_after: "Before/after evidence",
  find_creation_alternatives: "Retrieval evidence",
  exchange_info: "Source evidence",
  compare_observed_pairing: "Comparison evidence",
  control_result: "Control evidence",
};

const kindLabel = (kind: string) => Object.hasOwn(labels, kind) ? labels[kind] : undefined;

/** Presentation only: exact, unambiguous identity within this accepted result. */
export function citationPresentation(id: string, evidence: readonly Evidence[]) {
  const index = evidence.findIndex(item => item.id === id);
  if (!id || index < 0 || evidence.slice(index + 1).some(item => item.id === id))
    return { index: null, label: "Evidence unavailable" };
  const label = kindLabel(evidence[index].kind);
  if (!label) return { index, label: `Evidence ${index + 1}` };
  const peers = evidence.filter(item => kindLabel(item.kind) === label);
  const ordinal = evidence.slice(0, index + 1).filter(item => kindLabel(item.kind) === label).length;
  return { index, label: peers.length > 1 ? `${label} ${ordinal}` : label };
}
