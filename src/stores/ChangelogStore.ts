import { create } from "zustand";
import type { Changelog, ChangelogItem, Priority } from "../types/changelog.ts";

/** Helper: merge partial fields, skipping undefined values. */
function mergeDefined<T extends object>(base: T, patch: Partial<T>): T {
  const result: any = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

function getFilteredChangelog(
  changelog: Changelog | null,
  priorityFilter: Priority | "all"
): Changelog | null {
  if (changelog === null) {
    return null;
  }
  if (priorityFilter === "all") {
    return changelog;
  }

  return {
    ...changelog,
    slides: changelog.slides
      .map((slide) => {
        return {
          ...slide,
          items: slide.items.filter((item) => {
            return item.priority === priorityFilter;
          }),
        };
      })
      .filter((slide) => slide.items.length > 0),
  };
}

type PendingItemMap = Record<number, true>;

export interface ChangelogState {
  changelog: Changelog | null;
  taskId: string | null;
  filteredChangelog: Changelog | null;
  priorityFilter: Priority | "all";
  pendingItemMap: PendingItemMap;
  setChangelog: (nextChangelog: Changelog) => void;
  setTaskId: (taskId: string) => void;
  setPriorityFilter: (nextPriority: Priority | "all") => void;
  setPending: (itemIds: number[], isPending: boolean) => void;
  slideIdsUpdate: (slideIds: { initialId: string; updatedId: string }[]) => void;
  bulkUpdate: (patches: Array<Partial<ChangelogItem> & { id: number; slideId: string }>) => void;
  isPendingItem: (itemId: number) => boolean;
  getItemActionStatus: (itemId: number) => {
    isApplied: boolean;
    priority?: Priority;
  };
}

const TASK_ID_STORAGE_KEY = "task_id";

const storedTaskId = (() => {
  try {
    return localStorage.getItem(TASK_ID_STORAGE_KEY);
  } catch {
    return null;
  }
})();

export const useChangelogStore = create<ChangelogState>((set, get) => {
  return {
    changelog: null,
    filteredChangelog: null,
    taskId: storedTaskId,
    priorityFilter: "all",
    pendingItemMap: {},

    setChangelog(changelog) {
      const filteredChangelog = getFilteredChangelog(changelog, get().priorityFilter);
      set({ changelog, filteredChangelog });
    },

    setTaskId: (taskId: string) => {
      set({ taskId });
      localStorage.setItem(TASK_ID_STORAGE_KEY, taskId);
    },

    setPriorityFilter(nextPriority) {
      set((state) => {
        if (state.priorityFilter === nextPriority) {
          return state;
        }

        const filteredChangelog = getFilteredChangelog(state.changelog, nextPriority);
        return { priorityFilter: nextPriority, filteredChangelog };
      });
    },

    setPending(itemIds, isPending) {
      set((state) => {
        const nextMap: PendingItemMap = { ...state.pendingItemMap };
        for (const itemId of itemIds) {
          if (isPending) {
            nextMap[itemId] = true;
          } else {
            delete nextMap[itemId];
          }
        }
        return { pendingItemMap: nextMap };
      });
    },

    getItemActionStatus(itemId) {
      let item: ChangelogItem | null = null;

      if (!this.changelog) {
        return { isApplied: false, priority: "unknown" };
      }

      for (const slide of this.changelog.slides) {
        const foundItem = slide.items.find((it) => it.id === itemId);
        if (foundItem) {
          item = foundItem;
        }
      }

      if (!item) {
        return { isApplied: false, priority: "unknown" };
      }

      return { isApplied: item.isApplied, priority: item.priority };
    },

    slideIdsUpdate(slideIds) {
      set((state) => {
        if (state.changelog === null) {
          return state;
        }

        const idChanges: Map<string, string> = new Map();
        slideIds.forEach(({ initialId, updatedId }) => idChanges.set(initialId, updatedId));
        const nextSlides = state.changelog.slides.map((slide) => {
          if (!idChanges.has(slide.slideId)) {
            return slide;
          }

          const newId = idChanges.get(slide.slideId)!;
          const nextItems = slide.items.map((item) => ({ ...item, slideId: newId }));
          return { ...slide, slideId: newId, items: nextItems };
        });

        const updatedChangelog = { ...state.changelog, slides: nextSlides };
        const filteredChangelog = getFilteredChangelog(updatedChangelog, state.priorityFilter);

        return {
          changelog: updatedChangelog,
          filteredChangelog,
        };
      });
    },

    bulkUpdate(patches) {
      set((state) => {
        if (state.changelog === null) {
          return state;
        }
        if (patches.length === 0) {
          return state;
        }

        const patchesBySlideId = new Map<string, Array<Partial<ChangelogItem> & { id: number }>>();

        for (const patch of patches) {
          const bucket = patchesBySlideId.get(patch.slideId);
          if (bucket !== undefined) {
            bucket.push(patch);
          } else {
            patchesBySlideId.set(patch.slideId, [patch]);
          }
        }

        const nextSlides = state.changelog.slides.map((slide) => {
          const slidePatches = patchesBySlideId.get(slide.slideId);
          if (slidePatches === undefined) {
            return slide;
          }

          const patchById = new Map<number, Partial<ChangelogItem> & { id: number }>();
          for (const p of slidePatches) {
            patchById.set(p.id, p);
          }

          const nextItems = slide.items.map((item) => {
            const patch = patchById.get(item.id);
            if (patch === undefined) {
              return item;
            }
            return mergeDefined<ChangelogItem>(item, patch);
          });

          return { ...slide, items: nextItems };
        });

        const updatedChangelog = { ...state.changelog, slides: nextSlides };
        const filteredChangelog = getFilteredChangelog(updatedChangelog, state.priorityFilter);

        return {
          changelog: updatedChangelog,
          filteredChangelog,
        };
      });
    },

    isPendingItem(itemId) {
      const { pendingItemMap } = get();
      return pendingItemMap[itemId] === true;
    },
  };
});
