export class BoundaryError extends Error {
  code: string;
  status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BoundaryError("INVALID_SHAPE");
  return value as Record<string, unknown>;
}
export function exact(value: unknown, keys: string[]): Record<string, unknown> {
  const result = object(value);
  const actual = Object.keys(result);
  if (
    actual.length !== keys.length ||
    actual.some((key) => !keys.includes(key))
  )
    throw new BoundaryError("INVALID_FIELDS");
  return result;
}
export function boundedText(value: unknown, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw new BoundaryError("INVALID_TEXT");
  return value.trim();
}
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new BoundaryError("INVALID_JSON");
  }
}
export async function readBoundedJson(
  message: Request | Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<unknown> {
  const length = message.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > maxBytes))
    throw new BoundaryError("BODY_TOO_LARGE", 413);
  if (!message.body) throw new BoundaryError("EMPTY_BODY");
  const reader = message.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  const cancel = () => {
    void reader.cancel().catch(() => {});
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    while (true) {
      if (signal.aborted) throw new BoundaryError("TIMEOUT", 504);
      const { done, value } = await reader.read();
      if (signal.aborted) throw new BoundaryError("TIMEOUT", 504);
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new BoundaryError("BODY_TOO_LARGE", 413);
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new BoundaryError("INVALID_ENCODING");
    }
    return parseJson(text);
  } finally {
    signal.removeEventListener("abort", cancel);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
