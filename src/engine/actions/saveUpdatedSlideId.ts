import type { ChangelogItem } from "../../types/changelog.ts";
import type { EngineContext, UpdatedSlideIdItem } from "../../types/engine.ts";
import { changelogItemToChangelogItemRequest } from "../../helpers/changelogItemToChangelogItemRequest.ts";

export async function saveUpdatedSlideId(
  updatedSlideIds: UpdatedSlideIdItem[],
  context: EngineContext
): Promise<{ items: ChangelogItem[]; unprocessedItems: ChangelogItem[] }> {
  const { api, store } = context;
  const taskId = store.getState().taskId;

  if (!taskId) {
    throw new Error("Task ID is not set. Cannot save changes.");
  }

  const initialIds = new Map();
  updatedSlideIds.map((item) => initialIds.set(item.initialId, item.updatedId));

  const changelog = store.getState().changelog;
  const slidesToUpdate = changelog?.slides.filter((slide) => initialIds.has(slide.slideId));

  if (!slidesToUpdate || slidesToUpdate.length === 0) {
    throw new Error(`Slides with provided IDs not found in changelog.`, {
      cause: { updatedSlideIds },
    });
  }

  const items: ChangelogItem[] = [];
  slidesToUpdate.forEach((slide) => {
    items.push(...slide.items.map((item) => ({ ...item, slideId: initialIds.get(slide.slideId) })));
  });

  try {
    await api.api.updateTaskChangelog(taskId, {
      data: items.map((updatedItem: ChangelogItem) =>
        changelogItemToChangelogItemRequest(updatedItem, updatedItem.action, updatedItem.isApplied)
      ),
    });

    return { items, unprocessedItems: [] };
  } catch (error) {
    const unprocessedItems: ChangelogItem[] = items.map((item) => ({
      ...item,
      error: {
        message: "Something went wrong while saving the update.",
        error:
          error instanceof Error
            ? error
            : new Error(typeof error === "object" ? JSON.stringify(error) : String(error)),
      },
    }));
    return { items: [], unprocessedItems };
  }
}
