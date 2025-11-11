type SlideNumber = number;
type ImageBase64 = string; // base64-encoded image

export type Priority = "high" | "medium" | "low" | "veryLow" | "unknown";
export type Type = "text" | "range" | "image" | "unknown";
export type TreatmentAction = "replace" | "obfuscate" | "redact" | "skip";
export type ConfidenceScore = "certain" | "likely" | "unclear" | "uncertain";
export type ShapeType = "text" | "chart" | "image" | "table" | "unknown";

export interface ChartSeries {
  name: string;
  values: number[];
}

export interface ChartData {
  title?: string | null;
  categories: string[];
  series: ChartSeries[];
}

export interface ChangelogItem {
  id: number;
  slideId: string;
  slideNumber: number;
  priority: Priority;
  type: Type;
  action: TreatmentAction;
  confidenceScore: ConfidenceScore;
  category: string;
  rationale: string;
  initialValue: string;
  proposedValue: string;
  groupId: number | null;
  isApplied: boolean;
  shapeId: string;
  shapeType: ShapeType;
  userChange?: string | null;
  startIndex?: number | null;
  row?: number | null;
  column?: number | null;
  chartProposedValue: ChartData | string;
  chartInitialValue: ChartData | string;
  error?: {
    message?: string;
    error?: Error;
  } | null;
  hasSibling?: boolean;
  occurrenceIndex?: number;
  siblings?: { id: number; initialText: string | null | undefined; occurrenceIndex?: number }[];
}

export interface ChangelogSlide {
  slideId: string;
  slideNumber: number;
  items: ChangelogItem[];
}

export interface Changelog {
  slides: ChangelogSlide[];
  totalItems: number;
  highPriorityItems: number;
  mediumPriorityItems: number;
  lowPriorityItems: number;
  veryLowPriorityItems: number;
}

export interface FinalChangelog {
  slides: ChangelogSlide[];
  slidesModified: number;
  itemsModified: number;
  itemsSkipped: number;
  itemsManualReviewed: number;
}

export type IllustrationCollection = Record<SlideNumber, ImageBase64>;

export type GroupId = number;

export interface ChangelogGroup {
  groupId: number;
  category: string;
  value: string;
  items: ChangelogItem[];
}

export interface ChangelogByCategory {
  [category: string]: {
    groups: Record<GroupId, ChangelogGroup>;
    totalItems: number;
  };
}
