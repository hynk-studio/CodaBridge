import { actionEvidenceIndex, actionSummary, type RecordedAction } from "./actions.ts";

export default function AstraActions({ actions, evidence, targetId, onInspect }: {
  actions: readonly RecordedAction[];
  evidence: readonly { id: string }[];
  targetId: (index: number) => string;
  onInspect: (index: number) => void;
}) {
  return <details className="astra-actions">
    <summary>Actions in this result</summary>
    <p>Recorded after this request completed.</p>
    {actions.length > 0 && <ol>
      {actions.map((action, i) => {
        const { label, attribution } = actionSummary(action);
        const index = actionEvidenceIndex(action, evidence);
        return <li key={i}>{label}<span>{attribution}</span>
          {index === null ? <small>Evidence unavailable in this result.</small> :
            <button type="button" className="astra-evidence-link" aria-controls={targetId(index)}
              onClick={() => onInspect(index)}>Inspect evidence: {evidence[index].id}</button>}
        </li>;
      })}
    </ol>}
    {!actions.some(action => action.initiatedBy === "model") &&
      <p>No model-initiated tool actions were recorded.</p>}
  </details>;
}
