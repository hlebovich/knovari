import type { ChangelogItem } from "../../types/changelog.ts";

export function rollbackAppliedStatus(items: ChangelogItem[], isApplied: boolean): ChangelogItem[] {
  return items.map((item: ChangelogItem) => ({ ...item, isApplied }));
}
