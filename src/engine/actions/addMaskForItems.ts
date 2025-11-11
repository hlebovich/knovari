import type { ChangelogItem } from "../../types/changelog.ts";
import type { EngineContext, TransformResult } from "../../types/engine.ts";
import { formatTransformResult } from "./formatTransformResult.ts";

export async function addMaskForItems(
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
      text: "[Redacted]",
    },
  }));

  const { updatedShapeIds, unprocessedItems } = await context.ppt.addShapeMask(replacementItems);
  const updatedItems = items.map((item, index) => ({
    ...item,
    userChange: updatedShapeIds[index],
  }));
  return formatTransformResult(updatedItems, unprocessedItems);
}
