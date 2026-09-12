import { compareTiming } from "../domain/timing.ts";
import {
  applyOperations,
  blockTiming,
  COMPOSER_LIMITS,
  span,
  type Block,
  type Draft,
  type Operation,
} from "./model.ts";

const compact = (n: number) => Number(n.toFixed(3)).toString();

export function durationHint(factor: number): string {
  if (
    !Number.isFinite(factor) ||
    factor < COMPOSER_LIMITS.scaleMin ||
    factor > COMPOSER_LIMITS.scaleMax
  )
    return `Choose a duration multiplier from ${COMPOSER_LIMITS.scaleMin} to ${COMPOSER_LIMITS.scaleMax}.`;
  return `×${factor} multiplies every gap by ${factor}. ${factor === 1 ? "This would leave timing unchanged." : "Normalized spacing stays the same."}`;
}

export function timingChange(before: Block, after: Block): string {
  const comparison = compareTiming(blockTiming(before), blockTiming(after));
  if (comparison.status !== "comparable")
    return "Different marker counts: this metric cannot compare the spacing. No alignment or padding.";
  const sameSpacing = comparison.value < 1e-12;
  const sameDuration = Math.abs(span(before) - span(after)) < 1e-12;
  if (sameSpacing && sameDuration) return "The timing is unchanged.";
  if (sameSpacing)
    return `Every gap is ×${compact(span(after) / span(before))} as long. The block is ${span(after) > span(before) ? "longer" : "shorter"}; relative spacing is unchanged.`;
  return `The gaps have different proportions now.${sameDuration ? " Total duration is unchanged." : ` The block is ${span(after) > span(before) ? "longer" : "shorter"}.`}`;
}

// Labels follow stable identities through the batch. Positions describe each
// step, including blocks absent from the original or final phrase.
export function operationLabels(
  draft: Draft,
  operations: Operation[],
): string[] {
  applyOperations(draft, operations); // Only describe a fully valid atomic batch.
  const ids = draft.blocks.map((b) => b.id);
  const names = new Map(ids.map((id, i) => [id, `Block ${i + 1}`]));
  let nextNumber = ids.length + 1;
  return operations.map((op) => {
    if (op.op === "add_seed") {
      const name = `New block ${nextNumber++}`;
      names.set(op.newBlockId, name);
      ids.push(op.newBlockId);
      return `Add ${name} from ${op.sourceId} at position ${ids.length}.`;
    }
    const index = ids.indexOf(op.blockId),
      name = names.get(op.blockId)!;
    const at = `${name} (position ${index + 1})`;
    switch (op.op) {
      case "duplicate_block": {
        const copy = `New block ${nextNumber++}`;
        names.set(op.newBlockId, copy);
        ids.splice(index + 1, 0, op.newBlockId);
        return `Duplicate ${at} → ${copy} at position ${index + 2}.`;
      }
      case "move_block":
        ids.splice(index, 1);
        ids.splice(op.toIndex, 0, op.blockId);
        return `Move ${name} from position ${index + 1} → ${op.toIndex + 1}.`;
      case "remove_block":
        ids.splice(index, 1);
        return `Remove ${name} from position ${index + 1}.`;
      case "scale_duration":
        return `Scale ${at} ×${op.factor}.`;
      case "set_gap":
        return `Set ${at}, gap ${op.gapIndex + 1} → ${op.gapIndex + 2}, to ${op.seconds} s.`;
      case "set_spacing":
        return `Set the space after ${at} to ${op.seconds} s.`;
    }
  });
}
