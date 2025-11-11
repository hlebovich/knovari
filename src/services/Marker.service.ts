import type { ChangelogSlide } from "../types/changelog.ts";
import type {
  ReplaceItemBase,
  ReplaceTableData,
  ReplaceTextData,
  RevertTableData,
} from "../types/presentationService.ts";
import {
  buildEndMarker,
  buildStartMarker,
  buildTargets,
  caseInsensitiveIndexOf,
  clearMarkersAndBuildIndexMap,
  findOccurrenceStartIndex,
  getGenericMarkerRegExp,
  hasMarkersForId,
} from "./utils/marker-utils.ts";
import { copyTextRunFont, formatTextRuns } from "./utils/presentation-utils.ts";

export class MarkerService {
  /**
   * Remove all zero‑width markers from the shape text, if any exist.
   * This is used in the no‑siblings flow to guarantee a clean string without markers.
   * Returns true if any markers were removed.
   */
  private static async clearMarkersFromShape(
    shape: PowerPoint.Shape,
    context: PowerPoint.RequestContext
  ): Promise<number> {
    shape.textFrame.textRange.load("text");
    await context.sync();
    const raw = shape.textFrame.textRange.text;

    const regex = getGenericMarkerRegExp();
    const matches = Array.from(raw.matchAll(regex));
    if (matches.length === 0) {
      return 0;
    }

    // Remove from the end to the start so earlier indices remain valid
    for (let index = matches.length - 1; index >= 0; index--) {
      const match = matches[index];
      if (match.index == null) {
        continue;
      }
      const start = match.index;
      const length = match[0].length;
      const range = shape.textFrame.textRange.getSubstring(start, length);
      range.load("text");
      await context.sync();
      range.text = "";
      await context.sync();
    }

    return matches.length;
  }

  /**
   * Insert markers around a substring defined in RAW indices (which include any existing markers).
   * Kept private to encapsulate Office.js mutations inside the service.
   */
  private static async wrapSubstringWithMarkersForShape(
    shape: PowerPoint.Shape,
    rawStart: number,
    rawLength: number,
    id: number,
    context: PowerPoint.RequestContext
  ): Promise<void> {
    const substringRange = shape.textFrame.textRange.getSubstring(rawStart, rawLength);

    // Load current substring text to compose replacement safely
    substringRange.load("text");
    await context.sync();

    const original = substringRange.text;
    const startMarker = buildStartMarker(id);
    const endMarker = buildEndMarker(id);

    // Replace text with markers around it; formatting of the original substring is preserved by Office.js
    substringRange.text = startMarker + original + endMarker;

    await context.sync();
  }

  /**
   * Ensure that all markers for the current item and its siblings exist in the Shape's TextRange.
   * - Validates presence of initialText for each target.
   * - Uses occurrenceIndex when provided; otherwise uses the first occurrence.
   * - Preserves formatting by replacing only the target substring via TextRange.getSubstring().text assignment.
   */
  public static async addMarkersForShape(
    shape: PowerPoint.Shape,
    item: ReplaceItemBase<ReplaceTextData>,
    context: PowerPoint.RequestContext
  ): Promise<void> {
    // Build the work list: current item + siblings (if any)
    const targets = buildTargets(item);

    shape.textFrame.textRange.load("text");
    await context.sync();
    let rawText: string = shape.textFrame.textRange.text;

    for (let t = 0; t < targets.length; t++) {
      const target = targets[t];

      if (hasMarkersForId(rawText, target.id)) {
        continue;
      }

      const mapping = clearMarkersAndBuildIndexMap(rawText);
      const cleanStart = findOccurrenceStartIndex(
        mapping.cleanText,
        target.initialText,
        target.occurrenceIndex ?? null
      );

      if (cleanStart < 0) {
        throw new Error(
          `[ensureMarkersForTextRange] initialText not found | id=${target.id}, shapeId=${target.shapeId}, initialText="${target.initialText}", occurrenceIndex=${target.occurrenceIndex ?? "first"}`
        );
      }

      const cleanEnd = cleanStart + target.initialText.length;
      const rawStart = mapping.cleanToRawIndex[cleanStart];
      const rawEnd =
        cleanEnd < mapping.cleanToRawIndex.length
          ? mapping.cleanToRawIndex[cleanEnd]
          : rawText.length;
      const rawLength = rawEnd - rawStart;

      await MarkerService.wrapSubstringWithMarkersForShape(
        shape,
        rawStart,
        rawLength,
        target.id,
        context
      );

      // Refresh rawText for subsequent targets
      shape.textFrame.textRange.load("text");
      await context.sync();
      rawText = shape.textFrame.textRange.text;
    }
  }

