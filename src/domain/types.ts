export type ViewMode = "absolute" | "normalized";
export type Side = "A" | "B";

export interface Recording {
  id: string;
  label: string;
  audio: {
    path: string;
    sha256: string;
    bytes: number;
    durationSeconds: number;
    sampleRateHz: number;
    channels: number;
    frames: number;
    encoding: string;
    transformations: string[];
  };
  source: {
    dataset: string;
    revision: string;
    filename: string;
    url: string;
    datasetCardUrl: string;
    datasetCardSha256: string;
    attribution: string;
    license: string;
    licenseUrl: string;
    citation: string;
    paperUrl: string;
    acquiredOn: string;
  };
  annotation: {
    status: "machine-estimated";
    method: string;
    version: string;
    parameters: {
      envelopeWindowSeconds: number;
      relativeThreshold: number;
      groupGapSeconds: number;
    };
    timestampOrigin: "original-file-start";
    selectedIntervalSeconds: { start: number; end: number };
    clickSampleIndices: number[];
    clickTimesSeconds: number[];
    sourceAnnotations: "not-provided";
    humanReview: "not-performed";
    corrections: string[];
    limitations: string[];
  };
}
