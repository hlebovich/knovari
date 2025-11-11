import type { UseBoundStore } from "zustand/react";
import type { StoreApi } from "zustand/vanilla";
import type { ChangelogState } from "../../stores/ChangelogStore.ts";
import type { Changelog, ChangelogItem } from "../../types/changelog.ts";

const findGroupItems = (changelog: Changelog | null, groupId: number): ChangelogItem[] => {
  if (!changelog) {
    return [];
  }

  const items: ChangelogItem[] = [];
  changelog.slides.forEach((slide) => {
    slide.items.forEach((item) => {
      if (item.groupId === groupId && !item.isApplied) {
        items.push(item);
      }
    });
  });
  return items;
};

export function resolveTargets(
  item: ChangelogItem,
  store: UseBoundStore<StoreApi<ChangelogState>>,
  applyToGroup?: boolean
): ChangelogItem[] {
  const changelog = store.getState().changelog;
  if (applyToGroup && item.groupId) {
    return findGroupItems(changelog, item.groupId).filter((i) => !i.isApplied);
  }

  return [item];
}
