import data from "../data/context.json" with { type: "json" };
import { LAB_METHOD, validateSegment, type Segment } from "./model.ts";
export const contextSource = data.source;
export const DATASET_ID = data.datasetId;
export const contextSegment = validateSegment(
  data.segment as unknown as Segment,
);
export const DEFAULT_LAB_QUESTION =
  "Does the similarity depend on the pairing? Compare the observed calls with reassigned pairings and explain other possible explanations.";
export function labBinding(offset: number, selectedRowId: string) {
  return JSON.stringify({
    datasetId: DATASET_ID,
    releaseCommit: contextSource.releaseCommit,
    csvSha256: contextSource.csvSha256,
    derivedVersion: data.version,
    selectionRule: data.selectionRule,
    segmentId: contextSegment.id,
    callers: contextSegment.callers,
    method: LAB_METHOD,
    offset,
    selectedRowId,
  });
}
