import type { FinalChangelogData } from "../services/Api.service.ts";
import type { ChangelogItem, TreatmentAction } from "../types/changelog.ts";

export function changelogItemToChangelogItemRequest(
  item: ChangelogItem,
  action: TreatmentAction,
  isApplied: boolean
): FinalChangelogData {
  const slideIdNum = parseInt(item.slideId.split("#")[0], 10);
  return {
    id: item.id,
    slideId: slideIdNum,
    slideNumber: item.slideNumber,
    shapeId: parseInt(item.shapeId),
    groupId: item.groupId,
    shapeType: item.shapeType,
    category: item.category,
    rationale: item.rationale,
    confidenceScore: item.confidenceScore,
    initialValue: item.shapeType === "chart" ? item.chartInitialValue : item.initialValue,
    proposedValue: item.shapeType === "chart" ? item.chartProposedValue : item.proposedValue,
    action: action,
    userChange: item.userChange,
    obfuscationScale: 0,
    isApplied: isApplied,
    startIndex: item.startIndex,
    row: item.row,
    column: item.column,
  };
}
