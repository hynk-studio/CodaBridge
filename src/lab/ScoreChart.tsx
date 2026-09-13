import { scoreMaximum, scoreRows, type PairingComparison } from "./presentation.ts";

export default function ScoreChart({ comparison, onSelect }: {
  comparison: PairingComparison;
  onSelect: (offset: number) => void;
}) {
  const maximum = scoreMaximum(comparison);
  return (
    <figure className="score-chart" aria-label="Observed and all distinct reassignment scores">
      <figcaption><strong>Call-duration difference</strong><span>Mean absolute difference in seconds · lower is closer</span></figcaption>
      <div className="score-axis" aria-hidden="true"><span>0</span><span>{(maximum / 2).toFixed(2)}</span><span>{maximum.toFixed(2)} s</span></div>
      <div className="score-rows">
        {scoreRows(comparison).map((row) => (
          <button key={row.offset} className={`score-row ${row.offset === 0 ? "observed-score" : ""}`}
            aria-pressed={comparison.selected.offset === row.offset}
            aria-label={`${row.label}: ${row.value === null ? "unavailable" : `${row.value.toFixed(3)} seconds`}. Inspect pairing`}
            onClick={() => onSelect(row.offset)}>
            <span className="score-name">{row.label}</span>
            <span className="score-track" aria-hidden="true">
              {row.value !== null && <span className="score-mark" style={{ left: `${row.value / maximum * 100}%` }} />}
            </span>
            <span className="score-number">{row.value === null ? "—" : row.value.toFixed(3)}</span>
          </button>
        ))}
      </div>
      <p className="lab-caption">◆ Observed · ● Reassigned durations. Select a row to inspect it. Each number is the same score shown by its marker; exact values are in the evidence below.</p>
    </figure>
  );
}
