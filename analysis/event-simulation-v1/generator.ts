import protocol from "./protocol.json" with { type: "json" };
import { buildResearchCohorts } from "../dialogue-transfer-v02/cohort.ts";
export { protocol };
export type Family = "independent" | "common-driver" | "directed";
export type Variant = "clean" | "missed-clicks" | "missed-codas" | "arrival-jitter" | "boundaries";
export const HEADER = ["REC", "nClicks", "Duration", ...Array.from({ length: 28 }, (_, i) => `ICI${i + 1}`), "Whale", "TsTo"].join(",");
function rng(seed: number) { let state = seed >>> 0 || 1; return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296; }; }
export interface Event { id: string; rec: string; caller: number; emission: number; arrival: number; clicks: number[]; logDuration: number; driver: number; innovation: number; previousSelf: number; parentLogDuration: number | null }
export function generate(family: Family, variant: Variant, seed: number) {
  const p = protocol.generator, o = protocol.observation, truth: Event[] = [], observed: Event[] = [];
  let missedCodas = 0, missedClicks = 0, censored = 0;
  for (let g = 0; g < protocol.groups; g++) {
    const random = rng(seed + g * 65537), observation = rng(seed + g * 32771 + 912367);
    let a = 0, b = 0, driver = 0;
    for (let k = 0; k < protocol.cycles; k++) {
      const oldA = a, oldB = b, ea = (2 * random() - 1) * p.innovationScale, eb = (2 * random() - 1) * p.innovationScale;
      driver = p.driverAR * driver + p.driverInnovation * (2 * random() - 1);
      a = family === "common-driver" ? p.commonSelfAR * oldA + p.driverCoefficient * driver + ea : p.independentAR * oldA + ea;
      b = family === "directed" ? p.directedSelfAR * oldB + p.directedPartnerCoefficient * oldA + eb : family === "common-driver" ? p.commonSelfAR * oldB + p.driverCoefficient * driver + eb : p.independentAR * oldB + eb;
      for (const caller of [1, 2]) {
        const logDuration = caller === 1 ? a : b, duration = Math.exp(logDuration), emission = k * p.cycleSeconds + (caller === 1 ? 0 : p.callerBOffsetSeconds);
        const e: Event = { id: `${g}:${k}:${caller}`, rec: `sy${g.toString().padStart(4, "0")}001_0`, caller, emission, arrival: emission, clicks: [0, duration * .4, duration], logDuration, driver, innovation: caller === 1 ? ea : eb, previousSelf: caller === 1 ? oldA : oldB, parentLogDuration: family === "directed" && caller === 2 ? oldA : null };
        truth.push(e);
        const drop = observation(), click = observation(), jitter = (observation() * 2 - 1) * o.arrivalJitterSeconds;
        if (variant === "missed-codas" && drop < o.codaLossProbability) { missedCodas++; continue; }
        const copy = { ...e, clicks: [...e.clicks] };
        if (variant === "missed-clicks" && click < o.clickLossProbability) { copy.clicks.splice(1, 1); missedClicks++; }
        if (variant === "arrival-jitter") copy.arrival = emission + .2 + jitter;
        if (variant === "boundaries") {
          const end = emission + duration;
          if (emission < o.windowSeconds[0] || end > o.windowSeconds[1] || (emission < o.splitSeconds && end > o.splitSeconds)) { censored++; continue; }
          copy.rec = copy.rec.slice(0, -1) + (emission >= o.splitSeconds ? "1" : "0");
        }
        observed.push(copy);
      }
    }
  }
  return { truth, observed, counts: { generated: truth.length, observed: observed.length, missedCodas, missedClicks, censored }, csv: serialize(observed) };
}
export function serialize(events: Event[]) {
  return HEADER + "\n" + events.map(e => {
    const intervals = e.clicks.slice(1).map((x, i) => x - e.clicks[i]);
    return [e.rec, e.clicks.length, e.clicks.at(-1)!.toFixed(9), ...Array.from({ length: 28 }, (_, i) => i < intervals.length ? intervals[i].toFixed(9) : "0"), e.caller, e.arrival.toFixed(9)].join(",");
  }).join("\n") + "\n";
}
export function prepare(csv: string) {
  const built = buildResearchCohorts(csv);
  for (const e of built.core) {
    if (e.recentRows.includes(e.targetRow) || e.selfRows.includes(e.targetRow)) throw new Error("Target leaked into history.");
    if (e.sourceBindings.recent.some(r => r.end >= e.cutoff)) throw new Error("Unfinished partner in history.");
    if (e.sourceBindings.recent.some(r => r.rec !== e.rec)) throw new Error("History crossed recording boundary.");
  }
  // Explicit projection: latent truth and generator labels never become predictors.
  return { rows: built.core.map(e => ({ id: e.id, parentGroup: e.parentGroup, currentRow: e.currentRow, targets: { duration: e.targets.duration }, features: { M1: e.features.M1, M2: e.features.M2! } })), split: built.coreSplit,
    audit: { ...built.original.audit.exclusionCounts, inputRows: built.original.audit.sourceRows, validRows: built.original.audit.validRows, invalidRows: built.original.audit.excludedRows, barriers: built.original.audit.barriers.length, eligible: built.core.length } };
}
