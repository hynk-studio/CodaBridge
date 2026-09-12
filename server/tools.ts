import { recordings } from "../src/domain/catalog.ts";
import { timingInput } from "../src/domain/evidence.ts";
import { measuredObservation } from "../src/domain/observation.ts";
import { compareTiming, measureTiming, METRIC } from "../src/domain/timing.ts";
import type { Recording } from "../src/domain/types.ts";
import type {
  ToolAction,
  ToolEvidence,
  ToolName,
} from "../src/investigation.ts";
import { BoundaryError, boundedText, exact } from "./validation.ts";

export function createAnalysisTools(
  selected: [Recording, Recording],
  catalog: readonly Recording[] = recordings,
) {
  const evidence = new Map<string, ToolEvidence>();
  const actions: ToolAction[] = [];
  const selectedIds: [string, string] = [selected[0].id, selected[1].id];
  function resolve(id: unknown) {
    const sourceId = boundedText(id, 64);
    const source = catalog.find((r) => r.id === sourceId);
    if (!source) throw new BoundaryError("UNKNOWN_SOURCE");
    return source;
  }
  function recording(source: Recording): ToolEvidence & { kind: "recording" } {
    const result = {
      kind: "recording" as const,
      id: `recording:${source.id}`,
      recording: structuredClone(source),
      timing: measureTiming(timingInput(source)),
    };
    evidence.set(result.id, result);
    return result;
  }
  function dispatch(
    name: string,
    input: unknown,
    initiatedBy: "server" | "model" = "model",
  ): ToolEvidence {
    let result: ToolEvidence;
    if (name === "recording_details") {
      const args = exact(input, ["sourceId"]);
      result = recording(resolve(args.sourceId));
    } else if (name === "compare_selected") {
      exact(input, []);
      result = {
        kind: "comparison",
        id: `comparison:${selectedIds.join(":")}`,
        sourceIds: selectedIds,
        comparison: compareTiming(
          timingInput(selected[0]),
          timingInput(selected[1]),
        ),
        observation: measuredObservation(
          timingInput(selected[0]),
          timingInput(selected[1]),
        ),
      };
    } else if (name === "find_alternatives") {
      const args = exact(input, ["referenceId", "limit"]);
      const reference = resolve(args.referenceId);
      if (
        !selectedIds.includes(reference.id) ||
        (args.limit !== 1 && args.limit !== 2)
      )
        throw new BoundaryError("INVALID_TOOL_ARGUMENTS");
      const seen = new Set(selected.map((r) => r.audio.sha256));
      const matches: Extract<ToolEvidence, { kind: "retrieval" }>["matches"] =
        [];
      const rejected: Extract<ToolEvidence, { kind: "retrieval" }>["rejected"] =
        [];
      const excludedDuplicates: string[] = [];
      // Stable order makes duplicate retention and tie-breaking reproducible.
      for (const candidate of [...catalog].sort((a, b) =>
        a.id.localeCompare(b.id),
      )) {
        if (selectedIds.includes(candidate.id)) continue;
        if (seen.has(candidate.audio.sha256)) {
          excludedDuplicates.push(candidate.id);
          continue;
        }
        seen.add(candidate.audio.sha256);
        const comparison = compareTiming(
          timingInput(reference),
          timingInput(candidate),
        );
        const details = recording(candidate);
        if (comparison.status === "comparable")
          matches.push({
            sourceId: candidate.id,
            recordingEvidenceId: details.id,
            value: comparison.value,
          });
        else
          rejected.push({
            sourceId: candidate.id,
            recordingEvidenceId: details.id,
            comparison,
          });
      }
      matches.sort(
        (a, b) => a.value - b.value || a.sourceId.localeCompare(b.sourceId),
      );
      result = {
        kind: "retrieval",
        id: `retrieval:${reference.id}:${args.limit}`,
        referenceId: reference.id,
        excludedSelectedIds: selectedIds,
        metric: METRIC,
        status: matches.length ? "matches" : "no-match",
        candidateCount: matches.length + rejected.length,
        matches: matches.slice(0, args.limit),
        rejected,
        excludedDuplicates,
      };
    } else throw new BoundaryError("UNKNOWN_TOOL");
    evidence.set(result.id, result);
    actions.push({
      name: name as ToolName,
      initiatedBy,
      arguments: structuredClone(input as Record<string, unknown>),
      evidenceId: result.id,
    });
    return result;
  }
  return { dispatch, evidence, actions };
}

const objectSchema = (properties: Record<string, unknown>) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
export const ANALYSIS_TOOLS = [
  {
    type: "function",
    name: "recording_details",
    description:
      "Recompute timing and read pinned source and machine-estimated annotation details for an allowlisted catalog ID.",
    strict: true,
    parameters: objectSchema({ sourceId: { type: "string" } }),
  },
  {
    type: "function",
    name: "compare_selected",
    description:
      "Recompute the current A/B comparison under normalized-interval-mad v1.0.0. Unequal counts remain not comparable.",
    strict: true,
    parameters: objectSchema({}),
  },
  {
    type: "function",
    name: "find_alternatives",
    description:
      "Rank other catalog recordings relative to selected A or B by the same metric. Excludes both selected IDs and byte-identical duplicates. No semantic or threshold claim.",
    strict: true,
    parameters: objectSchema({
      referenceId: { type: "string" },
      limit: { type: "integer", enum: [1, 2] },
    }),
  },
] as const;
