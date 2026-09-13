import {
  contextSegment,
  contextSource,
  DATASET_ID,
  labBinding,
} from "./catalog.ts";
import { comparePairing, LAB_LIMITATIONS, LAB_LIMITS } from "./model.ts";
import type { LabResult } from "./contract.ts";
import { pairingFinding, scoreMaximum, scoreRows } from "./presentation.ts";
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
  canvas.height = 6000;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error("Image export is unavailable. JSON remains available.");
  ctx.fillStyle = "#0c1b23";
  ctx.fillRect(0, 0, 1200, 6000);
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
  const c = packet.comparison;
  const val = (n: number | null) => n === null ? "Unavailable" : `${n.toFixed(3)} s`;
  text("CODABRIDGE / CONTEXT LAB", 28, "#c4eb91");
  text("Does the pairing matter?", 56, "#ffffff");
  text(packet.question, 30);
  text(pairingFinding(c), 34, "#c4eb91");
  text(`Observed ${val(c.observed.valueSeconds)}  /  ${c.selected.offset === 0 ? "Original pairing" : `Control ${c.selected.offset}`} ${val(c.selected.valueSeconds)}`, 32);
  text("Mean call-duration difference (seconds) · lower is closer", 28);
  const left = 310, right = 1030, maximum = scoreMaximum(c);
  ctx.font = "26px sans-serif";
  ctx.fillStyle = "#b7c8ce";
  for (const fraction of [0, 0.5, 1]) {
    ctx.fillText((maximum * fraction).toFixed(2), left + fraction * (right - left) - 20, y);
  }
  y += 42;
  for (const row of scoreRows(c)) {
    ctx.strokeStyle = "#49636d";
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke();
    ctx.font = "28px sans-serif";
    ctx.fillStyle = row.offset === 0 ? "#c4eb91" : "#eaf1f3";
    ctx.fillText(row.label + (row.offset === c.selected.offset ? " *" : ""), 70, y + 9);
    ctx.fillText(row.value === null ? "—" : row.value.toFixed(3), 1050, y + 9);
    if (row.value !== null) {
      const x = left + row.value / maximum * (right - left);
      ctx.fillStyle = row.offset === 0 ? "#c4eb91" : "#a2c4ff";
      ctx.beginPath();
      if (row.offset === 0) { ctx.moveTo(x, y - 10); ctx.lineTo(x + 10, y); ctx.lineTo(x, y + 10); ctx.lineTo(x - 10, y); ctx.closePath(); }
      else ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    y += 44;
  }
  y += 12;
  text(`* Selected pairing · ${c.pairCount} fixed pairs over the full 60-second segment.`, 27);
  if (c.reason) text(`Insufficient data: ${c.reason}`, 28);
  text("B durations are reassigned for calculation. Original calls, pair slots and timeline stay fixed.", 28);
  text("Duration difference is not response latency. This descriptive control establishes no probability, causality or whale meaning.", 28, "#facaa3");
  text("Research annotations · the app’s audio is a timing reconstruction, not an original recording. This card is an image.", 27);
  text(
    packet.generated
      ? `${packet.generated.execution === "mock-transport-test" ? "TEST ONLY provider fixture. " : ""}Exact generated answer accompanies the JSON; interpretation is unverified.`
      : "Computed locally. No generated interpretation included.",
    27,
  );
  text(`Source: Sharma et al. / Dominica Sperm Whale Project · CC BY 4.0. DOI ${contextSource.doi}.`, 27, "#b7c8ce");
  text("Keep the companion JSON for full precision, original source rows, all mappings, methods and any exact model text. Saved evidence is historical.", 26, "#b7c8ce");
  if (y > canvas.height - 35) throw new Error("This question is too long for the card. Save the full investigation JSON.");
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
