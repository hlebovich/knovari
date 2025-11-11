import type { ChangelogItem, ChangelogSlide } from "../../types/changelog.ts";

function isImageRemoveAction(item: ChangelogItem): boolean {
  return item.shapeType === "image" && (item.action === "redact" || item.action === "replace");
}

function isChartImageRemoveAction(item: ChangelogItem): boolean {
  return item.shapeType === "chart" && item.action === "redact";
}

export function getItemsToRemove(changelog: ChangelogSlide[]) {
  const removedItems: ChangelogItem[] = [];

  for (const slide of changelog) {
    for (const item of slide.items) {
      if (item.shapeType === "image" || item.shapeType === "chart") {
        const isRemoveAction = isImageRemoveAction(item) || isChartImageRemoveAction(item);
        if (isRemoveAction && item.isApplied) {
          removedItems.push(item);
        }
      }
    }
  }

  return removedItems;
}
