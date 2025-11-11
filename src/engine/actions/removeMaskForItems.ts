import type { ChangelogItem } from "../../types/changelog.ts";
import type { EngineContext, TransformResult } from "../../types/engine.ts";
import { formatTransformResult } from "./formatTransformResult.ts";

export async function removeMaskForItems(
  items: ChangelogItem[],
  context: EngineContext
): Promise<TransformResult> {
  const replacementItems = items.map((replacementItem: ChangelogItem) => {
    return {
      shapeId: replacementItem.shapeId,
      slideId: replacementItem.slideId,
      id: replacementItem.id,
      data: {
        resolved: null,
        priority: replacementItem.priority,
        shapeId: replacementItem.userChange,
        initialShapeId: replacementItem.shapeId,
      },
    };
  });

  const { unprocessedItems } = await context.ppt.removeShapes(replacementItems);
  const updatedItems = items.map((item) => ({ ...item, userChange: null }));
  return formatTransformResult(updatedItems, unprocessedItems);
}
