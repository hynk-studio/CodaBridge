import { recordings } from "../domain/catalog.ts";
import { compareBlock } from "./analysis.ts";
import {
  COMPOSER_LIMITS,
  CREATION_IDENTITY,
  CREATION_LIMITATIONS,
  fields,
  parseBlock,
  parseDraft,
  type Block,
  type Draft,
} from "./model.ts";
import { eventSchedule } from "./sound.ts";

export const STORAGE_KEY = "codabridge-composer-v1";
export interface Project {
  format: "codabridge-project";
  version: 1;
  draft: Draft | null;
  activeId: string | null;
  codebook: Block[];
  savedAnalysis: unknown | null;
  credits: unknown;
}
function validateSavedAnalysis(value: unknown) {
  // Byte bounds alone do not prevent deeply nested inert JSON from exhausting
  // a renderer/stringifier. This is data validation, never execution or revival.
  const queue = [{ value, depth: 0 }];
  let nodes = 0;
  while (queue.length) {
    const item = queue.pop()!;
    if (++nodes > 8192 || item.depth > 16)
      throw new Error("Saved analysis is too complex.");
    if (item.value === null) continue;
    if (typeof item.value === "string") {
      if (item.value.length > 16000)
        throw new Error("Saved analysis text is too long.");
    } else if (typeof item.value === "number") {
      if (!Number.isFinite(item.value))
        throw new Error("Invalid saved analysis number.");
    } else if (typeof item.value === "object") {
      // Repeated references to immutable metric/source objects are legitimate.
      // Cycles still exceed the finite traversal depth/node bounds.
      for (const child of Object.values(item.value))
        queue.push({ value: child, depth: item.depth + 1 });
    } else if (typeof item.value !== "boolean")
      throw new Error("Invalid saved analysis.");
  }
}
export function projectJson(
  draft: Draft | null,
  codebook: Block[],
  savedAnalysis: unknown = null,
  activeId: string | null = draft?.blocks[0].id ?? null,
): string {
  validateSavedAnalysis(savedAnalysis);
  const project: Project = {
    format: "codabridge-project",
    version: 1,
    draft: draft ? parseDraft(draft) : null,
    activeId,
    codebook: codebook.map(parseBlock),
    savedAnalysis,
    credits: {
      identity: CREATION_IDENTITY,
      meaningToSpermWhales: "unknown",
      sources: draft ? sourceCredits(draft) : [],
      limitations: CREATION_LIMITATIONS,
    },
  };
  const json = JSON.stringify(project, null, 2);
  parseProject(json);
  return json;
}
export function parseProject(json: string): Project {
  if (new TextEncoder().encode(json).length > COMPOSER_LIMITS.projectBytes)
    throw new Error("Project exceeds 128 KiB.");
  const v = fields(JSON.parse(json), [
    "format",
    "version",
    "draft",
    "activeId",
    "codebook",
    "savedAnalysis",
    "credits",
  ]);
  if (
    v.format !== "codabridge-project" ||
    v.version !== 1 ||
    !Array.isArray(v.codebook) ||
    v.codebook.length > COMPOSER_LIMITS.codebook
  )
    throw new Error("Unsupported project or codebook size.");
  // Saved analysis is inert JSON, never a current result, proposal, source or receipt.
  // No import-supplied URI is read. Known source IDs resolve to the local catalog.
  const draft = v.draft === null ? null : parseDraft(v.draft);
  if (
    draft ? !draft.blocks.some((b) => b.id === v.activeId) : v.activeId !== null
  )
    throw new Error("Invalid saved block selection.");
  const codebook = v.codebook.map(parseBlock);
  validateSavedAnalysis(v.savedAnalysis);
  if (new Set(codebook.map((b) => b.id)).size !== codebook.length)
    throw new Error("Duplicate saved block IDs.");
  return {
    format: "codabridge-project",
    version: 1,
    draft,
    activeId: v.activeId as string | null,
    codebook,
    savedAnalysis: v.savedAnalysis,
    // Imported credit/provenance prose is not trusted. Rebuild from pinned sources.
    credits: {
      identity: CREATION_IDENTITY,
      meaningToSpermWhales: "unknown",
      sources: draft ? sourceCredits(draft) : [],
      limitations: CREATION_LIMITATIONS,
    },
  };
}
export function sourceCredits(draft: Draft) {
  return draft.ancestry.map((ref) => {
    const r = recordings.find((r) => r.id === ref.recordingId)!;
    return {
      id: r.id,
      ...r.source,
      originalOffsetSeconds: ref.originalOffsetSeconds,
      originalTimes: [...r.annotation.clickTimesSeconds],
      annotationStatus: r.annotation.status,
      humanReview: r.annotation.humanReview,
    };
  });
}
export function creationEvidence(draft: Draft, activeId: string) {
  return {
    identity: CREATION_IDENTITY,
    meaningToSpermWhales: "unknown",
    sourceLinkIsNotAuthenticatedEditHistory: true,
    draft,
    schedule: eventSchedule(draft),
    analysis: compareBlock(draft, activeId),
    sources: sourceCredits(draft),
    limitations: CREATION_LIMITATIONS,
  };
}
export function deliver(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const fileStem = (draft: Draft) =>
  `codabridge-synthetic-timing-r${draft.revision}`;

export async function cardImage(draft: Draft, activeId: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 2400;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error(
      "Card image rendering is unavailable. Project and WAV saving still work.",
    );
  ctx.fillStyle = "#0c1b23";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let y = 65;
  function line(value: string, size = 25, color = "#eaf1f3") {
    ctx!.font = `${size}px sans-serif`;
    ctx!.fillStyle = color;
    // Character wrapping also bounds unbroken imported strings; text is never markup.
    let row = "";
    for (const character of value) {
      if (
        ctx!.measureText(row + character).width > 1060 ||
        character === "\n"
      ) {
        ctx!.fillText(row, 70, y);
        y += size * 1.35;
        row = "";
      }
      if (character !== "\n") row += character;
    }
    ctx!.fillText(row, 70, y);
    y += size * 1.45;
  }
  line("CodaBridge / CODA CARD", 26, "#c4eb91");
  y += 18;
  line(draft.title || "Untitled coda", 48);
  line(CREATION_IDENTITY, 25, "#c4eb91");
  line(
    `Revision ${draft.revision} · ${draft.blocks.length} blocks · ${eventSchedule(draft).duration.toFixed(3)} s WAV`,
    23,
    "#a4b7bf",
  );
  if (draft.intention) line(`Creator intention: ${draft.intention}`, 24);
  y += 15;
  for (const [index, block] of draft.blocks.entries()) {
    line(
      `BLOCK ${index + 1} · ${block.seed.recordingId} timing seed`,
      22,
      "#a4b7bf",
    );
    ctx.strokeStyle = "#30444f";
    ctx.beginPath();
    ctx.moveTo(70, y + 15);
    ctx.lineTo(1120, y + 15);
    ctx.stroke();
    const duration = block.times.at(-1)!;
    for (const t of block.times) {
      ctx.fillStyle = "#c4eb91";
      ctx.beginPath();
      ctx.arc(80 + (t / duration) * 1020, y + 15, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    y += 50;
    line(
      `Span ${duration.toFixed(3)} s${index < draft.blocks.length - 1 ? ` · space after ${block.spacingAfter.toFixed(3)} s` : ""}`,
      21,
    );
    if (block.meaning) line(`Creator-assigned meaning: ${block.meaning}`, 22);
  }
  y += 12;
  const comparison = compareBlock(draft, activeId),
    seed = comparison.seed.comparison;
  line(
    `Active block / seed MAD: ${seed.status === "comparable" ? seed.value.toFixed(6) : "not comparable"}`,
    23,
  );
  line(
    `Seed span ${comparison.seed.spanSeconds.toFixed(3)} s → draft ${comparison.seed.currentSpanSeconds.toFixed(3)} s. ${comparison.eligibleCount} eligible other examples.`,
    22,
  );
  line(
    "Normalized interval MAD v1.0.0 / limited four-recording catalog",
    20,
    "#a4b7bf",
  );
  line(
    `Timing source: DSWP (${draft.ancestry.map((s) => s.recordingId).join(", ")}), CC BY 4.0.`,
    21,
  );
  // Exact credits and original offsets also live in the companion project evidence.
  for (const credit of new Set(sourceCredits(draft).map((s) => s.attribution)))
    line(credit, 20, "#a4b7bf");
  line(
    "Meaning to sperm whales: unknown. Personal labels are not translation.",
    22,
    "#c4eb91",
  );
  line(
    "Estimated seed markers; coda boundaries unverified. Timing is not intent or identity.",
    20,
    "#a4b7bf",
  );
  line(
    "This image is not playable. Keep its synthetic WAV + re-openable project JSON.",
    20,
    "#a4b7bf",
  );
  // Bounded text fits this working canvas; crop to the actual content height.
  if (y > canvas.height - 35)
    throw new Error(
      "This card's text is too long for the image. Shorten labels or save the complete project JSON.",
    );
  const cropped = document.createElement("canvas");
  cropped.width = canvas.width;
  cropped.height = Math.ceil(y + 40);
  const croppedContext = cropped.getContext("2d");
  if (!croppedContext) throw new Error("Card image rendering unavailable.");
  croppedContext.drawImage(canvas, 0, 0);
  return new Promise((resolve, reject) =>
    cropped.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Card image could not be saved.")),
      "image/png",
    ),
  );
}
