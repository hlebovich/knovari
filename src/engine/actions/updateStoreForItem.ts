import type { ChangelogItem, TreatmentAction } from "../../types/changelog.ts";
import type { EngineContext } from "../../types/engine.ts";

export function updateStoreForItem(
  items: ChangelogItem[],
  action: TreatmentAction,
  isApplied: boolean,
  context: EngineContext
): void {
  context.store.getState().bulkUpdate(
    items.map((item) => ({
      ...item,
      action,
      isApplied,
    }))
  );
}
