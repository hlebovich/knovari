import type { ChangelogItem } from "../../types/changelog.ts";
import type { EngineContext } from "../../types/engine.ts";

export function updateStoreForChangelog(items: ChangelogItem[], context: EngineContext): void {
  context.store.getState().bulkUpdate(items);
}
