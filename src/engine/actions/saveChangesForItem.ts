import type { ChangelogItem, TreatmentAction } from "../../types/changelog.ts";
import type { EngineContext } from "../../types/engine.ts";
import { changelogItemToChangelogItemRequest } from "../../helpers/changelogItemToChangelogItemRequest.ts";

export async function saveChangesForItem(
  items: ChangelogItem[],
  context: EngineContext,
  action: TreatmentAction,
  isApplied: boolean
): Promise<{ items: ChangelogItem[]; unprocessedItems: ChangelogItem[] }> {
  const { api, store } = context;
  const taskId = store.getState().taskId;

  if (!taskId) {
    throw new Error("Task ID is not set. Cannot save changes.");
  }

  try {
    await api.api.updateTaskChangelog(taskId, {
      data: items.map((updatedItem: ChangelogItem) =>
        changelogItemToChangelogItemRequest(updatedItem, action, isApplied)
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
