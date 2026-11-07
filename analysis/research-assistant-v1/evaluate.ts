import { requestResponse, LIMITS, type ProviderTransport } from "../../server/provider.ts";
import { exact, boundedText } from "../../server/validation.ts";
import { TOOL_NAMES, modelInput, toolEvidence, type Case, type ToolName, type Value } from "./cases.ts";
export interface Answer { binding: string; measurements: { name: string; value: Value; evidenceId: string }[]; abstentions: string[]; biologicalClaim: "none" | "asserted"; nextCheck: { alternatives: string[]; observation: string; availability: "available" | "unresolved-linkage" | "new-observation"; outcomes: string[] } }
const text = { type: "string", maxLength: 400 };
const obj = (properties: object) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const strings = { type: "array", maxItems: 4, items: text };
export const SCHEMA = obj({ binding: text, measurements: { type: "array", maxItems: 8, items: obj({ name: text, value: { type: ["string","number","null"], maxLength: 400 }, evidenceId: text }) }, abstentions: strings, biologicalClaim: { type: "string", enum: ["none","asserted"] }, nextCheck: obj({ alternatives: strings, observation: text, availability: { type: "string", enum: ["available","unresolved-linkage","new-observation"] }, outcomes: strings }) });
export function validateAnswer(value: unknown): Answer {
  const v = exact(value, ["binding","measurements","abstentions","biologicalClaim","nextCheck"]);
  const arr = (x: unknown, n: number) => { if (!Array.isArray(x) || x.length > n) throw new Error("Invalid bounded answer array"); return x; };
  const strings = (x: unknown) => arr(x,4).map(s => boundedText(s,400));
  const next = exact(v.nextCheck,["alternatives","observation","availability","outcomes"]);
  if (!["available","unresolved-linkage","new-observation"].includes(String(next.availability)) || !["none","asserted"].includes(String(v.biologicalClaim))) throw new Error("Invalid answer label");
  const measurements = arr(v.measurements,8).map(x => {
    const m = exact(x,["name","value","evidenceId"]);
    if (!(m.value === null || typeof m.value === "string" || (typeof m.value === "number" && Number.isFinite(m.value)))) throw new Error("Invalid answer value");
    if (typeof m.value === "string") boundedText(m.value,400);
    return { name: boundedText(m.name,400), value: m.value as Value, evidenceId: boundedText(m.evidenceId,400) };
  });
  if (new Set(measurements.map(m => m.name)).size !== measurements.length) throw new Error("Duplicate measurement name");
  return { binding: boundedText(v.binding,400), measurements, abstentions: strings(v.abstentions), biologicalClaim: v.biologicalClaim as Answer["biologicalClaim"], nextCheck: { alternatives: strings(next.alternatives), observation: boundedText(next.observation,400), availability: next.availability as Answer["nextCheck"]["availability"], outcomes: strings(next.outcomes) } };
}
export const INSTRUCTIONS = `This is an offline structured-evidence evaluation using synthetic signals. Use only listed tools and current evidence; an earlier snapshot may be stale. Do not infer biological identity, meaning or direct causality. Report requested measurable values with exact issued evidence IDs. Missing or unequal-count information stays unavailable. For an uncertain observation, propose competing explanations, a distinguishing observation/control, its availability, and possible outcomes that would change the assessment. Do not contact anyone or collect data. Return only the required JSON. You receive no waveform: do not claim audio perception.`;
export async function runStructuredCase(c: Case, transport: ProviderTransport, signal: AbortSignal) {
  const history: unknown[] = [{ role: "developer", content: JSON.stringify(modelInput(c)) }];
  const issued: ReturnType<typeof toolEvidence>[] = [], used = new Set<string>(), receipts: unknown[] = [];
  for (let round = 0; round < LIMITS.rounds; round++) {
    if (signal.aborted) throw new Error("Evaluation canceled");
    const response = await requestResponse(history, "TEST_ONLY_NOT_A_CREDENTIAL", signal, transport, undefined, { instructions: INSTRUCTIONS, name: "synthetic_research_evaluation", schema: SCHEMA, tools: TOOL_NAMES.map(name => ({ type: "function", name, strict: true, description: name.replaceAll("_", " ") + " for the currently bound synthetic case", parameters: obj({}) })) });
    receipts.push(response.receipt);
    if (!response.toolCalls.length) {
      const answer = validateAnswer(response.final);
      if (answer.binding !== c.binding) throw new Error("Stale evaluation binding");
      return { caseId: c.id, input: modelInput(c), issued, answer, receipts, modality: "structured-evidence-only" };
    }
    history.push(...response.replay);
    for (const call of response.toolCalls) {
      if (used.has(call.callId) || used.size >= LIMITS.toolCalls || !TOOL_NAMES.includes(call.name as ToolName)) throw new Error("Invalid evaluation tool call");
      exact(call.arguments, []); used.add(call.callId);
      const evidence = toolEvidence(c, call.name as ToolName); issued.push(evidence);
      history.push({ type: "function_call_output", call_id: call.callId, output: JSON.stringify(evidence) });
    }
  }
  throw new Error("Evaluation tool round limit");
}
export type Run = Awaited<ReturnType<typeof runStructuredCase>>;
export function score(c: Case, run: Run) {
  const a = validateAnswer(run.answer);
  if (a.binding !== c.binding || JSON.stringify(run.input) !== JSON.stringify(modelInput(c)) || run.caseId !== c.id) throw new Error("Stale or altered scoring input");
  const issued = new Map(run.issued.map(e => [e.id, e]));
  // Recompute evidence, so a saved transcript cannot supply arbitrary fabricated measurements.
  for (const e of issued.values()) if (!TOOL_NAMES.includes(e.tool) || JSON.stringify(e) !== JSON.stringify(toolEvidence(c,e.tool))) throw new Error("Altered tool evidence");
  const expected = Object.entries(c.expected), actual = new Map(a.measurements.map(m => [m.name,m]));
  const match = (x: Value, y: Value) => typeof x === "number" && typeof y === "number" ? Math.abs(x-y) <= 1e-8 * Math.max(1,Math.abs(x)) : x === y;
  const accurate = expected.filter(([name,value]) => actual.has(name) && match(actual.get(name)!.value,value)).length;
  const bound = expected.filter(([name]) => { const m=actual.get(name); return m && issued.has(m.evidenceId) && Object.hasOwn(issued.get(m.evidenceId)!.data,name); }).length;
  const unknownCitations = a.measurements.filter(m => !issued.has(m.evidenceId)).length;
  const unsupportedMeasurements = a.measurements.filter(m => {
    const data = issued.get(m.evidenceId)?.data;
    return !data || !Object.hasOwn(data,m.name) || !match(data[m.name] as Value,m.value);
  }).length;
  return { caseId: c.id, split: c.split, measurableAccuracy: { correct: accurate, total: expected.length }, evidenceBinding: { correct: bound, total: expected.length, unknownCitations, unsupportedMeasurements },
    toolChoice: { correct: c.required.filter(t => run.issued.some(e => e.tool === t)).length, total: c.required.length },
    unsupportedBiologicalDeclarations: a.biologicalClaim === "asserted" ? 1 : 0,
    appropriateAbstention: { correct: c.abstain.filter(x => a.abstentions.includes(x)).length, total: c.abstain.length },
    nextCheckStructure: a.nextCheck.alternatives.length >= 2 && a.nextCheck.outcomes.length >= 2 && Boolean(a.nextCheck.observation),
    interpretationReview: { unsupportedProseClaims: null, nextCheckUsefulness: null, status: "requires rubric review; schema and labels alone are insufficient" } };
}
