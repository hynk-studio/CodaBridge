// Bounded lexical scan before JSON.parse. Shared scanner; each format supplies
// its own cap. The Exchange v1 decoder keeps its original 512 KiB / depth 12.
export function scanJson(text: string, bytes: number, depth: number, maxNodes = Infinity): unknown {
  if (text.length > bytes || new TextEncoder().encode(text).length > bytes) throw new Error("Coda file exceeds its byte limit.");
  let quoted = false, escaped = false, start = 0, nodes = 0, primitive = false;
  const stack: { object: boolean; key: boolean; keys: Set<string> }[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (!quoted) {
      if (c === '"' || c === "{" || c === "[") nodes++;
      if (!primitive && /[0-9tfn-]/.test(c)) { nodes++; primitive = true; }
      if (/[\s,:[\]{}]/.test(c)) primitive = false;
      if (nodes > maxNodes) throw new Error("Coda structure is too complex.");
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') {
        quoted = false;
        const top = stack.at(-1);
        if (top?.object && top.key) {
          let key: string;
          try { key = JSON.parse(text.slice(start, i + 1)); } catch { throw new Error("Invalid coda JSON."); }
          if (top.keys.has(key)) throw new Error("Duplicate JSON field.");
          top.keys.add(key); top.key = false;
        }
      }
    } else if (c === '"') { quoted = true; start = i; }
    else if (c === "{" || c === "[") {
      stack.push({ object: c === "{", key: c === "{", keys: new Set() });
      if (stack.length > depth) throw new Error("Coda nesting is too deep.");
    } else if (c === "}" || c === "]") stack.pop();
    else if (c === "," && stack.at(-1)?.object) stack.at(-1)!.key = true;
  }
  try { return JSON.parse(text); } catch { throw new Error("Invalid coda JSON."); }
}