  /**
   * Find raw substring range for the target item inside the shape.
   * If hasSiblings === true: prefer marker-based lookup (and ensure markers exist).
   * If hasSiblings !== true: perform plain text lookup using clean→raw mapping.
   * Returns the range without marker tokens (inner payload only) and the strategy used.
   */
  static async findTargetRangeInShape(
    shape: PowerPoint.Shape,
    item: ReplaceItemBase<ReplaceTextData>,
    context: PowerPoint.RequestContext
  ): Promise<{ rawStart: number; rawLength: number; foundBy: "marker" | "text" }> {
    if (!item || !item.data || !item.data.initialText) {
      throw new Error(
        `[findTargetRangeInShape] Missing initialText | id=${item ? item.id : "unknown"}, shapeId=${item ? item.shapeId : "unknown"}, occurrenceIndex=${item && item.data ? (item.data.occurrenceIndex ?? "first") : "unknown"}`
      );
    }

    if (!item.data.hasSiblings) {
      // No siblings: first ensure the shape text is free from any markers, then do a plain lookup
      await MarkerService.clearMarkersFromShape(shape, context);
      shape.textFrame.textRange.load("text");
      await context.sync();
      const shapeText = shape.textFrame.textRange.text;

      const rawIndex = caseInsensitiveIndexOf(shapeText, item.data.initialText);
      if (rawIndex < 0) {
        throw new Error(
          `[findTargetRangeInShape] initialText not found (no siblings flow) | id=${item.id}, shapeId=${item.shapeId}, initialText="${item.data.initialText}"`
        );
      }
      return { rawStart: rawIndex, rawLength: item.data.initialText.length, foundBy: "text" };
    }

    // Load current raw text
    shape.textFrame.textRange.load("text");
    await context.sync();
    let rawText: string = shape.textFrame.textRange.text;

    // Ensure markers are present; if not, place them for item and siblings
    if (!hasMarkersForId(rawText, item.id)) {
      await MarkerService.addMarkersForShape(shape, item, context);
      shape.textFrame.textRange.load("text");
      await context.sync();
      rawText = shape.textFrame.textRange.text;
    }

    const startMarker = buildStartMarker(item.id);
    const endMarker = buildEndMarker(item.id);

    const startIndex = rawText.indexOf(startMarker);
    if (startIndex < 0) {
      throw new Error(
        `[findTargetRangeInShape] START marker not found | id=${item.id}, shapeId=${item.shapeId}, initialText="${item.data.initialText}", occurrenceIndex=${item.data.occurrenceIndex ?? "first"}`
      );
    }
    const contentStart = startIndex + startMarker.length;
    const endIndex = rawText.indexOf(endMarker, contentStart);
    if (endIndex < 0) {
      throw new Error(
        `[findTargetRangeInShape] END marker not found | id=${item.id}, shapeId=${item.shapeId}, initialText="${item.data.initialText}", occurrenceIndex=${item.data.occurrenceIndex ?? "first"}`
      );
    }

    return { rawStart: contentStart, rawLength: endIndex - contentStart, foundBy: "marker" };
  }

