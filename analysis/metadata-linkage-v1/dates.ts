// Candidate date interpretations only. Never select a locale or timezone to
// force agreement. The only textual month tokens present are March and May.
export function dateCandidates(s: string): string[] {
  const m = /^(\d{2})-(\d{2}|מרץ|מאי)-(\d{4})$/.exec(s);
  if (!m) return [];
  const a = Number(m[1]), y = Number(m[3]), textMonth: Record<string, number> = { מרץ: 3, מאי: 5 };
  const b = textMonth[m[2]] ?? Number(m[2]);
  const candidates = textMonth[m[2]] ? [[b, a]] : [[b, a], [a, b]];
  return [...new Set(candidates.flatMap(([mo, d]) => {
    const x = new Date(Date.UTC(y, mo - 1, d));
    return x.getUTCFullYear() === y && x.getUTCMonth() === mo - 1 && x.getUTCDate() === d ? [`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`] : [];
  }))].sort();
}
