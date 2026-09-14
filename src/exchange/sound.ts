import { encodeWav, renderClickSchedule, RENDERER } from "../composer/sound.ts";
import { parsePayload, phraseSpan, type Envelope, type Phrase, type Source } from "./model.ts";

export function schedulePhrases(items: { id: string; role: string; phrase: Phrase }[], gaps: number[]) {
  let offset = RENDERER.leadSeconds;
  const events: { turnId: string; blockId: string; marker: number; seconds: number }[] = [];
  const ranges: { id: string; role: string; start: number; end: number }[] = [];
  for (const [i, item] of items.entries()) {
    const start = offset;
    for (const [j, b] of item.phrase.blocks.entries()) {
      b.times.forEach((t, marker) => events.push({ turnId: item.id, blockId: b.id, marker, seconds: offset + t }));
      offset += b.times.at(-1)! + (j < item.phrase.blocks.length - 1 ? b.spacingAfter : 0);
    }
    ranges.push({ id: item.id, role: item.role, start, end: offset });
    offset += gaps[i] ?? 0;
  }
  const span = items.reduce((sum, t, i) => sum + phraseSpan(t.phrase) + (gaps[i] ?? 0), 0);
  if (!Number.isFinite(span) || span > 120 || !events.length || events.length > 384) throw new Error("Exchange audio exceeds its bounds.");
  return { events, ranges, span, duration: offset + RENDERER.tailSeconds, renderer: RENDERER };
}
export function exchangeSchedule(envelope: Envelope) {
  const { digest: _digest, ...payload } = envelope;
  const valid = parsePayload(payload);
  return schedulePhrases(valid.turns, valid.arrangement.gaps);
}
export function exchangeWav(envelope: Envelope) {
  const schedule = exchangeSchedule(envelope);
  const sources = new Map<string, Source>();
  for (const turn of envelope.turns) for (const b of turn.phrase.blocks) sources.set(b.source.recordingId, b.source);
  const metadata = new TextEncoder().encode(JSON.stringify({
    identity: "Human-created synthetic timing. Animal meaning unknown. Audio does not encode the human message.",
    renderer: RENDERER, sources: [...sources.values()].sort((a, b) => a.recordingId.localeCompare(b.recordingId)),
  }) + "\0");
  if (metadata.length > 8192) throw new Error("Required WAV attribution exceeds its bound; JSON remains available.");
  return encodeWav(renderClickSchedule(schedule.events, schedule.duration), metadata);
}
