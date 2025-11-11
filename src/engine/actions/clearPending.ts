import type { ChangelogItem } from "../../types/changelog.ts";
import type { EngineContext } from "../../types/engine.ts";

export function clearPending(items: ChangelogItem[], context: EngineContext) {
  context.store.getState().setPending(
    items.map((t) => t.id),
    false
  );
}
