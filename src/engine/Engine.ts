import { HighlightingService } from "../services/Highlighting.service.ts";
import { MarkerService } from "../services/Marker.service.ts";
import type { ChangelogGroup, ChangelogItem, TreatmentAction } from "../types/changelog.ts";
import type { EngineContext, TransformAction, UpdatedSlideIdItem } from "../types/engine.ts";
import { clearErrors } from "./actions/clearErrors.ts";
import { clearPending } from "./actions/clearPending.ts";
import { getItemsToRemove } from "./actions/getItemsToRemove.ts";
import { getUnresolvedItems } from "./actions/getUnresolvedItems.ts";
import { markPending } from "./actions/markPending.ts";
import { removeItems } from "./actions/removeItems.ts";
import { resolveActions } from "./actions/resolveActions.ts";
import { rollbackAppliedStatus } from "./actions/rollbackAppliedStatus.ts";
import { saveChangesForChangelog } from "./actions/saveChangesForChangelog.ts";
import { saveChangesForItem } from "./actions/saveChangesForItem.ts";
import { saveUpdatedSlideId } from "./actions/saveUpdatedSlideId.ts";
import { transformPresentation } from "./actions/transformPresentation.ts";
import { updateStoreForChangelog } from "./actions/updateStoreForChangelog.ts";
import { updateStoreForItem } from "./actions/updateStoreForItem.ts";

const unsupportedTypes: string[] = [];

/**
 * Run workflow for a single changelog item.
 * - Determines target items (single or group)
 * - Marks them pending
 * - Executes recipe by action: Replace/Redact/Obfuscate -> Transform + Save; Skip -> Save only
 * - Updates store with server result; clears pending
 * Fail-fast: stops on the first step error.
 */
export async function runUpdateForItem(
  item: ChangelogItem,
  action: TreatmentAction,
  isApplied: boolean,
  context: EngineContext
): Promise<{ unprocessedItems: ChangelogItem[] }> {
  const { logger } = context;
  logger.info(
    `[Engine] Running update for item ID: ${item.id}, slideId: ${item.slideId} action: ${action}, isApplied: ${isApplied}`
  );
  let errors: ChangelogItem[] = [];

  const clearedItems = clearErrors([item]);

  markPending(clearedItems, context);

  try {
    const transformAction: TransformAction = isApplied ? action : "revert";
    const {
      items: updatedItems,
      unprocessedItems,
      updatedSlideIds,
    } = await transformPresentation(clearedItems, transformAction, context);
    errors.push(...unprocessedItems);

    let savedItems: ChangelogItem[] = updatedItems;

    if (updatedItems.length) {
      const { items, unprocessedItems: unsavedItems } = await saveChangesForItem(
        updatedItems,
        context,
        action,
        isApplied
      );

      savedItems = items;

      if (unsavedItems.length > 0) {
        errors.push(...unsavedItems);
        await rollbackChangesForItem(unsavedItems, clearedItems, transformAction, context);
      }
    }

    updateStoreForItem(savedItems, action, isApplied, context);

    if (updatedSlideIds && updatedSlideIds.length) {
      const { unprocessedItems: unsavedSlideIdUpdate } = await saveUpdatedSlideId(
        updatedSlideIds,
        context
      );
      errors.push(...unsavedSlideIdUpdate);

      context.store.getState().slideIdsUpdate(updatedSlideIds);
    }
    updateStoreForItem(errors, action, !isApplied, context);
  } catch (error) {
    throw new Error("[Engine] runUpdateForItem failed to update presentation:", { cause: error });
  } finally {
    clearPending(clearedItems, context);
  }

  return { unprocessedItems: errors };
}

async function rollbackChangesForItem(
  updatedItems: ChangelogItem[],
  initialItems: ChangelogItem[],
  initialAction: TransformAction,
  context: EngineContext
) {
  for (const item of updatedItems) {
    const initialItem = initialItems.find((initItem) => initItem.id === item.id);

    if (!initialItem) {
      continue;
    }

    const transformAction = initialAction === "revert" ? initialItem.action : "revert";

    await transformPresentation([item], transformAction, context);
  }
}

