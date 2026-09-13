// External CSV syntax only. Original annotation validity remains parseAnnotations.
export interface CsvRow { line: number; raw: Record<string, string> }
export function parseCsv(text: string): CsvRow[] {
  const records: { line: number; fields: string[] }[] = [];
  let fields: string[] = [], field = "", quoted = false, closed = false, line = 1, start = 1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; }
      } else { field += ch; if (ch === "\n") line++; }
    } else if (ch === '"') {
      if (field || closed) throw new Error(`CSV quote at line ${line}`);
      quoted = true;
    } else if (ch === ",") { fields.push(field); field = ""; closed = false;
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      fields.push(field); records.push({ line: start, fields }); fields = []; field = ""; closed = false; line++; start = line;
    } else {
      if (closed) throw new Error(`CSV characters after quote at line ${line}`);
      field += ch;
    }
  }
  if (quoted) throw new Error("Unterminated CSV quote");
  if (field || fields.length || closed) records.push({ line: start, fields: [...fields, field] });
  const header = records.shift()?.fields;
  if (!header || !header.length || new Set(header).size !== header.length) throw new Error("Invalid CSV header");
  return records.map(r => {
    if (r.fields.length !== header.length) throw new Error(`CSV column count at line ${r.line}`);
    return { line: r.line, raw: Object.fromEntries(header.map((h, i) => [h, r.fields[i]])) };
  });
}
export function indexBy(rows: CsvRow[], key: string) {
  const index = new Map<string, CsvRow[]>();
  for (const r of rows) index.set(r.raw[key], [...(index.get(r.raw[key]) ?? []), r]);
  return index;
}