  public static async replaceTextInShape(
    shape: PowerPoint.Shape,
    item: ReplaceItemBase<ReplaceTextData>,
    isMasterSlideShape: boolean,
    context: PowerPoint.RequestContext
  ): Promise<void> {
    if (isMasterSlideShape) {
      if (!item || !item.data || !item.data.initialText) {
        throw new Error(
          `[replaceTextInShape] Missing initialText | id=${item.id}, shapeId=${item.shapeId}, occurrenceIndex=${item.data.occurrenceIndex}`
        );
      }
      const shapeFullText = shape.textFrame.textRange.text;
      const substringIndex = caseInsensitiveIndexOf(shapeFullText, item.data.initialText);
      const substringEndIndex = substringIndex + item.data.initialText.length;
      shape.textFrame.textRange.text = `${shapeFullText.slice(0, substringIndex)}${shapeFullText.slice(substringIndex, substringEndIndex)}${shapeFullText.slice(substringEndIndex)}`;
    }

    const range = await MarkerService.findTargetRangeInShape(shape, item, context);

    const substringRange = shape.textFrame.textRange.getSubstring(range.rawStart, range.rawLength);
    substringRange.load("text");
    await context.sync();

    // Replace text according to the business rule: always replace inside the determined range
    substringRange.text = item.data.proposedText;

    await context.sync();
  }

  // =============================
  // SimpleCell (table cell WITHOUT TextRuns)
  // =============================

  /**
   * Remove all markers from simple cell text by assigning the cleaned string.
   * Returns the number of marker tokens removed.
   */
  private static async clearMarkersFromSimpleCell(
    cell: PowerPoint.TableCell,
    context: PowerPoint.RequestContext
  ): Promise<number> {
    cell.load(["text"]);
    await context.sync();
    const raw = cell.text || "";

    const regex = getGenericMarkerRegExp();
    const matches = Array.from(raw.matchAll(regex));
    if (matches.length === 0) {
      return 0;
    }

    const mapping = clearMarkersAndBuildIndexMap(raw);
    cell.text = mapping.cleanText;
    await context.sync();

    return matches.length;
  }

  /**
   * Wrap a raw substring of a simple cell with START/END markers, preserving the visible text order.
   */
  private static async wrapSubstringWithMarkersInSimpleCell(
    cell: PowerPoint.TableCell,
    rawStart: number,
    rawLength: number,
    id: number,
    context: PowerPoint.RequestContext
  ): Promise<void> {
    cell.load(["text"]);
    await context.sync();
    const raw = cell.text || "";

    const startMarker = buildStartMarker(id);
    const endMarker = buildEndMarker(id);

    const before = raw.slice(0, rawStart);
    const inside = raw.slice(rawStart, rawStart + rawLength);
    const after = raw.slice(rawStart + rawLength);

    cell.text = before + startMarker + inside + endMarker + after;

    await context.sync();
  }

  /**
   * Ensure markers in a simple cell string for the current item and its siblings (if any).
   * Uses clean→raw mapping to avoid interference with existing markers.
   */
  public static async addMarkersForSimpleCell(
    cell: PowerPoint.TableCell,
    item: ReplaceItemBase<ReplaceTableData | RevertTableData>,
    context: PowerPoint.RequestContext
  ): Promise<void> {
    cell.load(["text"]);
    await context.sync();
    let rawText = cell.text || "";

    const targets = buildTargets(item);

    for (let t = 0; t < targets.length; t++) {
      const target = targets[t];

      if (hasMarkersForId(rawText, target.id)) {
        continue;
      }

      const mapping = clearMarkersAndBuildIndexMap(rawText);
      const cleanStart = findOccurrenceStartIndex(
        mapping.cleanText,
        target.initialText,
        target.occurrenceIndex ?? 0
      );
      if (cleanStart < 0) {
        throw new Error(
          `[addMarkersForSimpleCell] initialText not found | id=${target.id}, shapeId=${item.shapeId}, initialText="${target.initialText}", occurrenceIndex=${target.occurrenceIndex ?? "first"}`
        );
      }

      const cleanEnd = cleanStart + target.initialText.length;
      const rawStart = mapping.cleanToRawIndex[cleanStart];
      const rawEnd =
        cleanEnd < mapping.cleanToRawIndex.length
          ? mapping.cleanToRawIndex[cleanEnd]
          : rawText.length;
      const rawLength = rawEnd - rawStart;

      await MarkerService.wrapSubstringWithMarkersInSimpleCell(
        cell,
        rawStart,
        rawLength,
        target.id,
        context
      );

      cell.load(["text"]);
      await context.sync();
      rawText = cell.text || "";
    }
  }

