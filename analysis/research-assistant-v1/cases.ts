import { createHash } from "node:crypto";
import { compareTiming, measureTiming } from "../../src/domain/timing.ts";
import { renderClickSchedule, RENDERER } from "../../src/composer/sound.ts";
import { analyzePCM } from "../../src/spectral/dsp.ts";
export const VERSION = "research-assistant-v1";
export const TOOL_NAMES = ["measure_timing", "inspect_overlap", "inspect_spectrum", "inspect_context"] as const;
export type ToolName = typeof TOOL_NAMES[number];
export type Value = string | number | null;
export interface Case { id: string; split: "development" | "evaluation"; family: string; question: string; a: number[]; b: number[]; pulse?: "high" | "noise"; expected: Record<string, Value>; required: ToolName[]; abstain: string[]; previous?: { countA: number }; binding: string }
const timingInput = (times: number[]) => ({ clickTimesSeconds: times, durationSeconds: 3, selectedIntervalSeconds: { start: 0, end: 3 } });
function signal(times: number[], pulse?: string) {
  const pcm = renderClickSchedule(times.map(seconds => ({ seconds })), 3);
  if (pulse === "high") {
    pcm.fill(0); const length = Math.floor(RENDERER.pulseSeconds * RENDERER.sampleRate);
    for (const at of times) for (let j = 0; j < length; j++) {
      const t = j / RENDERER.sampleRate;
      pcm[Math.round(at * RENDERER.sampleRate) + j] += RENDERER.gain * Math.sin(Math.PI * j / length) ** 2 * Math.exp(-240 * t) * Math.sin(2 * Math.PI * 6000 * t);
    }
  }
  if (pulse === "noise") for (let i = 0; i < pcm.length; i++) pcm[i] += .02 * Math.sin(2 * Math.PI * 10000 * i / RENDERER.sampleRate);
  return pcm;
}
export function toolEvidence(c: Case, tool: ToolName) {
  let data: Record<string, unknown>;
  if (tool === "measure_timing") {
    const a = measureTiming(timingInput(c.a)), b = measureTiming(timingInput(c.b)), comparison = compareTiming(timingInput(c.a), timingInput(c.b));
    if (a.status !== "valid" || b.status !== "valid") throw new Error("Invalid case timing");
    data = { countA: a.measurements.clickCount, countB: b.measurements.clickCount, spanASeconds: a.measurements.clickSpanSeconds, spanBSeconds: b.measurements.clickSpanSeconds,
      durationRatio: b.measurements.clickSpanSeconds / a.measurements.clickSpanSeconds, shapeDistance: comparison.status === "comparable" ? comparison.value : null,
      shapeStatus: comparison.status, normalizedA: a.measurements.normalizedIntervals, normalizedB: b.measurements.normalizedIntervals };
  } else if (tool === "inspect_overlap") {
    data = { earlier: c.a[0] < c.b[0] ? "A" : c.a[0] > c.b[0] ? "B" : "simultaneous", overlapSeconds: Math.max(0, Math.min(c.a.at(-1)!, c.b.at(-1)!) - Math.max(c.a[0], c.b[0])) };
  } else if (tool === "inspect_spectrum") {
    const a = analyzePCM(signal(c.a), 48000, c.a.map(t => t + .006)), b = analyzePCM(signal(c.b, c.pulse), 48000, c.b.map(t => t + .006));
    data = { centroidAHz: a.meanEvent?.centroidHz ?? null, centroidBHz: b.meanEvent?.centroidHz ?? null, centroidDeltaHz: a.meanEvent && b.meanEvent ? b.meanEvent.centroidHz - a.meanEvent.centroidHz : null,
      method: "native-spectrum-v1 fixed pulse windows; synthetic click-pulse-1 or eval-pulse-6000-v1; not original whale audio" };
  } else {
    data = { producer: "unknown", meaning: "unknown", directInfluence: "unidentified", behavior: null, environmentMeasured: false,
      association: "A positive partner-history predictive gain can also occur under a shared driver. This observation does not identify direct coupling.", sourceClass: "synthetic", waveformSuppliedToModel: false };
  }
  return { id: `${c.binding}:${tool}`, binding: c.binding, tool, sourceClass: "synthetic", data };
}
const specs = [
  { family: "single-count", question: "How many events are in A and B?", a: [.1,.3,.7], b: [.1,.2,.3,.7], keys: ["countA","countB"], tools: ["measure_timing"] },
  { family: "uniform-scale", question: "What is B/A span ratio, and is normalized timing unchanged?", a: [.1,.2,.4,.8], b: [.1,.3,.7,1.5], keys: ["durationRatio","shapeDistance"], tools: ["measure_timing"] },
  { family: "gap-permutation", question: "Measure normalized timing difference when the endpoints are the same.", a: [.1,.2,.4,.8], b: [.1,.5,.6,.8], keys: ["durationRatio","shapeDistance"], tools: ["measure_timing"] },
  { family: "span-overlap", question: "Which train starts first, and how long do their first-to-last spans overlap?", a: [.1,.2,.4], b: [.2,.3,.6], keys: ["earlier","overlapSeconds"], tools: ["inspect_overlap"] },
  { family: "pulse-shape", question: "Measure B minus A mean event-window spectral centroid in Hz.", a: [.1,.3,.7], b: [.1,.3,.7], pulse: "high", keys: ["centroidDeltaHz"], tools: ["inspect_spectrum"] },
  { family: "count-and-scale", question: "Compare counts and duration ratio. Is the normalized shape metric available?", a: [.1,.3,.7], b: [.1,.5,.9,1.3], keys: ["countA","countB","durationRatio","shapeDistance"], tools: ["measure_timing"], abstain: ["unequal-count-shape"] },
  { family: "noisy-order", question: "Which train starts first? Also measure B minus A event centroid; keep timing and spectral judgments separate.", a: [.4,.6,.8], b: [.1,.3,.7], pulse: "noise", keys: ["earlier","centroidDeltaHz"], tools: ["inspect_overlap","inspect_spectrum"] },
  { family: "missing-producer", question: "Can this evidence identify the whale producer or animal meaning?", a: [.1,.3,.7], b: [.1,.3,.7], keys: ["producer","meaning"], tools: ["inspect_context"], abstain: ["identity","meaning"] },
  { family: "shared-driver-identifiability", question: "Does incremental partner-history prediction identify direct influence? Propose evidence that could distinguish explanations.", a: [.1,.3,.7], b: [.1,.3,.7], keys: ["directInfluence"], tools: ["inspect_context"], abstain: ["causal-identification"] },
  { family: "revised-input", question: "A previous snapshot reported three A events. Use the current evidence and binding to report A's event count.", a: [.1,.2,.3,.5,.7], b: [.1,.3,.7], keys: ["countA"], tools: ["measure_timing"], previous: { countA: 3 } },
] as const;
export const cases: Case[] = specs.map((s, i) => {
  const binding = createHash("sha256").update(JSON.stringify({ version: VERSION, a: s.a, b: s.b, question: s.question, pulse: "pulse" in s ? s.pulse : null })).digest("hex");
  const c: Case = { id: `case-${String(i + 1).padStart(2, "0")}`, split: i < 5 ? "development" : "evaluation", family: s.family, question: s.question, a: [...s.a], b: [...s.b], pulse: "pulse" in s ? s.pulse : undefined, expected: {}, required: [...s.tools], abstain: "abstain" in s ? [...s.abstain] : [], previous: "previous" in s ? s.previous : undefined, binding };
  for (const key of s.keys) for (const tool of c.required) {
    const v = toolEvidence(c, tool).data[key]; if (v !== undefined) c.expected[key] = v as Value;
  }
  return c;
});
export const modelInput = (c: Case) => ({ caseId: c.id, binding: c.binding, question: c.question, sourceClass: "synthetic", modality: "structured-evidence-only", previous: c.previous ?? null });
