import {
  contextSegment,
  contextSource,
  DATASET_ID,
  labBinding,
} from "./catalog.ts";
import { comparePairing, LAB_LIMITATIONS, LAB_LIMITS } from "./model.ts";
import type { LabResult } from "./contract.ts";
export function investigationPacket(
  question: string,
  offset: number,
  selectedRowId: string,
  generated: LabResult | null,
) {
  if (
    question.length > 800 ||
    !contextSegment.calls.some((c) => c.id === selectedRowId)
  )
    throw new Error("Invalid investigation state.");
  const binding = labBinding(offset, selectedRowId);
  if (generated && generated.binding !== binding)
    throw new Error("Obsolete interpretation cannot be saved as current.");
  const packet = {
    format: "codabridge-context-investigation",
    version: 1,
    savedAnalysisStatus: "Historical snapshot — not a fresh live run on reopen",
    identity:
      "Source research annotations; audio is synthetic timing reconstruction, not an original recording",
    datasetId: DATASET_ID,
    source: contextSource,
    segment: contextSegment,
    question,
    selection: { offset, selectedRowId, binding },
    comparison: comparePairing(contextSegment, offset),
    generated,
    limitations: LAB_LIMITATIONS,
  };
  const json = JSON.stringify(packet, null, 2);
  if (new TextEncoder().encode(json).length > LAB_LIMITS.packetBytes)
    throw new Error("Investigation exceeds the 128 KiB export limit.");
  return packet;
}
export async function investigationCard(
  packet: ReturnType<typeof investigationPacket>,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 3200;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error("Image export is unavailable. JSON remains available.");
  ctx.fillStyle = "#0c1b23";
  ctx.fillRect(0, 0, 1200, 3200);
  let y = 70;
  function text(value: string, size = 27, color = "#dce8e8") {
    ctx!.font = `${size}px sans-serif`;
    ctx!.fillStyle = color;
    let line = "";
    // Plain text, word-wrapped; oversized individual tokens still wrap safely.
    const flush = () => {
      if (line) ctx!.fillText(line, 70, y);
      y += size * 1.4;
      line = "";
    };
    for (const word of value.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx!.measureText(candidate).width <= 1060) {
        line = candidate;
        continue;
      }
      if (line) flush();
      for (const ch of word) {
        if (ctx!.measureText(line + ch).width > 1060) flush();
        line += ch;
      }
    }
    if (line) {
      ctx!.fillText(line, 70, y);
      y += size * 1.4;
    }
    y += 16;
  }
  const c = packet.comparison,
    s = contextSegment,
    val = (n: number | null) =>
      n === null ? "Unavailable" : `${n.toFixed(6)} s`;
  text("CODABRIDGE / CONTEXT LAB", 23, "#d6f699");
  text("Does the pairing matter?", 52, "#ffffff");
  text(packet.question, 28);
  text(
    `Observed: ${val(c.observed.valueSeconds)}   |   ${c.selected.offset === 0 ? "Observed reset" : `Control ${c.selected.offset}`}: ${val(c.selected.valueSeconds)}`,
    32,
    "#d6f699",
  );
  text(
    `${c.pairCount} fixed overlap pairs · ${c.uniqueCallCount} unique calls · ${c.distinctControlCount} distinct nonzero controls`,
  );
  if (c.controlSummary)
    text(
      `Control range ${val(c.controlSummary.minSeconds)} – ${val(c.controlSummary.maxSeconds)}; median ${val(c.controlSummary.medianSeconds)}.`,
    );
  if (c.reason) text(`Insufficient control data: ${c.reason}`);
  text(
    `${s.rec} · ${s.start.toFixed(4)}–${s.end.toFixed(4)} seconds from source file start. A/B are local labels ${s.callers.join(" / ")}.`,
    24,
  );
  text(
    "Measured durations, reassigned over fixed pair slots. The original timeline stays unchanged. Unequal click counts are allowed for duration; this is not normalized-rhythm matching.",
    27,
  );
  text(
    "Timing reconstruction from research annotations — not original audio. This image is not playable. Exact rows, mappings and evidence accompany the JSON.",
    25,
    "#facaa3",
  );
  text(
    packet.generated
      ? `${packet.generated.execution === "mock-transport-test" ? "TEST ONLY provider fixture. " : ""}Generated interpretation is unverified and retained in the accompanying JSON.`
      : "No generated interpretation is included.",
    25,
  );
  if (packet.generated) {
    text("Generated interpretation · unverified", 30, "#ffffff");
    text(packet.generated.explanation.possibleInterpretations[0].text, 24);
    text(
      "First interpretation item shown verbatim. Complete answer and citations are in the accompanying JSON.",
      21,
    );
  }
  text("Limits of this comparison", 30, "#ffffff");
  LAB_LIMITATIONS.slice(1).forEach((v) => text(v, 23));
  text(
    `Source: ${contextSource.attribution} CC BY 4.0. DOI ${contextSource.doi}; release ${contextSource.version}.`,
    22,
  );
  text(
    `Method ${c.method}. Saved investigation is historical, not a new live run.`,
    22,
  );
  const cropped = document.createElement("canvas");
  cropped.width = canvas.width;
  cropped.height = Math.ceil(y + 35);
  const target = cropped.getContext("2d");
  if (!target) throw new Error("Image export is unavailable.");
  target.drawImage(canvas, 0, 0);
  return new Promise((resolve, reject) =>
    cropped.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Image export failed.")),
      "image/png",
    ),
  );
}
