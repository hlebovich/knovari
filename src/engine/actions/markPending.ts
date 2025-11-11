import type { ChangelogItem } from "../../types/changelog.ts";
import type { EngineContext } from "../../types/engine.ts";

export function markPending(items: ChangelogItem[], context: EngineContext) {
  const busy = items.filter((t) => context.store.getState().isPendingItem(t.id));
  if (busy.length) {
    context.logger.warn(
      "[engine] Some targets are already pending, skipping run",
      busy.map((b) => b.id)
    );
    return;
  }

  context.store.getState().setPending(
    items.map((item) => item.id),
    true
  );
}
