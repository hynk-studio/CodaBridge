import { encodeWav, renderClickSchedule, RENDERER } from "../composer/sound.ts";
import { LAB_LIMITS, validateSegment, type Segment } from "./model.ts";
export function exchangeSchedule(
  segment: Segment,
  start = segment.start,
  end = segment.end,
  muted: string[] = [],
) {
  validateSegment(segment);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < segment.start ||
    end > segment.end + 1e-9 ||
    end <= start ||
    end - start > LAB_LIMITS.segmentSeconds ||
    muted.some((c) => !segment.callers.includes(c))
  )
    throw new Error("Invalid reconstruction window.");
  const events = segment.calls
    .filter((c) => !muted.includes(c.caller))
    .flatMap((c) =>
      c.clicks.map((t, marker) => ({
        seconds: c.onset + t - start + RENDERER.leadSeconds,
        sourceRowId: c.id,
        caller: c.caller,
        marker,
      })),
    )
    .filter(
      (e) =>
        e.seconds >= RENDERER.leadSeconds &&
        e.seconds < end - start + RENDERER.leadSeconds,
    )
    .sort((a, b) => a.seconds - b.seconds);
  if (events.length > LAB_LIMITS.events)
    throw new Error("Reconstruction event limit.");
  let peak = 1,
    left = 0;
  events.forEach((event, i) => {
    while (events[left].seconds < event.seconds - RENDERER.pulseSeconds) left++;
    peak = Math.max(peak, i - left + 1);
  });
  // Both callers combined never exceed the shared renderer single-pulse bound.
  const attenuation = 1 / Math.max(2, peak);
  return {
    events,
    duration: end - start + RENDERER.leadSeconds + RENDERER.tailSeconds,
    attenuation,
    start,
    end,
    identity:
      "Timing reconstruction from research annotations — not the original recording",
  };
}
export function renderExchange(
  segment: Segment,
  start = segment.start,
  end = segment.end,
  muted: string[] = [],
) {
  const schedule = exchangeSchedule(segment, start, end, muted);
  return {
    schedule,
    samples: renderClickSchedule(
      schedule.events,
      schedule.duration,
      schedule.attenuation,
    ),
  };
}
export function exchangeWav(segment: Segment) {
  return encodeWav(
    renderExchange(segment).samples,
    new TextEncoder().encode(
      `Timing reconstruction from research annotations — not the original recording. ${segment.id}. Original annotated timeline; no duration reassignment. Sharma et al.; Dominica Sperm Whale Project. Zenodo 10817697, release sw-combinatoriality, CC BY 4.0. Whale meaning unknown.\0`,
    ),
  );
}
