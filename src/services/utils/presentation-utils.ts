import type { ChangelogItem, ChangelogSlide } from "../../types/changelog.ts";

export function copyTextRunFont(
  textRunFont: PowerPoint.FontProperties | undefined,
  slideFont: PowerPoint.ShapeFont
): PowerPoint.FontProperties {
  return {
    allCaps: textRunFont?.allCaps || !!slideFont.allCaps,
    bold: textRunFont?.bold || !!slideFont.bold,
    color: textRunFont?.color || slideFont.color || undefined,
    doubleStrikethrough: textRunFont?.doubleStrikethrough || !!slideFont.doubleStrikethrough,
    italic: textRunFont?.italic || !!slideFont.italic,
    name: textRunFont?.name || slideFont.name || undefined,
    size: textRunFont?.size || slideFont.size || undefined,
    strikethrough: textRunFont?.strikethrough || !!slideFont.strikethrough,
    subscript: textRunFont?.subscript || !!slideFont.subscript,
    superscript: textRunFont?.superscript || !!slideFont.superscript,
    underline: textRunFont?.underline || slideFont.underline || undefined,
  };
}

export function formatTextRuns(
  originalTextRuns: PowerPoint.TextRun[],
  startIndex: number,
  endIndex: number,
  proposedText: string,
  cellFont: PowerPoint.ShapeFont
): { initialTextRuns: PowerPoint.TextRun[]; proposedTextRuns: PowerPoint.TextRun[] } {
  if (!proposedText || startIndex < 0 || endIndex <= startIndex) {
    throw new Error(
      `[formatTextRuns] Invalid proposedText or indices provided for text replacement in table: proposedText=${proposedText}, startIndex=${startIndex}, endIndex=${endIndex}`
    );
  }

  const resultInitialTestRuns: PowerPoint.TextRun[] = [];
  const resultProposedTextRuns: PowerPoint.TextRun[] = [];

  let globalCursorIndex: number = 0; // position in fullText at the start of the current original run
  let state: "before" | "inside" | "after" = "before";
  let replacementInserted: boolean = false;
  let firstIsolatedRunFont: PowerPoint.FontProperties | undefined = undefined;

  for (let runIndex = 0; runIndex < originalTextRuns.length; runIndex += 1) {
    const originalRun: PowerPoint.TextRun = originalTextRuns[runIndex];
    const runText = originalRun.text ?? "";
    const runLength = runText.length;
    const runStartIndex = globalCursorIndex;
    const runEndIndex = runStartIndex + runLength;

    globalCursorIndex = runEndIndex;

    if (runLength === 0) {
      continue;
    }

    const hasOverlap: boolean = !(endIndex <= runStartIndex || startIndex >= runEndIndex);

    if (!hasOverlap) {
      // Entire run is strictly before or after the occurrence
      resultProposedTextRuns.push({
        text: runText,
        font: copyTextRunFont(originalRun.font, cellFont),
      });

      if (state === "inside") {
        // This run is entirely inside (should not happen) or after; since no overlap → we must have passed the end already
        // but to be safe, treat as "after".
        state = "after";
      }

      continue;
    }

    const localStartInRun: number = Math.max(0, startIndex - runStartIndex);
    const localEndInRun: number = Math.min(runLength, endIndex - runStartIndex);

    const originalRunFont = copyTextRunFont(originalRun.font, cellFont);

    if (state === "before") {
      // Push the part BEFORE the occurrence
      const beforeSlice: string = runText.slice(0, localStartInRun);
      if (beforeSlice.length > 0) {
        resultProposedTextRuns.push({
          text: beforeSlice,
          font: originalRunFont,
        });
      }
    }
    // Isolate the part inside the occurrence for initialTestRuns
    const insideSliceOccurance: string = runText.slice(localStartInRun, localEndInRun);

    if (insideSliceOccurance.length > 0) {
      if (!firstIsolatedRunFont) {
        firstIsolatedRunFont = originalRunFont;
      }
      resultInitialTestRuns.push({
        text: insideSliceOccurance,
        font: originalRunFont,
      });
    }

    if (endIndex <= runEndIndex) {
      // Occurrence ends inside this same run
      if (!replacementInserted) {
        resultProposedTextRuns.push({
          text: proposedText,
          font: firstIsolatedRunFont ?? originalRunFont,
        });
        replacementInserted = true;
      }

      const afterSlice: string = runText.slice(localEndInRun);
      if (afterSlice.length > 0) {
        resultProposedTextRuns.push({
          text: afterSlice,
          font: originalRunFont,
        });
      }

      state = "after";
    } else {
      // Occurrence continues to next runs
      state = "inside";
    }

    globalCursorIndex = runEndIndex;
  }

  return {
    initialTextRuns: resultInitialTestRuns,
    proposedTextRuns: resultProposedTextRuns,
  };
}

export function getSlidesToBeMarked(changelog: ChangelogSlide[]): ChangelogSlide[] {
  const slidesToBeMarked: ChangelogSlide[] = [];

  for (const slideItem of changelog) {
    const shapesWithSiblings = slideItem.items.filter((item) => item.hasSibling);
    const uniqueItemKeys = new Set<string>();
    const shapesToBeMarked: ChangelogItem[] = [];

    for (const shapeItem of shapesWithSiblings) {
      const itemKey =
        shapeItem.shapeType === "table"
          ? `${shapeItem.shapeId}::${shapeItem.column}::${shapeItem.row}`
          : shapeItem.shapeId;
      if (!uniqueItemKeys.has(itemKey)) {
        uniqueItemKeys.add(shapeItem.shapeId);
        shapesToBeMarked.push(shapeItem);
      }
    }

    if (shapesToBeMarked.length > 0) {
      slidesToBeMarked.push({
        ...slideItem,
        items: shapesToBeMarked,
      });
    }
  }

  return slidesToBeMarked;
}
