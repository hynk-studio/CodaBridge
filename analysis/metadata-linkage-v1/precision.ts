// Decimal comparisons are exact in 10^-40 seconds. No binary epoch subtraction,
// clock correction, per-event fitted offset, timezone assignment or time search.
const Q = 10n ** 40n;
export const abs = (x: bigint) => x < 0n ? -x : x;
export function decimal(s: string): bigint | null {
  const m = /^([+-]?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(s);
  if (!m) return null;
  const exponent = Number(m[4] ?? 0) - (m[3]?.length ?? 0);
  if (exponent < -30 || exponent > 15) throw new Error(`Unsupported decimal precision: ${s}`);
  return (m[1] === "-" ? -1n : 1n) * BigInt(m[2] + (m[3] ?? "")) * 10n ** BigInt(40 + exponent);
}
export function halfUnit(s: string): bigint {
  if (decimal(s) === null) throw new Error(`Missing numeric precision: ${s}`);
  const [base, exp = "0"] = s.toLowerCase().split("e");
  return 5n * 10n ** BigInt(39 + Number(exp) - (base.split(".")[1]?.length ?? 0));
}
export function format(x: bigint) {
  const a = abs(x), fraction = (a % Q).toString().padStart(40, "0").replace(/0+$/, "");
  return `${x < 0 ? "-" : ""}${a / Q}${fraction ? "." + fraction : ""}`;
}
export interface Measure { value: bigint; error: bigint }
export function measure(s: string): Measure | null {
  const value = decimal(s);
  return value === null ? null : { value, error: halfUnit(s) };
}
export function compare(a: Measure | null, b: Measure | null) {
  if (!a || !b) return { status: "missing", delta: null, allowance: null };
  const delta = b.value - a.value, allowance = a.error + b.error;
  return { status: delta === 0n ? "exact" : abs(delta) <= allowance ? "rounding-compatible" : "conflict", delta: format(delta), allowance: format(allowance) };
}
export const agrees = (x: ReturnType<typeof compare>) => x.status === "exact" || x.status === "rounding-compatible";
export function sumIcis(raw: Record<string, string>, max: number): Measure | null {
  const n = Number(raw.nClicks);
  if (!Number.isInteger(n) || n < 1 || n > max + 1) return null;
  let value = 0n, error = 0n;
  for (let i = 1; i < n; i++) {
    const m = measure(raw[`ICI${i}`]);
    if (!m) return null;
    value += m.value; error += m.error;
  }
  return { value, error };
}
// Civil calendar ordinal only. Date.UTC is used for checked Gregorian day
// arithmetic; no supplied datetime is assigned UTC or converted between zones.
export function civilTime(s: string): Measure | null {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?$/.exec(s);
  if (!m) return null;
  const [y, mo, d, h, mi, sec] = m.slice(1, 7).map(Number);
  const day = Date.UTC(y, mo - 1, d), checked = new Date(day);
  if (checked.getUTCFullYear() !== y || checked.getUTCMonth() !== mo - 1 || checked.getUTCDate() !== d || h > 23 || mi > 59 || sec > 59) return null;
  return { value: BigInt(day / 1000 + h * 3600 + mi * 60 + sec) * Q + decimal(`0.${m[7] ?? "0"}`)!, error: m[7] ? halfUnit(`0.${m[7]}`) : 0n };
}
export function difference(a: Measure | null, b: Measure | null): Measure | null {
  return a && b ? { value: a.value - b.value, error: a.error + b.error } : null;
}
