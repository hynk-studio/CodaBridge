import { useState } from "react";
import AstraActivity from "./astra/AstraActivity.tsx";
import AstraActions from "./astra/AstraActions.tsx";
import {
  GUIDED_QUESTIONS,
  QUESTION_LIMIT,
  type CitedText,
  type ToolEvidence,
} from "./investigation.ts";
import type { useInvestigation } from "./useInvestigation.ts";

function EvidenceItem({ item }: { item: ToolEvidence }) {
  return (
    <details className="tool-evidence" id={`evidence-${item.id}`}>
      <summary>{item.id}</summary>
      {item.kind === "recording" && (
        <p>
          <a href={item.recording.source.url}>
            {item.recording.label} · original source
          </a>
          {" · "}
          {item.recording.source.license}
          {" · "}machine-estimated markers
        </p>
      )}

      <pre>{JSON.stringify(item, null, 2)}</pre>
    </details>
  );
}
function RetrievalSummary({
  item,
  evidence,
}: {
  item: Extract<ToolEvidence, { kind: "retrieval" }>;
  evidence: ToolEvidence[];
}) {
  return (
    <div className="retrieval-summary">
      <p>
        {item.status === "no-match"
          ? "No comparable alternative in this catalog."
          : "Closest available alternatives under the timing metric; this is not a similarity threshold."}
      </p>
      <ul>
        {item.matches.map((match) => {
          const source = evidence.find(
            (row) => row.id === match.recordingEvidenceId,
          );
          return (
            <li key={match.sourceId}>
              <a href={`#evidence-${match.recordingEvidenceId}`}>
                {source?.kind === "recording"
                  ? source.recording.label
                  : match.sourceId}
              </a>
              {" · MAD "}
              {match.value.toFixed(3)}
            </li>
          );
        })}
      </ul>
      {item.rejected.map((row) => (
        <p key={row.sourceId}>
          {row.sourceId}:{" "}
          {row.comparison.status === "not-comparable"
            ? row.comparison.reason
            : "Comparable"}
        </p>
      ))}
    </div>
  );
}
function CitedSection({ title, rows }: { title: string; rows: CitedText[] }) {
  return (
    <div className="generated-section">
      <h3>{title}</h3>
      <ul>
        {rows.map((row, index) => (
          <li key={index}>
            {row.text}
            <span className="citation-links">
              {row.evidenceIds.map((id) => (
                <a key={id} href={`#evidence-${id}`}>
                  {id}
                </a>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function InvestigationPanel({
  investigation,
}: {
  investigation: ReturnType<typeof useInvestigation>;
}) {
  const [question, setQuestion] = useState<string>(GUIDED_QUESTIONS[0]);
  const { state, availability, result } = investigation;
  const pending = state.status === "pending";
  const label = pending
    ? "Pending"
    : state.status === "completed"
      ? "Completed"
      : state.status === "failed"
        ? "Failed"
        : availability === "checking"
          ? "Checking access"
          : availability === "unavailable" || state.status === "unavailable"
            ? "Unavailable"
            : "Ready";
  return (
    <section
      className="investigation-panel"
      aria-labelledby="investigation-title"
    >
      <span className="eyebrow">
        04 Investigate <span className="unavailable-badge">{label}</span>
      </span>
      <h2 id="investigation-title">Ask about this pair.</h2>
      <p>
        Ground an explanation in the selected recordings, measured timing, and
        source limitations.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!pending && question.trim() && availability === "available")
            void investigation.run(question.trim());
        }}
      >
        <label htmlFor="guided-question">Start with a question</label>
        <select
          id="guided-question"
          value={
            GUIDED_QUESTIONS.includes(
              question as (typeof GUIDED_QUESTIONS)[number],
            )
              ? question
              : ""
          }
          onChange={(event) => {
            if (event.target.value) {
              investigation.cancel("Question changed. Previous investigation is obsolete; ask again.");
              setQuestion(event.target.value);
            }
          }}
        >
          <option value="" disabled>
            Custom question
          </option>
          {GUIDED_QUESTIONS.map((text) => (
            <option key={text} value={text}>
              {text}
            </option>
          ))}
        </select>
        <label htmlFor="investigation-question">Your question</label>
        <textarea
          id="investigation-question"
          value={question}
          maxLength={QUESTION_LIMIT}
          rows={3}
          onChange={(event) => {
            investigation.cancel("Question changed. Previous investigation is obsolete; ask again.");
            setQuestion(event.target.value);
          }}
          aria-describedby="question-help"
        />
        <span id="question-help" className="subtle">
          {question.length}/{QUESTION_LIMIT} characters · Timing and evidence,
          not translation.
        </span>
        <div className="investigation-controls">
          <button
            type="submit"
            disabled={
              pending || availability !== "available" || !question.trim()
            }
          >
            Investigate selection
          </button>
          {pending && (
            <button type="button" onClick={() => investigation.cancel()}>
              Cancel
            </button>
          )}
        </div>
      </form>
      <AstraActivity state={state.status === "idle"
        ? availability === "available" ? "ready" : "unavailable"
        : state.status}>
      <div role="status" className="investigation-status">
        {availability === "unavailable" && state.status === "idle"
          ? "Astra investigation is unavailable. Server access has not been enabled for this workspace. Listening and comparison remain available."
          : state.status === "completed"
            ? "Answer ready"
            : state.message}
      </div>
      </AstraActivity>
      {result && (
        <div
          className="investigation-result"
          onClick={(event) => {
            const anchor = (
              event.target as HTMLElement
            ).closest<HTMLAnchorElement>('a[href^="#evidence-"]');
            const target =
              anchor && document.getElementById(anchor.hash.slice(1));
            if (target instanceof HTMLDetailsElement) {
              target.open = true;
              let parent = target.parentElement;
              while (parent) {
                if (parent instanceof HTMLDetailsElement) parent.open = true;
                parent = parent.parentElement;
              }
            }
          }}
        >
          {result.execution === "mock-transport-test" && (
            <p className="test-notice">
              TEST ONLY · Mocked provider transport. This is not live Astra
              evidence.
            </p>
          )}
          <p>
            <strong>Question answered:</strong> {result.question}
          </p>
          <h3>Measured observations · deterministic</h3>
          {result.evidence
            .filter((item) => item.kind === "comparison")
            .map((item) => (
              <p key={item.id}>
                {item.observation}{" "}
                <a href={`#evidence-${item.id}`}>Measurements</a>
              </p>
            ))}
          {result.evidence
            .filter((item) => item.kind === "retrieval")
            .map((item) => (
              <RetrievalSummary
                key={item.id}
                item={item}
                evidence={result.evidence}
              />
            ))}
          <p className="interpretation-notice">
            Generated interpretation is unverified. References show
            traceability, not proof that a statement is correct.
          </p>
          <details className="exact-answer">
          <summary>Exact generated answer · unverified</summary>
          <CitedSection
            title="Possible interpretations · generated"
            rows={result.explanation.possibleInterpretations}
          />
          <CitedSection
            title="Limitations · generated"
            rows={result.explanation.limitations}
          />
          </details>
          <AstraActions actions={result.actions} />
          <details className="supporting-evidence">
          <summary>Supporting evidence</summary>
          {result.evidence.map((item) => (
            <EvidenceItem item={item} key={item.id} />
          ))}
          <details className="tool-evidence">
            <summary>Provider receipt & request binding</summary>
            <pre>
              {JSON.stringify(
                {
                  execution: result.execution,
                  startedAt: result.startedAt,
                  completedAt: result.completedAt,
                  providerResponses: result.providerResponses,
                  binding: result.binding,
                },
                null,
                2,
              )}
            </pre>
          </details>
          </details>
        </div>
      )}
    </section>
  );
}
