import type { ChangelogItem, ShapeType } from "../../types/changelog.ts";

export function groupByShapeType(items: ChangelogItem[]): Record<ShapeType, ChangelogItem[]> {
  const textItems: ChangelogItem[] = [];
  const imageItems: ChangelogItem[] = [];
  const tableItems: ChangelogItem[] = [];
  const chartItems: ChangelogItem[] = [];
  const unknownItems: ChangelogItem[] = [];

  for (const item of items) {
    if (item.shapeType === "text") {
      textItems.push(item);
      continue;
    }
    if (item.shapeType === "image") {
      imageItems.push(item);
      continue;
    }

    if (item.shapeType === "table") {
      tableItems.push(item);
      continue;
    }

    if (item.shapeType === "chart") {
      chartItems.push(item);
      continue;
    }

    unknownItems.push(item);
  }

  return {
    text: textItems,
    image: imageItems,
    table: tableItems,
    chart: chartItems,
    unknown: unknownItems,
  };
}