  /**
   * Find target range in a simple cell (no TextRuns), mirroring findTargetRange for shapes.
   * Validates inputs; branches on hasSiblings. Returns inner payload range (without markers).
   */
  private static async findTargetRangeInSimpleCell(
    cell: PowerPoint.TableCell,
    item: ReplaceItemBase<ReplaceTableData | RevertTableData>,
    context: PowerPoint.RequestContext
  ): Promise<{ rawStart: number; rawLength: number; foundBy: "marker" | "text" }> {
    if (!item || !item.data || !item.data.initialText) {
      throw new Error(
        `[findTargetRangeInSimpleCell] Missing initialText | id=${item ? item.id : "unknown"}, shapeId=${item ? item.shapeId : "unknown"}, occurrenceIndex=${item && item.data ? (item.data.occurrenceIndex ?? "first") : "unknown"}`
      );
    }

    if (!item.data.hasSiblings) {
      await MarkerService.clearMarkersFromSimpleCell(cell, context);
      cell.load(["text"]);
      await context.sync();
      const text = cell.text || "";

      const index = caseInsensitiveIndexOf(text, item.data.initialText);
      if (index < 0) {
        throw new Error(
          `[findTargetRangeInSimpleCell] initialText not found (no siblings flow) | id=${item.id}, shapeId=${item.shapeId}, initialText="${item.data.initialText}"`
        );
      }
      return { rawStart: index, rawLength: item.data.initialText.length, foundBy: "text" };
    }

    await MarkerService.addMarkersForSimpleCell(cell, item, context);

    cell.load(["text"]);
    await context.sync();
    const raw = cell.text || "";

    const startMarker = buildStartMarker(item.id);
    const endMarker = buildEndMarker(item.id);

    const startIndex = raw.indexOf(startMarker);
    if (startIndex < 0) {
      throw new Error(
        `[findTargetRangeInSimpleCell] START marker not found | id=${item.id}, shapeId=${item.shapeId}, initialText="${item.data.initialText}", occurrenceIndex=${item.data.occurrenceIndex ?? "first"}`
      );
    }
    const contentStart = startIndex + startMarker.length;
    const endIndex = raw.indexOf(endMarker, contentStart);
    if (endIndex < 0) {
      throw new Error(
        `[findTargetRangeInSimpleCell] END marker not found | id=${item.id}, shapeId=${item.shapeId}, initialText="${item.data.initialText}", occurrenceIndex=${item.data.occurrenceIndex ?? "first"}`
      );
    }

    return { rawStart: contentStart, rawLength: endIndex - contentStart, foundBy: "marker" };
  }

  /**
   * Replace text in a simple table cell (no TextRuns), mirroring the shape flow.
   * - If hasSiblings !== true: clear markers from the cell, find the first case-insensitive occurrence, replace it.
   * - If hasSiblings === true: ensure markers for item + siblings, then replace strictly between markers for item.id.
   */
  public static async replaceTextInSimpleCell(
    cell: PowerPoint.TableCell,
    item: ReplaceItemBase<ReplaceTableData | RevertTableData>,
    context: PowerPoint.RequestContext
  ): Promise<void> {
    const range = await MarkerService.findTargetRangeInSimpleCell(cell, item, context);

    cell.load(["text"]);
    await context.sync();
    const rawText = cell.text || "";

    const before = rawText.slice(0, range.rawStart);
    const after = rawText.slice(range.rawStart + range.rawLength);
    cell.text = before + item.data.proposedText + after;

    await context.sync();
  }

  // =============================
  // FormattedCell (table cell WITH TextRuns)
  // =============================

