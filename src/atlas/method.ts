// MVP-06 descriptive definitions, written before the first Atlas derivation.
export const ATLAS_METHOD = {
  id: "observed-timing-style-atlas",
  version: "1.0.0",
  population: "All retained parseAnnotations records; equal record weights, exact click-count groups. Records are not independent animals or proven distinct biological events.",
  intervals: "Full original n-1 positive ICIs in seconds; no clipping, warping, padding, deduplication or count interpolation.",
  durationSeconds: "D = sum(d); first to last click, not declared Duration or recording length.",
  gapShares: "p_j = d_j / D; dimensionless fractions summing to one.",
  clickPositions: "Zero followed by cumulative p; last position one within arithmetic tolerance.",
  meanIntervalSeconds: "D / (n-1)",
  intervalCV: "sqrt(sum((d_j - mean)^2)/(n-1)) / mean; population interval standard deviation, dimensionless.",
  endpointRatio: "last interval / first interval; dimensionless ratio, not monotonic acceleration or rubato.",
  endpointShareDifference: "last p - first p; dimensionless fraction, not ornamentation.",
  quantiles: { probabilities: [0.1, 0.5, 0.9], rule: "Sorted values; h=(N-1)q; linear interpolation between floor(h) and ceil(h). Empty=null; singleton=its value; ties unchanged." },
  sparse: { minimumRecords: 20, minimumRoots: 3, rule: "Sparse if either minimum is unmet. UI suppresses bands and percentile judgments; numeric downloads remain descriptive." },
  ranges: "Observed 10th–90th percentile range, at each gap position",
  warning: "Marginal archive descriptions, not confidence intervals, a joint 80% region or synthesis recipes. Coordinate medians need not sum to one. Never splice or normalize quantiles into an observed exemplar.",
  shape: "normalized-interval-mad v1.0.0 from compareTiming; exact count only, ascending distance then source line. Two-click shape is nondiscriminating; ties do not imply identity or meaning.",
  grouping: "Exact REC, nine-character prefix and six-character root are provenance labels; caller is local to REC. Roots may be dependent; no resolved animal or encounter identity.",
  selection: "Default actual exemplar: ascending source line. Optional ascending duration, CV and endpoint ratio sorts; source-line ties.",
  arithmeticTolerance: 1e-10,
  annotationSchedule: { maximumClicks: 29, maximumSpanSeconds: 120, attenuation: "1 / max(2, maximum overlapping 12 ms pulses); shared click-pulse-1 renderer." },
  byteLimits: { summary: 262144, report: 8388608 },
} as const;

export const SOURCE_SHA256 = "1856c8bf915cc5ae6f928aaa2036cbbc6ad8840bb6e4f6a96aaeb96953215da2";
export const SOURCE_RELEASE = "7228c8eed2cc27ddd23b74c51aeccec9d762389e";
export const ATLAS_LIMITATIONS = [
  "Retained archive records, not independent whales or species-wide limits. Roots may share animals, settings or events; multiple shapes can share a count.",
  "Archive/paper 3,840/3,948-row correspondence remains unresolved. All 50 original parser exclusions remain excluded.",
  ATLAS_METHOD.warning,
  "Actual annotated rows have no verified field-audio join. Audition is a synthetic timing reconstruction, not original audio.",
  "Descriptive human-creation reference only: no authenticity, meaning, biological classification or validated whale-response rule.",
] as const;
