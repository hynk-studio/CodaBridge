// Independent scalar replay and stationarity; no Python or fitting imports.
import assert from "node:assert/strict";
export interface Fit { imputer:number[];mean:number[];scale:number[];coefficients:number[];intercept:number }
export const sum = (xs:number[]) => xs.reduce((a,b)=>a+b,0);
export const mean = (xs:number[]) => sum(xs)/xs.length;
export function quantile(xs:number[],q:number) { const a=[...xs].sort((a,b)=>a-b), x=(a.length-1)*q, lo=Math.floor(x);return a[lo]+(a[Math.ceil(x)]-a[lo])*(x-lo); }
export const near = (a:number,b:number,label="number") => assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-8+1e-7*Math.abs(b),`${label}: ${a} differs from ${b}`);
export function replay(features:(number|null)[],fit:Fit,kind:string) {
 const x=features.map((v,j)=>((v??fit.imputer[j])-fit.mean[j])/fit.scale[j]);
 const linear=fit.intercept+sum(x.map((v,j)=>v*fit.coefficients[j]));
 return {x,value:kind==="poisson"?Math.exp(linear):linear};
}
export function scalarLoss(y:number,p:number,kind:string) {
 assert.ok(Number.isFinite(y)&&Number.isFinite(p)&&(kind!=="poisson"||(y>0&&p>0)),"Invalid finite prediction/target");
 return kind==="poisson"?2*(y*Math.log(y/p)-y+p):(y-p)**2;
}
export function checkNumerical(rows:{features:(number|null)[];target:number}[],fit:Fit,kind:string,config:any,label:string) {
 assert.ok([...fit.coefficients,fit.intercept].every(Number.isFinite),`${label}: nonfinite coefficients`);
 const n=rows.length,p=fit.coefficients.length, alpha=config[kind].alpha;
 const reconstructed=rows.map(r=>replay(r.features,fit,kind));
 assert.ok(reconstructed.every(r=>Number.isFinite(r.value)&&r.x.every(Number.isFinite)&&(kind!=="poisson"||r.value>0)),`${label}: nonfinite/nonpositive prediction`);
 const residuals=reconstructed.map((r,i)=>r.value-rows[i].target);
 let maximum:number,bound:number,objective:number;
 if(kind==="poisson") {
  const g=fit.coefficients.map((w,j)=>sum(reconstructed.map((r,i)=>r.x[j]*residuals[i]))/n+alpha*w);g.push(mean(residuals));
  assert.ok(g.every(Number.isFinite),`${label}: nonfinite gradient`);
  maximum=Math.max(...g.map(Math.abs));bound=config.poisson.tol;
  objective=mean(rows.map((r,i)=>scalarLoss(r.target,reconstructed[i].value,kind)/2))+alpha*sum(fit.coefficients.map(w=>w*w))/2;
 } else {
  const g=fit.coefficients.map((w,j)=>sum(reconstructed.map((r,i)=>r.x[j]*residuals[i]))+alpha*w);g.push(sum(residuals));
  const scales=fit.coefficients.map((w,j)=>Math.max(1,sum(reconstructed.map((r,i)=>Math.abs(r.x[j])*(Math.abs(r.value)+Math.abs(rows[i].target))))+alpha*Math.abs(w)));
  scales.push(Math.max(1,sum(reconstructed.map((r,i)=>Math.abs(r.value)+Math.abs(rows[i].target)))));
  assert.ok(g.every(Number.isFinite)&&scales.every(Number.isFinite),`${label}: nonfinite normal equation`);
  maximum=Math.max(...g.map((v,j)=>Math.abs(v)/scales[j]));bound=config.numerics.ridgeEpsilonFactor*Number.EPSILON*(n+p+1);
  objective=sum(residuals.map(r=>r*r))+alpha*sum(fit.coefficients.map(w=>w*w));
 }
 assert.ok(Number.isFinite(objective)&&Number.isFinite(maximum)&&maximum<=bound,`${label}: numerical acceptance failed ${maximum} > ${bound}`);
 return {maximum,bound,objective};
}
export function stats(records:any[],models:string[],keys:string[]) {
 const groups=[...new Set<string>(records.map(r=>r.parentGroup))].sort();
 const aggregate=(rows:any[])=>({n:rows.length,loss:Object.fromEntries(models.map(m=>[m,mean(rows.map(r=>r.predictions[m].loss))])),mae:Object.fromEntries(models.map(m=>[m,mean(rows.map(r=>r.predictions[m].absoluteError))])),gain:Object.fromEntries(keys.map(k=>[k,mean(rows.map(r=>r.gain[k]))]))});
 if(!records.length)return {status:"empty",groups:0,pooled:null,macro:null,perGroup:[]};
 const pooled=aggregate(records),perGroup=groups.map(parentGroup=>({parentGroup,...aggregate(records.filter(r=>r.parentGroup===parentGroup))}));
 const macro=Object.fromEntries((["loss","mae","gain"] as const).map(kind=>[kind,Object.fromEntries(Object.keys(pooled[kind]).map(key=>[key,mean(perGroup.map(g=>g[kind][key]))]))]));
 return {status:groups.length<5?"limited-group-coverage":"descriptive",groups:groups.length,pooled,macro,perGroup:perGroup.map(g=>({...g,pooledContribution:Object.fromEntries(keys.map(k=>[k,g.n/records.length*g.gain[k]])),macroContribution:Object.fromEntries(keys.map(k=>[k,g.gain[k]/groups.length]))}))};
}
export function compare(actual:any,expected:any,path="root") {
 if(typeof expected==="number")return near(actual,expected,path);
 if(Array.isArray(expected)){assert.ok(Array.isArray(actual),path);assert.equal(actual.length,expected.length,path);return expected.forEach((v,i)=>compare(actual[i],v,`${path}[${i}]`));}
 if(expected!==null&&typeof expected==="object"){for(const key of Object.keys(expected))compare(actual[key],expected[key],`${path}.${key}`);return;}
 assert.equal(actual,expected,path);
}
