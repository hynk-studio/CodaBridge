// TEST ONLY: expected answers are injected into fixture transport, never production/model inputs.
import { finalOutput, functionOutput } from "../../tests/fixtures/provider.ts";
import type { ProviderTransport } from "../../server/provider.ts";
import { toolEvidence, type Case } from "./cases.ts";
import type { Answer } from "./evaluate.ts";
export function fixtureAnswer(c: Case): Answer {
  return { binding: c.binding, measurements: Object.entries(c.expected).map(([name,value]) => ({ name,value,evidenceId: toolEvidence(c,c.required.find(t => Object.hasOwn(toolEvidence(c,t).data,name))!).id })), abstentions: [...c.abstain], biologicalClaim: "none",
    nextCheck: { alternatives: ["Direct response to a partner", "Shared context or measurement effects"], observation: "Compare repeated observations within measured environmental and producer groups, then test arrival-time and missing-event sensitivity.", availability: "new-observation", outcomes: ["A remaining association after controls would narrow the explanations without proving causality.", "A disappearing association would weaken the direct-response account."] } };
}
export function fixtureTransport(c: Case, answer = fixtureAnswer(c)) {
  const requests: unknown[] = []; let calls = 0;
  const transport: ProviderTransport = async (_url, init) => {
    requests.push(JSON.parse(String(init.body)));
    const index = calls++;
    return Response.json(index < c.required.length ? functionOutput(c.required[index],{},index) : finalOutput(answer));
  };
  return { transport, requests };
}
