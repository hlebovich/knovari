import type { UseBoundStore } from "zustand/react";
import type { StoreApi } from "zustand/vanilla";
import type { ChangelogState } from "../../stores/ChangelogStore.ts";
import type { ChangelogItem } from "../../types/changelog.ts";

export function getUnresolvedItems(store: UseBoundStore<StoreApi<ChangelogState>>): {
  items: ChangelogItem[];
  charts: ChangelogItem[];
} {
  const slides = store.getState().changelog?.slides || [];
  const items: ChangelogItem[] = [];
  const charts: ChangelogItem[] = [];

  slides.map((slide) => {
    slide.items.forEach((item) => {
      if (!item.isApplied) {
        if (item.shapeType === "chart") {
          charts.push(item);
        } else {
          items.push(item);
        }
      }
    });
  });

  return { items, charts };
}
