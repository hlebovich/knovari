import type { ChangelogItem, ChangelogSlide } from "../types/changelog.ts";

/**
 * Purpose:
 * Prepare changelog items for deterministic, marker-aware text operations by
 * annotating where ambiguity exists and how to address it on the first pass
 * (before invisible markers are present).
 *
 * Why:
 * - When a shape or table cell contains multiple occurrences, subsequent actions
 *   (replace/revert/undo) must target the correct occurrence without guessing.
 * - We only want to place invisible markers where ambiguity actually exists,
 *   keeping documents clean elsewhere.
 *
 * Effects:
 * - Sets `hasSiblingOccurrences` on items that share the same logical container
 *   (shape or table cell) and have 2+ occurrences, regardless of differing `initialValue`.
 *   This flag signals that these items require marker-based disambiguation.
 * - Assigns `occurrenceIndex` ONLY within groups that share the same `initialValue`
 *   and contain 2+ occurrences, providing a stable order for the initial, pre-marker pass.
 *
 * Container scope:
 * - Non-table text: (slideId, shapeId)
 * - Table text:     (slideId, shapeId, row, column)
 */

export function annotateSiblingOccurrences(slidesRaw: ChangelogSlide[]): ChangelogSlide[] {
  const slides: ChangelogSlide[] = slidesRaw;

  for (const slide of slides) {
    const shapes = new Map<string, ChangelogItem[]>();

    for (const item of slide.items) {
      const isTable = item.shapeType === "table" && item.row != null && item.column != null;
      const shapeKey = isTable ? `${item.shapeId}::r${item.row}::c${item.column}` : item.shapeId;

      if (!shapes.has(shapeKey)) {
        shapes.set(shapeKey, []);
      }
      shapes.get(shapeKey)!.push(item);
    }

    for (const [, itemsInShape] of shapes) {
      const hasSiblings = itemsInShape.length >= 2;
      if (!hasSiblings) {
        // No siblings — clear any leftover flags
        for (const shapeItem of itemsInShape) {
          shapeItem.hasSibling = false;
          shapeItem.siblings = [];
          shapeItem.occurrenceIndex = undefined;
        }
        continue;
      }

      // 1) Build groups by initialValue to compute occurrenceIndex only for duplicates
      const sameTextGroups = new Map<string, ChangelogItem[]>();
      for (const it of itemsInShape) {
        const key = it.initialValue ?? "";
        if (!sameTextGroups.has(key)) {
          sameTextGroups.set(key, []);
        }
        sameTextGroups.get(key)!.push(it);
      }

      // 2) Sort each duplicate group by startIndex (tie-break by id) and assign occurrenceIndex
      const groupSizes = new Map<string, number>(); // to know where occurrenceIndex is meaningful
      for (const [key, group] of sameTextGroups) {
        groupSizes.set(key, group.length);

        if (group.length < 2) {
          // Single occurrence of this initialValue → no occurrenceIndex needed
          for (const groupItem of group) {
            groupItem.occurrenceIndex = undefined;
          }
          continue;
        }

        group.sort((a, b) => {
          const ai = typeof a.startIndex === "number" ? a.startIndex! : Number.MAX_SAFE_INTEGER;
          const bi = typeof b.startIndex === "number" ? b.startIndex! : Number.MAX_SAFE_INTEGER;
          if (ai !== bi) {
            return ai - bi;
          }
          return a.id - b.id;
        });

        for (let i = 0; i < group.length; i++) {
          group[i].occurrenceIndex = i;
        }
      }

      // 3) Set hasSibling flag and populate siblings with occurrenceIndex where applicable
      for (const shapeItem of itemsInShape) {
        shapeItem.hasSibling = true;

        shapeItem.siblings = itemsInShape
          .filter((s) => s.id !== shapeItem.id)
          .map((s) => {
            const sameTextCount = groupSizes.get(s.initialValue ?? "") ?? 1;
            // Only include occurrenceIndex when there are duplicates of this same initialValue
            const occIdx =
              sameTextCount >= 2 && typeof s.occurrenceIndex === "number"
                ? s.occurrenceIndex
                : undefined;

            return {
              id: s.id,
              initialText: s.initialValue,
              occurrenceIndex: occIdx,
            };
          });
      }
    }
  }

  return slides;
}