  /**
   * Replace text in a formatted table cell (with TextRuns), mirroring the shape flow.
   * - If hasSiblings !== true: compute indices on clean text (ignore occurrenceIndex, first match),
   *   translate to raw, format runs preserving styles.
   * - If hasSiblings === true: ensure markers for item + siblings in runs, then compute indices by markers
   *   (indices include markers), and replace with proposed text wrapped by the same markers to keep them.
   */
  public static async replaceTextInFormattedCell(
    cell: PowerPoint.TableCell,
    item: ReplaceItemBase<ReplaceTableData>,
    context: PowerPoint.RequestContext
  ): Promise<{ initialTextRuns: PowerPoint.TextRun[] }> {
    cell.load(["textRuns", "font", "horizontalAlignment"]);
    await context.sync();

    const originalAlignment = cell.horizontalAlignment;

    if (!cell.textRuns || cell.textRuns.length === 0) {
      throw new Error(
        `[replaceTextInFormattedCell] No TextRuns found | id=${item.id}, shapeId=${item.shapeId}, initialText=${item.data?.initialText ?? "<empty>"}`
      );
    }

    const { proposedTextRuns, initialTextRuns } = await MarkerService.getUpdatedTextRuns(
      cell,
      item,
      context
    );

    cell.textRuns = proposedTextRuns;
    cell.horizontalAlignment = originalAlignment;
    await context.sync();

    return { initialTextRuns };
  }

  public static async revertTextInFormattedCell(
    cell: PowerPoint.TableCell,
    item: ReplaceItemBase<RevertTableData>,
    context: PowerPoint.RequestContext
  ): Promise<void> {
    cell.load(["textRuns", "horizontalAlignment"]);
    await context.sync();

    const originalAlignment = cell.horizontalAlignment;

    const textRuns = cell.textRuns;
    if (!textRuns || textRuns.length === 0) {
      throw new Error(
        `[revertTextInFormattedCell] No TextRuns found | id=${item.id}, shapeId=${item.shapeId}, initialText=${item.data?.initialText ?? "<empty>"}`
      );
    }

    const originalRuns = item.data.proposedTextRuns;
    if (!originalRuns || originalRuns.length === 0) {
      throw new Error(
        `[revertTextInFormattedCell] proposedTextRuns is missing or empty | id=${item.id}, shapeId=${item.shapeId}, initialText=${item.data?.initialText ?? "<empty>"}`
      );
    }

    const startMarker = buildStartMarker(item.id);
    const endMarker = buildEndMarker(item.id);

    const updatedRuns: PowerPoint.TextRun[] = [];
    let replaced = false;

    // Single-pass: scan and rebuild at once
    for (const textRun of textRuns) {
      const text = textRun.text;

      if (!replaced && text.includes(startMarker) && text.includes(endMarker)) {
        const startIndex = text.indexOf(startMarker);
        const endIndex = text.indexOf(endMarker) + endMarker.length;
        const before = text.slice(0, startIndex);
        const after = text.slice(endIndex);
        if (before.length > 0) {
          updatedRuns.push({
            text: before,
            font: copyTextRunFont(textRun.font, cell.font),
          });
        }

        updatedRuns.push(...originalRuns);

        if (after.length > 0) {
          updatedRuns.push({
            text: after,
            font: copyTextRunFont(textRun.font, cell.font),
          });
        }
        replaced = true;
        continue;
      }

      updatedRuns.push(textRun);
    }

    if (!replaced) {
      throw new Error(
        `[revertTextInFormattedCell] Marker-wrapped content not found in a single run | id=${item.id}, shapeId=${item.shapeId}, initialText=${item.data?.initialText ?? "<empty>"}`
      );
    }

    cell.textRuns = updatedRuns;
    cell.horizontalAlignment = originalAlignment;
    await context.sync();
  }

