import type { ChangelogItem } from "../../types/changelog.ts";
import type { EngineContext, TransformResult, UpdatedSlideIdItem } from "../../types/engine.ts";
import { removeMaskForItems } from "./removeMaskForItems.ts";

async function convertToBase64(response: Response): Promise<string> {
  const arrayBuf = await response.arrayBuffer();

  const bytes = new Uint8Array(arrayBuf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }

  return btoa(binary);
}

function buildErrorItem(
  item: ChangelogItem,
  error: unknown,
  errorMessage: string = "Failed to process chart"
): ChangelogItem {
  const normalizedError =
    error instanceof Error
      ? error
      : new Error(typeof error === "object" ? JSON.stringify(error) : String(error));

  return {
    ...item,
    error: {
      message: errorMessage,
      error: new Error(
        `${errorMessage}: id=${item.id}, slideId=${item.slideId}, shapeId=${item.shapeId}`,
        { cause: normalizedError }
      ),
    },
  };
}

async function transformChart(
  items: ChangelogItem[],
  operation: "apply" | "revert",
  context: EngineContext
): Promise<TransformResult> {
  try {
    const taskId = await context.store.getState().taskId;
    if (!taskId) {
      return { unprocessedItems: items, items: [] };
    }

    const updatedItems: ChangelogItem[] = [];
    const unprocessedItems: ChangelogItem[] = [];
    const slidesData: { file: File; item: ChangelogItem }[] = [];
    const updatedSlideIds: UpdatedSlideIdItem[] = [];

    for (const item of items) {
      try {
        const slideData = await context.ppt.getSlideData(item.slideId);
        if (!slideData) {
          unprocessedItems.push(
            buildErrorItem(item, new Error(`Slide data not found for slideId`))
          );
          continue;
        }
        slidesData.push({ file: slideData, item });
      } catch (error) {
        unprocessedItems.push(buildErrorItem(item, error, "Could not get slide data"));
      }
    }

    const updatedSlidesData: { slideBase64: string; item: ChangelogItem }[] = [];

    await Promise.allSettled(
      slidesData.map(async ({ file, item }) => {
        return await context.api.api.updateContent(taskId, { change_id: item.id, operation }, file);
      })
    ).then(async (results) => {
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const item = slidesData[i].item;

        if (result.status === "fulfilled") {
          try {
            const slideBase64 = await convertToBase64(result.value);
            updatedSlidesData.push({ slideBase64, item });
          } catch (error) {
            unprocessedItems.push(
              buildErrorItem(item, error, "Could not convert slide data to base64")
            );
          }
        } else {
          unprocessedItems.push(buildErrorItem(item, result.reason));
        }
      }
    });

    for (const updatedSlide of updatedSlidesData) {
      const { item, slideBase64 } = updatedSlide;
      try {
        const updatedSlideId = await context.ppt.replaceSlide(item.slideId, slideBase64);
        updatedSlideIds.push({ initialId: item.slideId, updatedId: updatedSlideId });
        updatedItems.push(item);
      } catch (error) {
        unprocessedItems.push(buildErrorItem(item, error, "Could not replace data for slide"));
      }
    }

    return {
      items: updatedItems,
      unprocessedItems,
      updatedSlideIds,
    };
  } catch (error) {
    return {
      unprocessedItems: items.map((item) => buildErrorItem(item, error)),
      items: [],
    };
  }
}

export async function replaceChart(items: ChangelogItem[], context: EngineContext) {
  return transformChart(items, "apply", context);
}

export async function revertChart(items: ChangelogItem[], context: EngineContext) {
  const redactedItems: ChangelogItem[] = [];
  const replacedItems: ChangelogItem[] = [];
  const skippedItems: ChangelogItem[] = [];
  const result: TransformResult = {
    items: [],
    unprocessedItems: [],
    updatedSlideIds: [],
  };

  for (const item of items) {
    if (item.action === "redact") {
      redactedItems.push(item);
      continue;
    }

    if (item.action === "replace") {
      replacedItems.push(item);
      continue;
    }

    if (item.action === "skip") {
      skippedItems.push(item);
    }
  }

  if (redactedItems.length > 0) {
    const redactResult = await removeMaskForItems(redactedItems, context);
    result.items.push(...redactResult.items);
    result.unprocessedItems.push(...redactResult.unprocessedItems);
  }

  if (replacedItems.length > 0) {
    const replacedResult = await transformChart(replacedItems, "revert", context);
    result.items.push(...replacedResult.items);
    result.unprocessedItems.push(...replacedResult.unprocessedItems);
    if (!result.updatedSlideIds) {
      result.updatedSlideIds = [];
    }
    result.updatedSlideIds.push(...(replacedResult.updatedSlideIds || []));
  }

  if (skippedItems.length > 0) {
    result.items.push(...skippedItems);
  }

  return result;
}