export async function runActionForItemGroups(
  groups: { group: ChangelogGroup; action: TreatmentAction }[],
  context: EngineContext
) {
  const { logger } = context;
  logger.info(`[Engine] Running update for groups list`, groups);

  let errors: ChangelogItem[] = [];

  for (const { group, action } of groups) {
    try {
      const {
        items: updatedItems,
        unprocessedItems,
        updatedSlideIds,
      } = await transformPresentation(group.items, action, context);
      errors.push(...unprocessedItems);

      let savedItems: ChangelogItem[] = updatedItems;

      if (updatedItems.length) {
        const { items, unprocessedItems: unsavedItems } = await saveChangesForItem(
          updatedItems,
          context,
          action,
          true
        );

        savedItems = items;

        if (unsavedItems.length > 0) {
          errors.push(...unsavedItems);
          await rollbackChangesForItem(unsavedItems, group.items, action, context);
        }
      }

      updateStoreForItem(savedItems, action, true, context);

      if (updatedSlideIds && updatedSlideIds.length) {
        const { unprocessedItems: unsavedSlideIdUpdate } = await saveUpdatedSlideId(
          updatedSlideIds,
          context
        );
        errors.push(...unsavedSlideIdUpdate);

        context.store.getState().slideIdsUpdate(updatedSlideIds);
      }
      updateStoreForItem(errors, action, true, context);
    } catch (error) {
      throw new Error("[Engine] runActionForItemGroups failed to update presentation:", {
        cause: error,
      });
    }
  }

  return { unprocessedItems: errors };
}

export async function runActionChangeForItem(
  item: ChangelogItem,
  action: TreatmentAction,
  context: EngineContext
): Promise<void> {
  markPending([item], context);

  const clearedItems = clearErrors([item]);

  try {
    await saveChangesForItem(clearedItems, context, action, item.isApplied);
    updateStoreForItem(clearedItems, action, item.isApplied, context);
  } catch (error) {
    throw new Error("[Engine] runActionChangeForItem failed:", { cause: error });
  } finally {
    clearPending(clearedItems, context);
  }
}

async function updateChangelog(items: ChangelogItem[], context: EngineContext) {
  const unprocessed: ChangelogItem[] = [];
  const updatedIds: UpdatedSlideIdItem[] = [];

  try {
    const transformedItems: ChangelogItem[] = [];
    const savedItems: ChangelogItem[] = [];
    for (const item of items) {
      const {
        items: updated,
        unprocessedItems,
        updatedSlideIds,
      } = await transformPresentation([item], item.action, context);

      transformedItems.push(...updated);
      unprocessed.push(...rollbackAppliedStatus(unprocessedItems, false));
      updatedIds.push(...(updatedSlideIds || []));
    }

    const { items: saved, unprocessedItems: unsavedItems } = await saveChangesForChangelog(
      transformedItems,
      context
    );
    savedItems.push(...saved);

    if (unsavedItems.length > 0) {
      unprocessed.push(...rollbackAppliedStatus(unsavedItems, false));
      await transformPresentation(unsavedItems, "revert", context);
    }

    if (updatedIds && updatedIds.length) {
      const { unprocessedItems: unsavedSlideIdUpdate } = await saveUpdatedSlideId(
        updatedIds,
        context
      );
      unprocessed.push(...unsavedSlideIdUpdate);

      context.store.getState().slideIdsUpdate(updatedIds);
    }

    updateStoreForChangelog([...savedItems, ...unprocessed], context);
    return unprocessed;
  } catch (error) {
    throw new Error("[Engine] updateChangelog failed:", { cause: error });
  }
}

export async function runUpdateForChangelog(
  context: EngineContext
): Promise<{ unprocessedItems: ChangelogItem[] }> {
  const { store, logger } = context;

  const unprocessed: ChangelogItem[] = [];
  const { items: targetItems, charts } = getUnresolvedItems(store);
  const filteredItems = targetItems.filter((item) => !unsupportedTypes.includes(item.shapeType));
  logger.info("[Engine] Running update for changelog, target items:", filteredItems);
  const resolvedItems = resolveActions(clearErrors(filteredItems));
  const resolvedCharts = resolveActions(clearErrors(charts));

  if (resolvedItems.length === 0 && resolvedCharts.length === 0) {
    return { unprocessedItems: [] };
  }

  markPending([...resolvedItems, ...resolvedCharts], context);

  try {
    const unprocessedItems = await updateChangelog(resolvedItems, context);
    unprocessed.push(...unprocessedItems);

    const unprocessedCharts = await updateChangelog(resolvedCharts, context);
    unprocessed.push(...unprocessedCharts);
  } catch (error) {
    throw new Error("[Engine] runUpdateForChangelog failed:", { cause: error });
  } finally {
    clearPending(targetItems, context);
  }

  return { unprocessedItems: unprocessed };
}

export async function runClearFile(context: EngineContext) {
  const { store } = context;
  const slides = store.getState().changelog?.slides;

  if (!slides || slides.length === 0) {
    throw new Error("No slides in changelog to generate file.");
  }

  const targetItems = getItemsToRemove(slides);

  try {
    await removeItems(targetItems, context);
    await MarkerService.cleanMarkersByChangelog(slides);
    await HighlightingService.clearHighlights();
  } catch (error) {
    throw new Error("[Engine] runClearFile failed:", { cause: error });
  }

  // TODO: implement full clear of presentation
}
