import type { ChangelogByCategory, ChangelogItem } from "../types/changelog.ts";

function trimDot(rationale: string): string {
  return rationale.replace(/\.$/, "");
}

export function getChangelogByCategories(items: ChangelogItem[]): ChangelogByCategory {
  const changelogByCategory: ChangelogByCategory = {};

  for (const item of items) {
    if (!item.groupId) {
      continue;
    }

    if (!changelogByCategory[item.category]) {
      changelogByCategory[item.category] = {
        groups: {},
        totalItems: 0,
      };
    }

    const groupId = item.groupId;

    if (!changelogByCategory[item.category].groups[groupId]) {
      changelogByCategory[item.category].groups = {
        ...changelogByCategory[item.category].groups,
        [groupId]: {
          groupId: groupId,
          category: item.category,
          value: trimDot(item.rationale),
          items: [item],
        },
      };
    } else {
      changelogByCategory[item.category].groups[groupId].items.push(item);
    }
    changelogByCategory[item.category].totalItems =
      changelogByCategory[item.category].totalItems + 1;
  }

  return changelogByCategory;
}
