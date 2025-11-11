import type { ChangelogItem } from "../../types/changelog.ts";
import type { TransformResult } from "../../types/engine.ts";
import type { UnprocessedItem } from "../../types/presentationService.ts";

export function formatTransformResult(
  allItems: ChangelogItem[],
  unprocessed: UnprocessedItem[]
): TransformResult {
  const items: ChangelogItem[] = [];
  const unprocessedItems: ChangelogItem[] = [];

  for (const item of allItems) {
    const unprocessedItem = unprocessed.find((u) => u.itemId === item.id);
    if (unprocessedItem) {
      unprocessedItems.push({
        ...item,
        error: {
          message: unprocessedItem.message,
          error: unprocessedItem.cause,
        },
      });
    } else {
      items.push(item);
    }
  }

  return { items, unprocessedItems };
}
