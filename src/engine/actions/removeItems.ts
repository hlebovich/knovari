import type { ChangelogItem } from "../../types/changelog.ts";
import type { EngineContext, TransformResult } from "../../types/engine.ts";
import { formatTransformResult } from "./formatTransformResult.ts";

export async function removeItems(
  items: ChangelogItem[],
  context: EngineContext
): Promise<TransformResult> {
  const replacementItems = items.map((replacementItem: ChangelogItem) => {
    return {
      shapeId: replacementItem.shapeId,
      slideId: replacementItem.slideId,
      id: replacementItem.id,
      data: {
        resolved: "accepted" as const,
        priority: replacementItem.priority,
        shapeId: null,
      },
    };
  });

  const { unprocessedItems } = await context.ppt.removeShapes(replacementItems, false);
  return formatTransformResult(items, unprocessedItems);
}