  /**
   * Compute updated TextRuns for a formatted cell.
   * Returns both the extracted initialTextRuns (diagnostic) and the final proposedTextRuns.
   */
  private static async getUpdatedTextRuns(
    cell: PowerPoint.TableCell,
    item: ReplaceItemBase<ReplaceTableData | RevertTableData>,
    context: PowerPoint.RequestContext
  ): Promise<{ initialTextRuns: PowerPoint.TextRun[]; proposedTextRuns: PowerPoint.TextRun[] }> {
    if (!item || !item.data || !item.data.initialText) {
      throw new Error(
        `[getUpdatedTextRuns] Missing initialText | id=${item ? item.id : "unknown"}, shapeId=${item ? item.shapeId : "unknown"}`
      );
    }

    cell.load(["textRuns", "font"]);
    await context.sync();

    let originalRuns = cell.textRuns || [];
    const cellFont = cell.font;

    let fullText = MarkerService.getTextRunsFullText(originalRuns);

    if (item.data.hasSiblings) {
      const withMarkers = MarkerService.addMarkersForFormattedCell(originalRuns, item, cell.font);
      if (withMarkers.length) {
        originalRuns = withMarkers;
        // Rebuild linear model after mutation
        fullText = MarkerService.getTextRunsFullText(originalRuns);
      }

      const startMarker = buildStartMarker(item.id);
      const endMarker = buildEndMarker(item.id);

      const startIndex = fullText.indexOf(startMarker);
      if (startIndex < 0) {
        throw new Error(
          `[getUpdatedTextRuns] START marker not found | id=${item.id}, shapeId=${item.shapeId}, initialText="${item.data.initialText}", occurrenceIndex=${item.data.occurrenceIndex ?? "first"}`
        );
      }
      const endMarkerIndex = fullText.indexOf(endMarker, startIndex + startMarker.length);
      if (endMarkerIndex < 0 || endMarkerIndex <= startIndex) {
        throw new Error(
          `[getUpdatedTextRuns] END marker not found or invalid | id=${item.id}, shapeId=${item.shapeId}, initialText="${item.data.initialText}", occurrenceIndex=${item.data.occurrenceIndex ?? "first"}`
        );
      }

      // Indices include markers by requirement
      const endIndex = endMarkerIndex + endMarker.length;

      // Keep markers by wrapping proposed text with the same markers
      const proposedWithMarkers = startMarker + item.data.proposedText + endMarker;

      return formatTextRuns(originalRuns, startIndex, endIndex, proposedWithMarkers, cellFont);
    }

    // No siblings: compute indices on CLEAN text, ignore occurrenceIndex, use first match
    const mapping = clearMarkersAndBuildIndexMap(fullText);
    const cleanStart = findOccurrenceStartIndex(mapping.cleanText, item.data.initialText, 0);
    if (cleanStart < 0) {
      throw new Error(
        `[getUpdatedTextRuns] initialText not found (no siblings flow) | id=${item.id}, shapeId=${item.shapeId}, initialText="${item.data.initialText}"`
      );
    }
    const cleanEnd = cleanStart + item.data.initialText.length;
    const rawStart = mapping.cleanToRawIndex[cleanStart];
    const rawEnd =
      cleanEnd < mapping.cleanToRawIndex.length
        ? mapping.cleanToRawIndex[cleanEnd]
        : fullText.length;

    return formatTextRuns(originalRuns, rawStart, rawEnd, item.data.proposedText || "", cellFont);
  }

  /**
   * Ensure markers for formatted cell TextRuns (in-memory runs array).
   * Returns new runs if any insertion occurred; otherwise returns null.
   */
  static addMarkersForFormattedCell(
    originalTextRuns: PowerPoint.TextRun[],
    item: ReplaceItemBase<ReplaceTableData | RevertTableData>,
    cellFont: PowerPoint.ShapeFont
  ): PowerPoint.TextRun[] {
    if (!Array.isArray(originalTextRuns) || originalTextRuns.length === 0) {
      return [];
    }

    let workingRuns: PowerPoint.TextRun[] = originalTextRuns.map((r) => ({
      text: r.text,
      font: copyTextRunFont(r.font, cellFont),
    }));

    const targets = buildTargets(item);

    for (const target of targets) {
      const fullText = MarkerService.getTextRunsFullText(workingRuns);
      if (hasMarkersForId(fullText, target.id)) {
        continue;
      }

      const mapping = clearMarkersAndBuildIndexMap(fullText);
      const cleanStart = findOccurrenceStartIndex(
        mapping.cleanText,
        target.initialText,
        target.occurrenceIndex ?? 0
      );
      if (cleanStart < 0) {
        throw new Error(
          `[addMarkersForFormattedCell] initialText not found | id=${target.id}, shapeId=${item.shapeId}, initialText="${target.initialText}", occurrenceIndex=${target.occurrenceIndex ?? "first"}`
        );
      }

      const cleanEnd = cleanStart + target.initialText.length;
      const rawStart = mapping.cleanToRawIndex[cleanStart];
      const rawEnd =
        cleanEnd < mapping.cleanToRawIndex.length
          ? mapping.cleanToRawIndex[cleanEnd]
          : fullText.length;

      // Insert END then START to preserve subsequent indices
      const endMarker = buildEndMarker(target.id);
      workingRuns = MarkerService.insertMarkerIntoRuns(
        workingRuns,
        rawEnd,
        endMarker,
        false,
        cellFont
      );

      const startMarker = buildStartMarker(target.id);
      workingRuns = MarkerService.insertMarkerIntoRuns(
        workingRuns,
        rawStart,
        startMarker,
        true,
        cellFont
      );
    }

    return workingRuns;
  }

