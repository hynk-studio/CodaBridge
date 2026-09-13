import { renderClickSchedule, RENDERER } from "../composer/sound.ts";
import { ATLAS_METHOD } from "./method.ts";
import { validateRecord } from "./load.ts";
import type { AtlasRecord } from "./model.ts";

export function annotationSchedule(record: AtlasRecord) {
  validateRecord(record);
  if (record.duration > ATLAS_METHOD.annotationSchedule.maximumSpanSeconds) throw new Error("This whole annotation exceeds the audio duration bound; visual timing and downloads remain available.");
  const events = record.clicks.map((seconds, marker) => ({ seconds: seconds + RENDERER.leadSeconds, marker, sourceRowId: record.id }));
  let left = 0, peak = 1;
  events.forEach((e, i) => {
    while (events[left].seconds < e.seconds - RENDERER.pulseSeconds) left++;
    peak = Math.max(peak, i - left + 1);
  });
  return { identity: "Synthetic timing reconstruction, not original audio", sourceRowId: record.id, events,
    duration: record.duration + RENDERER.leadSeconds + RENDERER.tailSeconds, attenuation: 1 / Math.max(2, peak), renderer: RENDERER };
}
export function renderAnnotation(record: AtlasRecord) {
  const schedule = annotationSchedule(record);
  return { schedule, samples: renderClickSchedule(schedule.events, schedule.duration, schedule.attenuation) };
}
