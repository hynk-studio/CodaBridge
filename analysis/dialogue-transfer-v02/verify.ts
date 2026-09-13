import assert from "node:assert/strict";
import {readFileSync}from"node:fs";
import{createHash}from"node:crypto";
import{execFileSync}from"node:child_process";
import{checkNumerical,compare,mean,near,quantile,replay,scalarLoss,stats,sum}from"./verification-math.ts";
const root="analysis/dialogue-transfer-v02/", read=(p:string)=>JSON.parse(readFileSync(p,"utf8")), sha=(b:Buffer)=>createHash("sha256").update(b).digest("hex");
const report=read(root+"results/report.json"), fits=read(root+"results/fold-fits.json"), config=read(root+"protocol.json"), manifest=read(root+"input-manifest.json");
assert.deepEqual(report.protocol,config);
for(const entry of manifest.v01Preserved){assert.equal(sha(readFileSync(entry.path)),entry.sha256,entry.path);assert.equal(sha(execFileSync("git",["show",`${manifest.baseline}:${entry.path}`],{maxBuffer:32*1024*1024})),entry.sha256,entry.path);}
for(const [path,hash]of Object.entries(report.provenance.hashes)){assert.equal(sha(readFileSync(path)),hash,path);assert.equal(sha(execFileSync("git",["show",`${report.provenance.producerCommit}:${path}`],{maxBuffer:32*1024*1024})),hash,path);}
for(const path of [...manifest.inputs.map((r:any)=>r.path),root+"input-manifest.json"]) assert.deepEqual(readFileSync(path),execFileSync("git",["show",`${report.provenance.freezeCommit}:${path}`],{maxBuffer:32*1024*1024}));
assert.equal(execFileSync("git",["rev-parse",`${report.provenance.producerCommit}^{tree}`],{encoding:"utf8"}).trim(),report.provenance.producerTree);
execFileSync("git",["merge-base","--is-ancestor",report.provenance.freezeCommit,report.provenance.producerCommit]);
assert.deepEqual(readFileSync(root+"results/report.json"),readFileSync("public/prediction-v02/dialogue-transfer-report.json"));
const summary=read("public/prediction-v02/summary.json");
const sourceCalls=new Map<number,any>(read("analysis/dialogue-transfer/inputs/validated.json").calls.map((c:any)=>[c.sourceLine,c]));
assert.equal(summary.report.sha256,sha(readFileSync(root+"results/report.json")));assert.equal(summary.report.bytes,readFileSync(root+"results/report.json").length);
assert.ok(summary.report.bytes<=config.publicBounds.reportBytes);assert.ok(readFileSync("public/prediction-v02/summary.json").length<=config.publicBounds.summaryBytes);
assert.deepEqual(summary.examples,report.examples);assert.deepEqual(summary.status,report.status);
assert.deepEqual(report.studies.map((s:any)=>s.id),config.studies.map((s:any)=>s.id));assert.equal(report.attemptedLearnedFits,55);
let verifiedFits=0,maxRidgeRatio=0,maxPoissonGradient=0,maxPredictionDifference=0;
for(const study of report.studies){
 const rows=read(root+`inputs/${study.cohort}.json`),split=read(root+`${study.cohort}-split.json`),plan=report.bootstrap[study.cohort];
 for(const row of rows){const target=sourceCalls.get(row.targetRow),current=sourceCalls.get(row.currentRow);assert.equal(target.rec,current.rec);assert.equal(target.caller,current.caller);near(row.cutoff,current.onset+current.duration);near(row.targets.duration,Math.log(target.clicks.at(-1)));assert.equal(row.targets.count,target.clicks.length);near(row.targets.gap,Math.log(target.onset-row.cutoff));assert.ok(target.onset>row.cutoff);}
 assert.deepEqual(report.splits[study.cohort],split);assert.equal(plan.seed,20260913);assert.equal(plan.generator,"PCG64");assert.equal(plan.draws.length,2000);assert.deepEqual(plan.groups,Object.keys(split.assignments).sort());
 assert.ok(plan.draws.every((d:number[])=>d.length===plan.groups.length&&d.every(i=>Number.isInteger(i)&&i>=0&&i<plan.groups.length)));
 const projected=summary.studies.find((s:any)=>s.id===study.id);assert.equal(projected.status,study.status);assert.deepEqual(projected.failures,study.failures);assert.deepEqual(projected.metrics,study.metrics);assert.deepEqual(projected.uncertainty,study.uncertainty);
 if(study.status!=="completed"){assert.ok(study.failures.length);assert.equal(study.metrics,null);assert.equal(study.uncertainty,null);assert.deepEqual(study.records,[]);continue;}
 assert.deepEqual(study.records.map((r:any)=>r.id),rows.map((r:any)=>r.id));assert.equal(new Set(study.records.map((r:any)=>r.id)).size,rows.length);assert.equal(study.folds.length,5);
 for(const fold of study.folds){
  const train=rows.filter((r:any)=>split.assignments[r.parentGroup]!==fold.fold),test=rows.filter((r:any)=>split.assignments[r.parentGroup]===fold.fold);
  assert.deepEqual(fold.trainingGroups,[...new Set(train.map((r:any)=>r.parentGroup))].sort());assert.deepEqual(fold.testGroups,[...new Set(test.map((r:any)=>r.parentGroup))].sort());assert.ok(fold.testGroups.every((g:string)=>!fold.trainingGroups.includes(g)));
  assert.equal(train.length,fold.trainingCount);assert.equal(test.length,fold.testCount);near(fold.latestAgeMedian,quantile(train.map((r:any)=>r.prefix.latestPartnerEndAge),.5));near(fold.baseline,mean(train.map((r:any)=>r.targets[study.target])));
  const saved=fits[study.id].find((f:any)=>f.fold===fold.fold);
  for(const model of study.models.slice(1)){
   const fit=saved.models[model];assert.deepEqual(fit.trainingIds,train.map((r:any)=>r.id));assert.deepEqual(fit.testIds,test.map((r:any)=>r.id));
   for(let j=0;j<fit.coefficients.length;j++){
    const available=train.map((r:any)=>r.features[model][j]).filter((v:any)=>v!==null);const median=available.length?quantile(available,.5):0;near(fit.imputer[j],median);
    const filled=train.map((r:any)=>r.features[model][j]??median),average=mean(filled),sd=Math.sqrt(mean(filled.map((x:number)=>(x-average)**2)));near(fit.mean[j],average);near(fit.scale[j],sd<1e-12?1:sd);
   }
   const d=checkNumerical(train.map((r:any)=>({features:r.features[model],target:r.targets[study.target]})),fit,study.estimator,config,`${study.id}/fold ${fold.fold}/${model}`);near(d.objective,fit.numerical.objective);near(d.bound,fit.numerical.bound);near(d.maximum,fit.numerical[study.estimator==="ridge"?"maximumNormalizedResidual":"maximumGradient"]);verifiedFits++;
   if(study.estimator==="ridge")maxRidgeRatio=Math.max(maxRidgeRatio,d.maximum/d.bound);else{maxPoissonGradient=Math.max(maxPoissonGradient,d.maximum);assert.ok(fit.iterations<config.poisson.max_iter);}
   for(const row of test){const record=study.records.find((r:any)=>r.id===row.id),pred=replay(row.features[model],fit,study.estimator).value;near(pred,record.predictions[model].value);maxPredictionDifference=Math.max(maxPredictionDifference,Math.abs(pred-record.predictions[model].value));}
  }
 }
 const independent=study.records.map((saved:any)=>{
  const row=rows.find((r:any)=>r.id===saved.id),fold=study.folds.find((f:any)=>f.fold===saved.fold);
  for(const key of Object.keys(row).filter(k=>k!=="features"))assert.deepEqual(saved[key],row[key],`${saved.id}.${key}`);
  assert.equal(saved.fold,split.assignments[row.parentGroup]);near(saved.target,row.targets[study.target]);near(saved.predictions.M0.value,fold.baseline);
  assert.deepEqual(saved.strata,{previous:row.prefix.previousPresent?"present":"absent",overlap:row.prefix.recentOverlap?"definite":"no-definite-overlap",age:row.prefix.latestPartnerEndAge<=fold.latestAgeMedian?"at-or-below":"above"});
  const out=structuredClone(saved);
  for(const model of study.models){const p=out.predictions[model],loss=scalarLoss(saved.target,p.value,study.estimator);near(p.loss,loss);p.loss=loss;near(p.absoluteError,Math.abs(saved.target-p.value));near(p.nativePoint,study.estimator==="poisson"?p.value:Math.exp(p.value));assert.equal(p.outsideTrainingCountRange,study.estimator==="poisson"&&(p.value<fold.trainingTargetRange[0]||p.value>fold.trainingTargetRange[1]));assert.equal(p.outsideSourceCountRange,study.estimator==="poisson"&&(p.value<2||p.value>29));}
  for(const key of Object.keys(saved.gain)){const[a,b]=key.split("_vs_");out.gain[key]=out.predictions[b].loss-out.predictions[a].loss;near(saved.gain[key],out.gain[key]);}return out;
 });
 const keys=Object.keys(study.metrics.pooled.gain), expected=stats(independent,study.models,keys);compare(study.metrics,expected,study.id);
 for(const g of study.metrics.perGroup)for(const key of keys){near(g.pooledContribution[key],g.n/rows.length*g.gain[key]);near(g.macroContribution[key],g.gain[key]/plan.groups.length);}
 for(const model of study.models)for(const key of ["outsideTrainingCountRange","outsideSourceCountRange"])assert.equal(study.metrics.outOfRangeMeans[model][key],independent.filter((r:any)=>r.predictions[model][key]).length);
 for(const deletion of study.deletions)compare(deletion.remaining,stats(independent.filter((r:any)=>r.parentGroup!==deletion.removedRoot),study.models,keys));
 assert.deepEqual(study.deletions.map((d:any)=>d.removedRoot),plan.groups);
 for(const partition of Object.keys(study.strata)){let n=0;for(const [cell,metrics]of Object.entries(study.strata[partition])){const subset=independent.filter((r:any)=>r.strata[partition]===cell);n+=subset.length;compare(metrics,stats(subset,study.models,keys));}assert.equal(n,rows.length);}
 const groups=new Map<string,any>(expected.perGroup.map(g=>[g.parentGroup,g]));
 for(const key of keys){const pooled:number[]=[],macro:number[]=[];for(const draw of plan.draws){const chosen=draw.map((i:number)=>groups.get(plan.groups[i]));pooled.push(sum(chosen.map((g:any)=>g.n*g.gain[key]))/sum(chosen.map((g:any)=>g.n)));macro.push(mean(chosen.map((g:any)=>g.gain[key])));}
  compare(study.uncertainty.intervals[key],{pooled:[quantile(pooled,.025),quantile(pooled,.975)],macro:[quantile(macro,.025),quantile(macro,.975)]});
 }
 assert.deepEqual(projected.selectedRecords,study.cohort==="core"?study.records.filter((r:any)=>report.splits.core.selectedExamples.includes(r.id)):[]);
}
console.log(JSON.stringify({status:"V0.2 INDEPENDENT VERIFICATION PASS",protectedV01Files:manifest.v01Preserved.length,verifiedFits,maxRidgeRatio,maxPoissonGradient,maxPredictionDifference,checks:"freeze/producer/source bytes; exact support; group/preprocessing/stratum isolation; scalar predictions; enforced Ridge/Poisson numerical bounds; metrics/contributions/deletions/all strata; paired bootstrap arithmetic; summary/report parity"}));
