import type { ChangelogItem } from "../../types/changelog.ts";
import type { EngineContext, TransformResult } from "../../types/engine.ts";
import { formatTransformResult } from "./formatTransformResult.ts";
import { removeMaskForItems } from "./removeMaskForItems.ts";

export async function replaceImage(
  items: ChangelogItem[],
  context: EngineContext
): Promise<TransformResult> {
  const replacementItems = items.map((replacementItem: ChangelogItem) => ({
    shapeId: replacementItem.shapeId,
    slideId: replacementItem.slideId,
    id: replacementItem.id,
    data: {
      resolved: "accepted" as const,
      priority: replacementItem.priority,
      shapeId: replacementItem.userChange,
      text: replacementItem.proposedValue || "[Image was replaced]",
    },
  }));
  const { updatedShapeIds, unprocessedItems } = await context.ppt.addShapeMask(replacementItems);
  const updatedItems = items.map((item, index) => ({
    ...item,
    userChange: updatedShapeIds[index],
  }));
  return formatTransformResult(updatedItems, unprocessedItems);
}

export async function revertImage(
  items: ChangelogItem[],
  context: EngineContext
): Promise<TransformResult> {
  const filteredItems = items.filter((replacementItem) => replacementItem.action !== "skip");
  return removeMaskForItems(filteredItems, context);
}
