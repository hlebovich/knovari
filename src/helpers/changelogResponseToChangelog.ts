import type { FinalChangelogData } from "../services/Api.service.ts";

import type {
  Changelog,
  ChangelogItem,
  ChangelogSlide,
  Priority,
  TreatmentAction,
  Type,
  ShapeType,
  ConfidenceScore,
  FinalChangelog,
} from "../types/changelog.ts";
import { annotateSiblingOccurrences } from "./annotateSiblingOccurrences.ts";

const SHAPE_TYPE_SET: readonly ShapeType[] = ["text", "chart", "image", "table"] as const;
const CONFIDENCE_SCORE_SET: readonly ConfidenceScore[] = [
  "certain",
  "likely",
  "unclear",
  "uncertain",
] as const;
const ACTION_SET: readonly TreatmentAction[] = ["redact", "replace", "obfuscate", "skip"] as const;

const PRIORITY_MAP: Record<ConfidenceScore, Priority> = {
  ["certain"]: "high",
  ["likely"]: "medium",
  ["unclear"]: "low",
  ["uncertain"]: "veryLow",
};

function normalizeShapeType(t: string | undefined | null): ShapeType {
  const v = String(t ?? "").toLowerCase();
  return (SHAPE_TYPE_SET as readonly string[]).includes(v) ? (v as ShapeType) : "unknown";
}

function normalizeConfidenceScore(p: string | undefined | null): ConfidenceScore {
  const v = String(p ?? "").toLowerCase();
  return (CONFIDENCE_SCORE_SET as readonly string[]).includes(v)
    ? (v as ConfidenceScore)
    : "uncertain";
}

function normalizeAction(p: string | undefined | null, type: Type): TreatmentAction {
  const defaultAction: TreatmentAction = type === "range" ? "obfuscate" : "replace";
  const v = String(p ?? "").toLowerCase();
  return (ACTION_SET as readonly string[]).includes(v) ? (v as TreatmentAction) : defaultAction;
}

function getFullSlideId(shortId: number, fullSlideIds: Array<string>): string {
  const foundId = fullSlideIds.find((id) => id.startsWith(`${shortId}#`));
  return foundId || `${shortId}#0`;
}

export function changelogItemResponseToChangelogItem(
  item: FinalChangelogData,
  fullSlideIds: Array<string>
): ChangelogItem {
  const shapeType = normalizeShapeType(item.shapeType);
  const type: Type = shapeType === "image" ? "image" : "text";
  const confidenceScore = normalizeConfidenceScore(item.confidenceScore);
  const priority = PRIORITY_MAP[confidenceScore];
  const action: TreatmentAction = normalizeAction(item.action, type);
  const slideId = getFullSlideId(item.slideId, fullSlideIds);

  return {
    id: item.id,
    slideId,
    slideNumber: item.slideNumber,
    priority,
    type,
    action,
    confidenceScore,
    category: item.category,
    rationale: item.rationale,
    proposedValue: typeof item.proposedValue === "string" ? item.proposedValue : "",
    chartProposedValue: item.shapeType === "chart" ? item.proposedValue : "",
    initialValue: typeof item.initialValue === "string" ? item.initialValue : "",
    chartInitialValue: item.shapeType === "chart" ? item.initialValue : "",
    groupId: item.groupId,
    shapeId: String(item.shapeId),
    shapeType: shapeType,
    isApplied: !!item.isApplied,
    startIndex: item.startIndex,
    userChange: item.userChange,
    row: item.row,
    column: item.column,
  };
}

export function changelogResponseToChangelog(items: ChangelogItem[]): Changelog {
  const slidesMap = new Map<string, ChangelogSlide>();

  let highPriorityItems = 0;
  let mediumPriorityItems = 0;
  let lowPriorityItems = 0;
  let veryLowPriorityItems = 0;

  for (const item of items) {
    const slideId = item.slideId;
    const slideNumber = item.slideNumber;

    if (!slidesMap.has(slideId)) {
      slidesMap.set(slideId, { slideId, slideNumber, items: [] });
    }
    const slide = slidesMap.get(slideId)!;

    slide.items.push(item);

    if (item.confidenceScore === "certain") {
      highPriorityItems += 1;
    } else if (item.confidenceScore === "likely") {
      mediumPriorityItems += 1;
    } else if (item.confidenceScore === "unclear") {
      lowPriorityItems += 1;
    } else if (item.confidenceScore === "uncertain") {
      veryLowPriorityItems += 1;
    }
  }

  const slides = Array.from(slidesMap.values()).sort((a, b) => a.slideNumber - b.slideNumber);

  return {
    slides: annotateSiblingOccurrences(slides),
    totalItems: items.length,
    highPriorityItems,
    mediumPriorityItems,
    lowPriorityItems,
    veryLowPriorityItems,
  };
}

export function finalChangelogResponseToChangelog(items: FinalChangelogData[]): FinalChangelog {
  const slidesMap = new Map<string, ChangelogSlide>();

  let itemsSkipped = 0;
  let itemsManualReviewed = 0;

  for (const item of items) {
    const slideId = `${item.slideId}#0`;
    const slideNumber = item.slideNumber;

    if (!slidesMap.has(slideId)) {
      slidesMap.set(slideId, { slideId, slideNumber, items: [] });
    }
    const slide = slidesMap.get(slideId)!;

    const change: ChangelogItem = changelogItemResponseToChangelogItem(item, [slideId]);

    slide.items.push(change);

    if (change.action === "skip") itemsSkipped += 1;
  }

  const slides = Array.from(slidesMap.values()).sort((a, b) => a.slideNumber - b.slideNumber);

  return {
    slides: annotateSiblingOccurrences(slides),
    slidesModified: slides.length,
    itemsModified: items.length,
    itemsSkipped,
    itemsManualReviewed,
  };
}
