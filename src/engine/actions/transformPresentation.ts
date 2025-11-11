import type { ChangelogItem, ShapeType } from "../../types/changelog.ts";
import type {
  EngineContext,
  TransformAction,
  TransformFn,
  TransformResult,
  TransformSet,
} from "../../types/engine.ts";
import { groupByShapeType } from "./groupByShapeType.ts";
import { addMaskForItems } from "./addMaskForItems.ts";
import { replaceChart, revertChart } from "./transformChart.ts";
import { replaceImage, revertImage } from "./transformImage.ts";
import { redactTable, replaceTable, revertTable } from "./transformTable.ts";
import { redactText, replaceText, revertText } from "./transformText.ts";

const emptyTransform: TransformFn = async (items: ChangelogItem[], context: EngineContext) => {
  context.logger.log(
    `No transformation implemented yet for items of shapeType=${items[0].shapeType} with action=${items[0].action}`
  );
  return Promise.resolve({ items, unprocessedItems: [] });
};

const unsupportedTransform: TransformFn = async (
  items: ChangelogItem[],
  context: EngineContext
) => {
  context.logger.warn(
    `${items[0].action} transformation for ${items[0].shapeType} is not supported`
  );
  return Promise.resolve({ items, unprocessedItems: [] });
};

const skipTransform: TransformFn = async (items: ChangelogItem[]) => {
  return Promise.resolve({ items, unprocessedItems: [] });
};

const TRANSFORM_SET_BY_SHAPE_TYPE: Record<ShapeType, TransformSet> = {
  text: {
    redact: redactText,
    replace: replaceText,
    obfuscate: replaceText,
    skip: skipTransform,
    revert: revertText,
  },
  image: {
    redact: addMaskForItems,
    replace: replaceImage,
    obfuscate: unsupportedTransform,
    skip: skipTransform,
    revert: revertImage,
  },
  chart: {
    redact: addMaskForItems,
    replace: replaceChart,
    obfuscate: emptyTransform,
    skip: skipTransform,
    revert: revertChart,
  },
  table: {
    redact: redactTable,
    replace: replaceTable,
    obfuscate: replaceTable,
    skip: skipTransform,
    revert: revertTable,
  },
  unknown: {
    redact: unsupportedTransform,
    replace: unsupportedTransform,
    obfuscate: unsupportedTransform,
    skip: skipTransform,
    revert: unsupportedTransform,
  },
};

export async function transformPresentation(
  items: ChangelogItem[],
  action: TransformAction,
  context: EngineContext
): Promise<TransformResult> {
  const { table, text, image, chart } = groupByShapeType(items);
  const aggregatedItems = [];
  const aggregatedUnprocessedItems = [];
  const updatedSlideIds: { initialId: string; updatedId: string }[] = [];

  if (text.length > 0) {
    const transform = TRANSFORM_SET_BY_SHAPE_TYPE.text[action] || unsupportedTransform;
    const { items: updatedItems, unprocessedItems } = await transform(text, context);
    aggregatedItems.push(...updatedItems);
    aggregatedUnprocessedItems.push(...unprocessedItems);
  }

  if (table.length > 0) {
    const transform = TRANSFORM_SET_BY_SHAPE_TYPE.table[action] || unsupportedTransform;
    const { items: updatedItems, unprocessedItems } = await transform(table, context);
    aggregatedItems.push(...updatedItems);
    aggregatedUnprocessedItems.push(...unprocessedItems);
  }

  if (image.length > 0) {
    const transform = TRANSFORM_SET_BY_SHAPE_TYPE.image[action] || unsupportedTransform;
    const { items: updatedItems, unprocessedItems } = await transform(image, context);
    aggregatedItems.push(...updatedItems);
    aggregatedUnprocessedItems.push(...unprocessedItems);
  }

  if (chart.length > 0) {
    const transform = TRANSFORM_SET_BY_SHAPE_TYPE.chart[action] || unsupportedTransform;
    const {
      items: updatedItems,
      unprocessedItems,
      updatedSlideIds: slideIds,
    } = await transform(chart, context);
    aggregatedItems.push(...updatedItems);
    aggregatedUnprocessedItems.push(...unprocessedItems);
    updatedSlideIds.push(...(slideIds || []));
  }

  return { items: aggregatedItems, unprocessedItems: aggregatedUnprocessedItems, updatedSlideIds };
}
