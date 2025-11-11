import { changelogItemToChangelogItemRequest } from "../../helpers/changelogItemToChangelogItemRequest.ts";
import type { ChangelogItem } from "../../types/changelog.ts";
import type { EngineContext } from "../../types/engine.ts";

export async function saveChangesForChangelog(
  items: ChangelogItem[],
  context: EngineContext
): Promise<{
  items: ChangelogItem[];
  unprocessedItems: ChangelogItem[];
}> {
  const { api, store } = context;
  const taskId = store.getState().taskId;

  if (!taskId) {
    throw new Error("Task ID is not set. Cannot save changes.");
  }

  try {
    const requestItems = items.map((updatedItem: ChangelogItem) =>
      changelogItemToChangelogItemRequest(updatedItem, updatedItem.action, updatedItem.isApplied)
    );

    await api.api.updateTaskChangelog(taskId, {
      data: requestItems,
    });

    return { items, unprocessedItems: [] };
  } catch (error) {
    return {
      items: [],
      unprocessedItems: items.map((updatedItem: ChangelogItem) => ({
        ...updatedItem,
        error: {
          message: "Something went wrong while saving the update.",
          error:
            error instanceof Error
              ? error
              : new Error(typeof error === "object" ? JSON.stringify(error) : String(error)),
        },
      })),
    };
  }
}
