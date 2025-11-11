import type { ChangelogItem } from "../../types/changelog.ts";
import type { EngineContext, TransformResult } from "../../types/engine.ts";
import { formatTransformResult } from "./formatTransformResult.ts";

const REDACTED_TEXT = "[Redacted]";
const REPLACE_TEXT_STUB = "[Text was replaced]";

function collectSiblings(
  sibling: {
    id: number;
    initialText: string | null | undefined;
    occurrenceIndex?: number | undefined;
  },
  context: EngineContext
) {
  const store = context.store.getState();
  const actionStatus = store?.getItemActionStatus(sibling.id);
  return {
    ...sibling,
    priority: actionStatus?.priority || "unknown",
    isApplied: actionStatus?.isApplied,
  };
}

async function changeInitialTextInTable(
  items: ChangelogItem[],
  context: EngineContext,
  isRedact: boolean,
  isApplied: boolean
): Promise<TransformResult> {
  const replacementItems = items.map((replacementItem: ChangelogItem) => {
    return {
      shapeId: replacementItem.shapeId,
      slideId: replacementItem.slideId,
      id: replacementItem.id,
      data: {
        isApplied,
        priority: replacementItem.priority,
        initialText: replacementItem.initialValue,
        proposedText: isRedact ? REDACTED_TEXT : replacementItem.proposedValue || REPLACE_TEXT_STUB,
        startIndex: replacementItem.startIndex,
        row: replacementItem.row,
        column: replacementItem.column,
        hasSiblings: replacementItem.hasSibling,
        occurrenceIndex: replacementItem.occurrenceIndex,
        siblings: replacementItem.siblings?.map((sibling) => collectSiblings(sibling, context)),
      },
    };
  });

  const { textRuns, unprocessedItems } = await context.ppt.replaceTextInTables(replacementItems);
  const updatedItems = items.map((item, index) => ({
    ...item,
    userChange: JSON.stringify(textRuns[index]),
  }));

  return formatTransformResult(updatedItems, unprocessedItems);
}

export async function redactTable(
  items: ChangelogItem[],
  context: EngineContext
): Promise<TransformResult> {
  return changeInitialTextInTable(items, context, true, true);
}

export async function replaceTable(
  items: ChangelogItem[],
  context: EngineContext
): Promise<TransformResult> {
  return changeInitialTextInTable(items, context, false, true);
}

export async function revertTable(
  items: ChangelogItem[],
  context: EngineContext
): Promise<TransformResult> {
  const replacementItems = items
    .filter((replacementItem) => replacementItem.action !== "skip")
    .map((replacementItem: ChangelogItem) => ({
      shapeId: replacementItem.shapeId,
      slideId: replacementItem.slideId,
      id: replacementItem.id,
      data: {
        resolved: null,
        priority: replacementItem.priority,
        initialText:
          replacementItem.action === "redact"
            ? REDACTED_TEXT
            : replacementItem.proposedValue || REPLACE_TEXT_STUB,
        proposedText: replacementItem.initialValue,
        startIndex: replacementItem.startIndex,
        row: replacementItem.row,
        column: replacementItem.column,
        hasSiblings: replacementItem.hasSibling,
        occurrenceIndex: replacementItem.occurrenceIndex,
        siblings: replacementItem.siblings?.map((sibling) => collectSiblings(sibling, context)),
        proposedTextRuns: replacementItem.userChange
          ? JSON.parse(replacementItem.userChange)
          : undefined,
      },
    }));

  const { unprocessedItems } = await context.ppt.revertTextInTables(replacementItems);
  const updatedItems = items.map((item) => ({
    ...item,
    userChange: undefined,
  }));

  return formatTransformResult(updatedItems, unprocessedItems);
}
