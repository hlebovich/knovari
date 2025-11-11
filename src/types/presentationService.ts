import type { Priority } from "./changelog.ts";

export type SlideId = string; // e.g. "256#0"
export type ReplaceItemBase<T extends ReplaceBaseData> = {
  slideId: string;
  shapeId: string;
  id: number;
  data: T;
};
export type ReplaceBaseData = {
  shapeId?: string | null;
  priority: Priority;
  isApplied?: boolean;
};
export type ReplaceMaskData = ReplaceBaseData & { text: string };
export type RevertImageData = ReplaceBaseData & { initialShapeId: string };
export type SiblingData = ReplaceBaseData & {
  id: number;
  initialText?: string | null;
  occurrenceIndex?: number | null;
};
export type ReplaceTextData = ReplaceBaseData & {
  initialText?: string | null;
  proposedText: string;
  occurrenceIndex?: number | null;
  hasSiblings?: boolean;
  siblings?: (ReplaceTextData & { id: number })[];
};
export type BaseTableData = ReplaceBaseData & {
  startIndex?: number | null;
  row?: number | null;
  column?: number | null;
  occurrenceIndex?: number | null;
  hasSiblings?: boolean;
  siblings?: SiblingData[];
};
export type ReplaceTableData = BaseTableData & {
  initialText?: string | null;
  proposedText: string;
};
export type RevertTableData = BaseTableData & {
  initialText?: string | null;
  proposedText?: string | null;
  proposedTextRuns: PowerPoint.TextRun[] | null;
};

export type UnprocessedItem = { itemId: number; message?: string; cause?: Error };

export type LoadedReplaceShape<T> = {
  id: number;
  slideId: SlideId;
  shape: PowerPoint.Shape;
  data: T;
};

export type HighlightSize = { left: number; top: number; width: number; height: number };