  private static getTextRunsFullText(originalTextRuns: PowerPoint.TextRun[]): string {
    return originalTextRuns.map((textRun) => textRun.text).join("");
  }

  /**
   * Insert a string into the concatenated runs text at absolute index, preserving font styling.
   */
  private static insertMarkerIntoRuns(
    originalTextRuns: PowerPoint.TextRun[],
    absoluteIndex: number,
    marker: string,
    isStart: boolean,
    cellFont: PowerPoint.ShapeFont
  ): PowerPoint.TextRun[] {
    const result: PowerPoint.TextRun[] = [];
    let cursor = 0;

    for (const textRun of originalTextRuns) {
      const text = textRun.text;
      const nextCursor = cursor + text.length;

      if (absoluteIndex === cursor) {
        result.push({ text: marker + text, font: copyTextRunFont(textRun.font, cellFont) });

        cursor = nextCursor + marker.length;
        continue;
      }

      if (absoluteIndex === nextCursor) {
        if (isStart) {
          result.push({ text, font: copyTextRunFont(textRun.font, cellFont) });

          cursor = nextCursor;
          continue;
        } else {
          result.push({ text: text + marker, font: copyTextRunFont(textRun.font, cellFont) });

          cursor = nextCursor + marker.length;
          continue;
        }
      }

      if (absoluteIndex < cursor || absoluteIndex > nextCursor) {
        result.push({ text, font: copyTextRunFont(textRun.font, cellFont) });

        cursor = nextCursor;
        continue;
      }

      const localIndex = absoluteIndex - cursor;
      const before = text.slice(0, localIndex);
      const after = text.slice(localIndex);

      const textWithMarkers = before + marker + after;
      result.push({ text: textWithMarkers, font: copyTextRunFont(textRun.font, cellFont) });

      cursor = nextCursor + marker.length;
    }

    return result;
  }

  /**
   * Clean markers only for shapes present in the changelog (business mode).
   * Accepts an array of references containing shapeId (and optionally slideId).
   * Returns counters for cleaned shapes and total removed marker tokens.
   */
  public static async cleanMarkersByChangelog(
    changelogSlides: ChangelogSlide[]
  ): Promise<{ cleanedShapesCount: number; cleanedMatchesCount: number }> {
    let cleanedShapesCount = 0;
    let cleanedMatchesCount = 0;

    await PowerPoint.run(async (context) => {
      for (const slideEntry of changelogSlides) {
        const slide = context.presentation.slides.getItem(slideEntry.slideId);

        // Build unique set of shapeIds per slide
        const shapeIds = new Set<string>();
        for (const item of slideEntry.items) {
          if (item && item.shapeId.length > 0) {
            shapeIds.add(item.shapeId);
          }
        }

        for (const shapeId of Array.from(shapeIds)) {
          try {
            const shape = slide.shapes.getItem(shapeId);
            const removed = await MarkerService.clearMarkersFromShape(shape, context);
            if (removed > 0) {
              cleanedShapesCount = cleanedShapesCount + 1;
              cleanedMatchesCount = cleanedMatchesCount + removed;
            }
          } catch (error) {
            // If a shape is not resolvable on this slide, skip; changelog may be stale
          }
        }
      }
    });

    return { cleanedShapesCount, cleanedMatchesCount };
  }
}
