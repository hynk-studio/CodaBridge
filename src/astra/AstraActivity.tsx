import { useEffect, useRef, useState, type ReactNode } from "react";
import "./astra.css";

export type AstraActivityState =
  | "unavailable"
  | "ready"
  | "pending"
  | "completed"
  | "failed"
  | "cancelled";

// One body for every lifecycle state, transcribed from the approved reference.
// Each occupied cell is a square; D is the muted blue eye.
const body = [
  ".A..........",
  "BBB.....ACC.",
  "..B....AACC.",
  "..BBBAAACDEE",
  "...BBBAACCEE",
  "....BBAACCE.",
  ".....BAACC..",
  ".......AA...",
  ".......A....",
];
const colors: Record<string, string> = {
  A: "#0c8f7f", B: "#0b6f67", C: "#11aa8e", D: "#3978c6", E: "#2cdab4",
};
const cells = body.flatMap((row, y) => [...row].flatMap((cell, x) =>
  cell === "." ? [] : [{ x: x + 3, y: y + 5, color: colors[cell] }],
));

/** Decorative only: request owners supply both lifecycle state and status text. */
export default function AstraActivity({
  state, active = true, children,
}: { state: AstraActivityState; active?: boolean; children: ReactNode }) {
  const art = useRef<SVGSVGElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let intersecting = false;
    const update = () => setVisible(intersecting && document.visibilityState === "visible");
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      update();
    });
    if (art.current) observer.observe(art.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return <div className="astra-activity" data-state={state} data-motion={active && visible}>
    <svg ref={art} className="astra-whale" viewBox="0 0 18 18" width="88" height="88"
      aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <g className="astra-whale-body">
        {cells.map(cell => <rect key={`${cell.x}:${cell.y}`} x={cell.x} y={cell.y}
          width="1" height="1" fill={cell.color} />)}
      </g>
      <g className="astra-whale-effects" fill="#11aa8e">
        <rect x="2" y="9" width=".7" height=".7" />
        <rect x="5" y="3" width=".7" height=".7" />
        <rect x="15" y="6" width=".7" height=".7" />
      </g>
      <g className="astra-whale-completion" fill="#2cdab4">
        <rect x="14" y="3" width="1" height="1" />
        <rect x="16" y="5" width=".6" height=".6" />
      </g>
    </svg>
    <div className="astra-activity-copy">{children}</div>
  </div>;
}
