import manifest from "./native-manifest.json" with { type: "json" };
import { recordings } from "../domain/catalog.ts";
import type { analyzePCM } from "./dsp.ts";
import type { TimingResult } from "../domain/timing.ts";
export interface NativeReport {
  version: string;
  clips: { id: string; original: { sha256: string; sampleRateHz: number }; source: { filename: string; revision: string; url: string; attribution: string }; variants: ({ rate: number; frames: number; detectedSeconds: number[]; countDelta: number; nearestMarkerDisplacementSeconds: (number | null)[]; timing: TimingResult } & ReturnType<typeof analyzePCM>)[] }[];
  rankings: { id: string; rate: number; timing: { id: string; distance: number }[]; spectrum: { id: string; distance: number }[] }[];
  limits: string[];
}
export async function loadNativeReport(signal: AbortSignal): Promise<NativeReport> {
  const response = await fetch(manifest.path, { signal });
  if (!response.ok) throw new Error("Native spectral measurements are unavailable.");
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== manifest.bytes || bytes.byteLength > 512_000) throw new Error("Native spectral report size mismatch.");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  if (hash !== manifest.sha256) throw new Error("Native spectral report checksum mismatch.");
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const report = JSON.parse(new TextDecoder().decode(bytes)) as NativeReport;
  if (report.version !== manifest.version || report.clips.length !== recordings.length || report.clips.some((c, i) => c.id !== recordings[i].id || c.original.sha256 !== recordings[i].audio.sha256)) throw new Error("Native spectral source binding mismatch.");
  return report;
}
