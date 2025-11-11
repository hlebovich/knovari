import type { ChangelogItem } from "../../types/changelog.ts";

export function clearErrors(items: ChangelogItem[]): ChangelogItem[] {
  return items.map((item) => ({
    ...item,
    error: null,
  }));
}
