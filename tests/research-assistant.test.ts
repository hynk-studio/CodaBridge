import assert from "node:assert/strict";
import test from "node:test";
import { cases, modelInput, toolEvidence } from "../analysis/research-assistant-v1/cases.ts";
import { fixtureAnswer, fixtureTransport } from "../analysis/research-assistant-v1/fixtures.ts";
import { runStructuredCase, score, validateAnswer } from "../analysis/research-assistant-v1/evaluate.ts";
test("frozen family split and hand-computable targets exclude answers from model inputs", () => {
  const dev=new Set(cases.filter(c=>c.split==='development').map(c=>c.family));
  assert.ok(cases.filter(c=>c.split==='evaluation').every(c=>!dev.has(c.family)));
  assert.deepEqual(cases[0].expected,{countA:3,countB:4}); assert.ok(Math.abs(Number(cases[1].expected.durationRatio)-2)<1e-12);
  assert.equal(cases[5].expected.shapeDistance,null); assert.equal(cases[9].expected.countA,5);
  for(const c of cases){const input=JSON.stringify(modelInput(c));for(const key of ['expected','family','pulse','recipe','codebook'])assert.ok(!input.includes('"'+key+'"'));}
});
test("real adapter/tool dispatch, distinct task scores and changed binding", async () => {
  for(const c of cases){const f=fixtureTransport(c),run=await runStructuredCase(c,f.transport,new AbortController().signal),s=score(c,run);
    assert.equal(s.measurableAccuracy.correct,s.measurableAccuracy.total);assert.equal(s.evidenceBinding.correct,s.evidenceBinding.total);assert.equal(s.appropriateAbstention.correct,s.appropriateAbstention.total);assert.equal(s.interpretationReview.nextCheckUsefulness,null);
    const bad=structuredClone(run);bad.answer.measurements[0].value='wrong';bad.answer.measurements[0].evidenceId='invented';bad.answer.biologicalClaim='asserted';bad.answer.abstentions=[];const scored=score(c,bad);assert.ok(scored.measurableAccuracy.correct<scored.measurableAccuracy.total);assert.equal(scored.evidenceBinding.unknownCitations,1);assert.equal(scored.unsupportedBiologicalDeclarations,1);
    for(const request of f.requests){const p=request as {input:unknown};assert.ok(!JSON.stringify(p.input).includes('"expected"'));}
    const stale=fixtureAnswer(c);stale.binding='old';const ff=fixtureTransport(c,stale);await assert.rejects(()=>runStructuredCase(c,ff.transport,new AbortController().signal),/Stale/);
  }
});
test("cancellation, corrupted evidence and duplicate answer keys fail", async()=>{
  const c=cases[0],f=fixtureTransport(c),ac=new AbortController();ac.abort();await assert.rejects(()=>runStructuredCase(c,f.transport,ac.signal),/canceled/);assert.equal(f.requests.length,0);
  const run=await runStructuredCase(c,f.transport,new AbortController().signal);run.issued[0].data.countA=99;assert.throws(()=>score(c,run),/Altered/);
  const answer=fixtureAnswer(c);answer.measurements.push({...answer.measurements[0]});assert.throws(()=>validateAnswer(answer),/Duplicate/);
  const long=fixtureAnswer(c);long.measurements[0].value="x".repeat(401);assert.throws(()=>validateAnswer(long));
  const valid=await runStructuredCase(c,fixtureTransport(c).transport,new AbortController().signal);
  valid.answer.measurements.push({name:"inventedIdentity",value:"unknown whale",evidenceId:valid.issued[0].id});
  assert.equal(score(c,valid).evidenceBinding.unsupportedMeasurements,1);
  valid.input.question="altered";assert.throws(()=>score(c,valid),/altered scoring input/);
  assert.equal(toolEvidence(c,'inspect_context').data.producer,'unknown');
});
