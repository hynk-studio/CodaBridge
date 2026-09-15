import { actionSummary, type RecordedAction } from "./actions.ts";

export default function AstraActions({ actions }: { actions: readonly RecordedAction[] }) {
  return <details className="astra-actions">
    <summary>Actions in this result</summary>
    <p>Recorded after this request completed.</p>
    {actions.length > 0 && <ol>
      {actions.map((action, i) => {
        const { label, attribution } = actionSummary(action);
        return <li key={i}>{label}<span>{attribution}</span></li>;
      })}
    </ol>}
    {!actions.some(action => action.initiatedBy === "model") &&
      <p>No model-initiated tool actions were recorded.</p>}
  </details>;
}
