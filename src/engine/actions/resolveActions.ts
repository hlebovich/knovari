import type { ChangelogItem } from "../../types/changelog.ts";

export function resolveActions(items: ChangelogItem[]): ChangelogItem[] {
  return items.map((item: ChangelogItem) => ({ ...item, resolved: "accepted" }));
}
