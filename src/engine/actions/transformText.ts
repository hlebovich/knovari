import type { ChangelogItem } from "../../types/changelog.ts";
import type { EngineContext, TransformResult } from "../../types/engine.ts";
import type { ReplaceItemBase, ReplaceTextData } from "../../types/presentationService.ts";
import { formatTransformResult } from "./formatTransformResult.ts";

const REDACTED_TEXT = "[Redacted]";
const REPLACE_TEXT_STUB = "[Text was replaced]";

const DEFAULT_ACTION_STATUS = {
  priority: "unknown" as const,
  resolved: null,
};

function formatTextData(
  item: ChangelogItem,
  initialText: string | null | undefined,
  proposedText: string,
  isApplied: boolean,
  context?: EngineContext
): ReplaceItemBase<ReplaceTextData> {
  return {
    shapeId: item.shapeId,
    slideId: item.slideId,
    id: item.id,
    data: {
      initialText,
      proposedText,
      hasSiblings: item.hasSibling,
      occurrenceIndex: item.occurrenceIndex,
      siblings: item.siblings?.map((sibling) => {
        const store = context?.store.getState();
        const actionStatus = store?.getItemActionStatus(sibling.id);
        return {
          ...sibling,
          shapeId: item.shapeId,
          slideId: item.slideId,
          priority: actionStatus?.priority || DEFAULT_ACTION_STATUS.priority,
          isApplied: actionStatus?.isApplied,
          proposedText: "",
        };
      }),
      isApplied: isApplied,
      priority: item.priority,
    },
  };
}

export async function redactText(
  items: ChangelogItem[],
  context: EngineContext
): Promise<TransformResult> {
  const replacementItems = items.map((replacementItem: ChangelogItem) => {
    return formatTextData(
      replacementItem,
      replacementItem.initialValue,
      REDACTED_TEXT,
      true,
      context
    );
  });

  const { unprocessedItems } = await context.ppt.replaceTextInShapes(replacementItems);
  return formatTransformResult(items, unprocessedItems);
}

export async function replaceText(
  items: ChangelogItem[],
  context: EngineContext
): Promise<TransformResult> {
  const replacementItems = items.map((replacementItem: ChangelogItem) => {
    return formatTextData(
      replacementItem,
      replacementItem.initialValue,
      replacementItem.proposedValue || REPLACE_TEXT_STUB,
      true,
      context
    );
  });

  const { unprocessedItems } = await context.ppt.replaceTextInShapes(replacementItems);
  return formatTransformResult(items, unprocessedItems);
}

export async function revertText(
  items: ChangelogItem[],
  context: EngineContext
): Promise<TransformResult> {
  const replacementItems = items
    .filter((replacementItem) => replacementItem.action !== "skip")
    .map((replacementItem: ChangelogItem) => {
      const textToRevert =
        replacementItem.action === "redact"
          ? REDACTED_TEXT
          : replacementItem.proposedValue || REPLACE_TEXT_STUB;

      return formatTextData(
        replacementItem,
        textToRevert,
        replacementItem.initialValue || "",
        false,
        context
      );
    });

  const { unprocessedItems } = await context.ppt.replaceTextInShapes(replacementItems);
  return formatTransformResult(items, unprocessedItems);
}
