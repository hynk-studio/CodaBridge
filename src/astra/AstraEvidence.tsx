import { useId, useRef, type ReactNode } from "react";
import type { ToolEvidence } from "../investigation.ts";
import AstraActions from "./AstraActions.tsx";
import type { RecordedAction } from "./actions.ts";

type Evidence = ToolEvidence | { id: string; kind: string; data: unknown };

/** Shares the existing deterministic disclosure, scoped to one accepted result. */
export default function AstraEvidence({ actions, evidence, summary = "Supporting evidence", anchorPrefix, children }: {
  actions: readonly RecordedAction[];
  evidence: readonly Evidence[];
  summary?: string;
  // A/B keeps its existing citation anchors; other results have instance-local IDs.
  anchorPrefix?: string;
  children?: ReactNode;
}) {
  const prefix = useId();
  const targets = useRef(new Map<number, HTMLDetailsElement>());
  const targetId = (index: number) => anchorPrefix
    ? `${anchorPrefix}${evidence[index].id}` : `${prefix}-evidence-${index}`;
  function inspect(index: number) {
    const target = targets.current.get(index);
    if (!target || !evidence[index]) return;
    let parent: HTMLElement | null = target;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
    target.querySelector("summary")?.focus({ preventScroll: true });
    target.scrollIntoView({ block: "nearest", behavior: "instant" });
  }
  return <>
    <AstraActions actions={actions} evidence={evidence} targetId={targetId} onInspect={inspect} />
    <details className="supporting-evidence">
      <summary>{summary}</summary>
      {evidence.map((item, index) => <details className="tool-evidence" id={targetId(index)} key={item.id}
        ref={node => { if (node) targets.current.set(index, node); else targets.current.delete(index); }}>
        <summary>{item.id}</summary>
        {"recording" in item && <p>
          <a href={item.recording.source.url}>{item.recording.label} · original source</a>
          {" · "}{item.recording.source.license}{" · "}machine-estimated markers
        </p>}
        <pre>{JSON.stringify(item, null, 2)}</pre>
      </details>)}
      {children}
    </details>
  </>;
}
