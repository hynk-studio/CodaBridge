import { useEffect, useState } from "react";
import { span, type Block } from "./model.ts";

export function Pattern({ block, label }: { block: Block; label: string }) {
  return (
    <svg
      viewBox="0 0 640 100"
      role="img"
      aria-label={label}
      className="block-pattern"
    >
      <line
        x1="18"
        x2="622"
        y1="58"
        y2="58"
        stroke="currentColor"
        opacity="0.3"
      />
      {block.times.map((t, i) => (
        <g key={i}>
          <line
            x1={18 + (t / span(block)) * 604}
            x2={18 + (t / span(block)) * 604}
            y1="36"
            y2="79"
            stroke="currentColor"
            strokeWidth="3"
          />
          <circle
            cx={18 + (t / span(block)) * 604}
            cy="58"
            r="6"
            fill="currentColor"
          />
          <text
            x={18 + (t / span(block)) * 604}
            y="20"
            textAnchor="middle"
            fill="currentColor"
            fontSize="15"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
export function NumberEdit({
  label,
  value,
  min,
  max,
  onCommit,
  button = "Set",
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  button?: string;
  hint?: (value: number) => string;
}) {
  const [text, setText] = useState(String(Number(value.toFixed(6))));
  useEffect(() => setText(String(Number(value.toFixed(6)))), [value]);
  return (
    <form
      className="number-edit"
      onSubmit={(e) => {
        e.preventDefault();
        onCommit(text.trim() ? Number(text) : NaN);
      }}
    >
      <label>
        {label}
        <input
          aria-label={label}
          type="number"
          required
          min={min}
          max={max}
          step="any"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </label>
      <button type="submit">{button}</button>
      {hint && (
        <p className="number-hint">{hint(text.trim() ? Number(text) : NaN)}</p>
      )}
    </form>
  );
}
