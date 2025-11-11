import type {
  HighlightSize,
  ReplaceBaseData,
  ReplaceItemBase,
  ReplaceTextData,
} from "../types/presentationService.ts";
import { MarkerService } from "./Marker.service.ts";
import {
  COLOR_TOLERANCE,
  decodeBase64PngToCanvas,
  DEFAULT_VERTICAL_OVERLAP_THRESHOLD_RATIO,
  findColorComponentsBoundingBoxesPx,
  FORCE_BOLD_FOR_SNAPSHOT,
  getHighlightColor,
  hexToRgb,
  HIGHLIGHT_PREFIX,
  IMAGE_BORDER_OFFSET,
  isTextReplaceData,
  MARKER_FRAME_HEX,
  MARKER_OPPOSITE_HEX,
  MARKER_TEXT_HEX,
  mergeComponentsIntoLines,
  normalizeBoundingBoxesVertically,
  pxRectToPointsWithinShape,
  SLIDE_EXPORT_WIDTH,
  TEXT_BORDER_OFFSET,
  type VerticalMergeStrategy,
} from "./utils/highlighting-utils.ts";
import { caseInsensitiveIndexOf } from "./utils/marker-utils.ts";

const VERTICAL_MERGE_STRATEGY: VerticalMergeStrategy = "average";
const VERTICAL_OVERLAP_THRESHOLD_RATIO: number = DEFAULT_VERTICAL_OVERLAP_THRESHOLD_RATIO;
const HIGHLIGHT_LINE_WEIGHT = 3;

export class HighlightingService {
  private static async drawHighlightBorder(
    slide: PowerPoint.Slide,
    size: HighlightSize,
    item: ReplaceItemBase<ReplaceBaseData>,
    isImage?: boolean
  ) {
    const offset = isImage ? IMAGE_BORDER_OFFSET : TEXT_BORDER_OFFSET;

    const sizeWithOffset = {
      left: size.left - offset,
      top: size.top - offset,
      width: size.width + offset * 2,
      height: size.height + offset * 2,
    };

    const color = getHighlightColor(!!item.data.isApplied, item.data.priority);
    const name = `${HIGHLIGHT_PREFIX}::${item.shapeId}::${item.id}`;

    const rectangleShape = slide.shapes.addGeometricShape(
      PowerPoint.GeometricShapeType.rectangle,
      sizeWithOffset
    );

    rectangleShape.name = name;

    rectangleShape.lineFormat.visible = true;
    rectangleShape.lineFormat.color = color;
    rectangleShape.lineFormat.weight = HIGHLIGHT_LINE_WEIGHT;

    try {
      rectangleShape.fill.transparency = 1;
    } catch {}
  }

  static async highlightShape(
    slide: PowerPoint.Slide,
    shape: PowerPoint.Shape,
    item: ReplaceItemBase<ReplaceBaseData>,
    context: PowerPoint.RequestContext
  ) {
    shape.load(["id", "type", "left", "top", "width", "height"]);
    await context.sync();

    const size: HighlightSize = {
      left: shape.left,
      top: shape.top,
      width: shape.width,
      height: shape.height,
    };

    await HighlightingService.drawHighlightBorder(slide, size, item);
    await context.sync();
  }

  static async highlightTableShape(
    slide: PowerPoint.Slide,
    shape: PowerPoint.Shape,
    item: ReplaceItemBase<ReplaceBaseData>,
    context: PowerPoint.RequestContext
  ) {
    shape.load(["id", "type", "left", "top", "width", "height"]);
    await context.sync();

    const size: HighlightSize = {
      left: shape.left,
      top: shape.top,
      width: shape.width,
      height: shape.height,
    };

    await HighlightingService.drawHighlightBorder(slide, size, item);
    await context.sync();
  }

  private static async updateHighlightColor(
    slide: PowerPoint.Slide,
    fingerprint: string,
    color: string,
    context: PowerPoint.RequestContext
  ) {
    const shapes = slide.shapes;
    shapes.load("items");
    await context.sync();

    for (const shape of shapes.items) {
      if (shape.name === fingerprint) {
        shape.lineFormat.color = color;
      }
    }
  }

  static async highlightTextShape(
    slide: PowerPoint.Slide,
    shape: PowerPoint.Shape,
    item: ReplaceItemBase<ReplaceTextData>,
    isMasterSlideShape: boolean,
    context: PowerPoint.RequestContext
  ) {
    slide.load("shapes/items");
    await context.sync();

    let sizes: HighlightSize[];

    if (isMasterSlideShape) {
      sizes = [
        {
          left: shape.left,
          top: shape.top,
          width: shape.width,
          height: shape.height,
        },
      ];
    } else {
      sizes = await HighlightingService.getSubstringBoundingBoxesForText(
        item,
        slide,
        shape,
        context
      );
    }

    await context.sync();
    if (sizes.length) {
      try {
        await HighlightingService.deleteHighlightShape(
          slide,
          `${HIGHLIGHT_PREFIX}::${item.shapeId}::${item.id}`,
          context
        );
      } catch {}
    }

    await context.sync();
    for (const size of sizes) {
      await HighlightingService.drawHighlightBorder(slide, size, item);
    }
    await context.sync();
  }

  static async clearHighlights() {
    try {
      await PowerPoint.run(async (context) => {
        const presentation = context.presentation;
        const slides = presentation.slides;
        slides.load("items");
        await context.sync();

        for (const slide of slides.items) {
          const shapes = slide.shapes;
          shapes.load("items");
          await context.sync();

          for (const shape of shapes.items) {
            if (shape.name.startsWith(HIGHLIGHT_PREFIX)) {
              shape.delete();
            }
          }
        }

        await context.sync();
      });
    } catch (error) {
      throw new Error("[clearHighlights] failed", { cause: error });
    }
  }

  static async toggleHighlights(visible: boolean) {
    try {
      await PowerPoint.run(async (context) => {
        const presentation = context.presentation;
        const slides = presentation.slides;
        slides.load("items");
        await context.sync();

        for (const slide of slides.items) {
          const shapes = slide.shapes;
          shapes.load("items");
          await context.sync();

          for (const shape of shapes.items) {
            if (shape.name.startsWith(HIGHLIGHT_PREFIX)) {
              shape.load(["lineFormat/visible", "lineFormat/weight", "lineFormat/color"]);
              await context.sync();
              shape.lineFormat.weight = visible ? HIGHLIGHT_LINE_WEIGHT : 0;
              shape.lineFormat.transparency = visible ? 0 : 1;
            }
          }
        }

        await context.sync();
      });
    } catch (error) {
      console.warn("[hideHighlights] failed", error);
    }
  }

  private static async deleteHighlightShape(
    slide: PowerPoint.Slide,
    fingerprint: string,
    context: PowerPoint.RequestContext
  ) {
    // Load ids and names in a single batch
    slide.shapes.load("items/id,items/name");
    await context.sync();

    // Collect ids to delete; do not mutate the collection while iterating it
    const idsToDelete: string[] = [];
    for (const shape of slide.shapes.items) {
      if (shape.name === fingerprint) {
        idsToDelete.push(shape.id);
      }
    }

    if (idsToDelete.length === 0) {
      return; // Nothing to delete
    }

    // Delete by id; avoid syncs inside the loop
    for (const shapeId of idsToDelete) {
      const target = slide.shapes.getItem(shapeId);
      target.delete();
    }

    await context.sync();
  }

  static async updateHighlight(
    slide: PowerPoint.Slide,
    shape: PowerPoint.Shape,
    item: ReplaceItemBase<ReplaceBaseData | ReplaceTextData>,
    isMasterSlideShape: boolean,
    context: PowerPoint.RequestContext
  ) {
    try {
      if (shape.type === PowerPoint.ShapeType.image || shape.type === PowerPoint.ShapeType.chart) {
        await HighlightingService.updateHighlightColor(
          slide,
          `${HIGHLIGHT_PREFIX}::${item.shapeId}::${item.id}`,
          getHighlightColor(!!item.data.isApplied, item.data.priority),
          context
        );

        return;
      }

      if (shape.type === PowerPoint.ShapeType.table) {
        await HighlightingService.updateHighlightColor(
          slide,
          `${HIGHLIGHT_PREFIX}::${item.shapeId}::${item.id}`,
          getHighlightColor(!!item.data.isApplied, item.data.priority),
          context
        );

        return;
      }

      if (!isTextReplaceData(item.data)) {
        throw new Error(
          `[updateHighlight] initialText not found in item data. Item id=${item.id} shapeId=${item.shapeId}, slideId=${item.slideId}`
        );
      }

      await HighlightingService.highlightTextShape(
        slide,
        shape,
        item as ReplaceItemBase<ReplaceTextData>,
        isMasterSlideShape,
        context
      );

      await context.sync();
    } catch (error) {
      throw new Error("[updateHighlight] failed", { cause: error });
    }
  }

  /**
   * Apply marker color (and optional bold) to the occurrence of `initialText`
   * inside a TEXT shape. Returns true if the substring was found and marked.
   * This modifies the passed shape in-place.
   */
  private static async colorSubstringOnTextShape(
    shape: PowerPoint.Shape,
    item: ReplaceItemBase<ReplaceTextData>,
    context: PowerPoint.RequestContext
  ): Promise<boolean> {
    try {
      if (!item.data.initialText) {
        throw Error("[colorSubstringOnTextShape] No initialText in item data");
      }

      if (!shape.textFrame || !shape.textFrame.textRange) {
        throw Error("[colorSubstringOnTextShape] Shape is not a text shape");
      }

      shape.load(["textFrame/textRange/text"]);
      await context.sync();

      const fullText = shape.textFrame.textRange.text;

      if (fullText.length === 0) {
        throw Error("[colorSubstringOnTextShape] Shape has no text");
      }

      let startIndex: number;
      let itemLength: number;

      if ("hasSiblings" in item.data && item.data.hasSiblings) {
        const { rawStart, rawLength } = await MarkerService.findTargetRangeInShape(
          shape,
          item,
          context
        );
        startIndex = rawStart;
        itemLength = rawLength;
      } else {
        startIndex = caseInsensitiveIndexOf(fullText, item.data.initialText);
        itemLength = item.data.initialText.length;
      }

      if (startIndex < 0) {
        throw Error(
          `[colorSubstringOnTextShape] Initial text not found in shape text (initialText=${item.data.initialText}, fullText=${fullText})`
        );
      }

      const paragraphStart =
        Math.max(fullText.lastIndexOf("\r", startIndex), fullText.lastIndexOf("\n", startIndex)) +
        1;
      const nextCr = fullText.indexOf("\r", startIndex);
      const nextLf = fullText.indexOf("\n", startIndex);
      const nextParagraphBoundary =
        [nextCr, nextLf].filter((n) => n >= 0).sort((a, b) => a - b)[0] ?? fullText.length;
      const paragraphEndExclusive = Math.min(nextParagraphBoundary, fullText.length);

      if (paragraphStart >= paragraphEndExclusive) {
        throw Error("[colorSubstringOnTextShape] Paragraph not found in shape text");
      }

      const paragraphLength = paragraphEndExclusive - paragraphStart;

      const paragraphRange = shape.textFrame.textRange.getSubstring(
        paragraphStart,
        paragraphLength
      );

      const localStart = startIndex - paragraphStart;
      const localLength = Math.min(itemLength, Math.max(0, paragraphLength - localStart));
      if (localLength <= 0) {
        throw Error("[colorSubstringOnTextShape] Invalid text length");
      }

      const target = paragraphRange.getSubstring(localStart, localLength);

      target.load(["font/bold", "font/color"]);
      await context.sync();
      target.font.color = MARKER_TEXT_HEX;

      if (FORCE_BOLD_FOR_SNAPSHOT) {
        target.font.bold = true;
      }

      await context.sync();
      return true;
    } catch (error) {
      throw new Error("[colorSubstringOnTextShape] failed", { cause: error });
    }
  }

  private static async getLastSlideData(
    context: PowerPoint.RequestContext
  ): Promise<{ id: string; index: number }> {
    const slides = context.presentation.slides;
    slides.load("items");
    await context.sync();

    const lastSlide = slides.items[slides.items.length - 1];
    lastSlide.load(["id", "index"]);
    await context.sync();

    return { id: lastSlide.id, index: lastSlide.index };
  }

  static async getSubstringBoundingBoxesForText(
    item: ReplaceItemBase<ReplaceTextData>,
    slide: PowerPoint.Slide,
    originalShape: PowerPoint.Shape,
    context: PowerPoint.RequestContext
  ): Promise<Array<{ left: number; top: number; width: number; height: number }>> {
    let duplicatedSlide: PowerPoint.Slide | null = null;
    try {
      const { slideId, shapeId, data, id } = item;
      const { initialText } = data;

      if (!initialText || initialText.length === 0) {
        throw new Error("[getSubstringBoundingBoxesForTextShape] initialText is empty.");
      }

      const textRgb = hexToRgb(MARKER_TEXT_HEX);
      const frameRgb = hexToRgb(MARKER_FRAME_HEX);

      let exportedBase64: string | null = null;

      let shapePtLeft = 0;
      let shapePtTop = 0;
      let shapePtWidth = 0;
      let shapePtHeight = 0;

      const presentation = context.presentation;
      slide.load(["index"]);

      // Load original text shape and build its fingerprint
      const originalName = originalShape.name || "";
      const shapeFingerprint = `FINGERPRINT::${slideId}::${shapeId}::${id}`;
      originalShape.name = shapeFingerprint;

      // 1) Export the current slide as base64 PPTX and insert it right after as a duplicate
      const lastSlideData = await this.getLastSlideData(context);
      const slideIndex = lastSlideData.index;
      const slidePptxB64 = slide.exportAsBase64(); // PPTX with this single slide
      await context.sync();

      const destIndex = slideIndex + 1;
      presentation.insertSlidesFromBase64(slidePptxB64.value, {
        targetSlideId: lastSlideData.id,
        formatting: PowerPoint.InsertSlideFormatting.keepSourceFormatting,
      });
      originalShape.name = originalName;
      await context.sync();

      // 2) Pick the duplicated slide and hide it
      duplicatedSlide = presentation.slides.getItemAt(destIndex);
      await context.sync();

      // 3) Find the corresponding text shape on the duplicate by fingerprint
      const dubSlideShapes = duplicatedSlide.shapes;
      dubSlideShapes.load("items");
      await context.sync();
      const dupShape = dubSlideShapes.items.find((shape) => shape.name === shapeFingerprint);

      if (!dupShape) {
        try {
          duplicatedSlide.delete();
          duplicatedSlide = null;
        } catch {}
        await context.sync();
        exportedBase64 = null;
        return [];
      }

      // 4) Color the target substring on the DUPLICATE (no rollback needed)
      const isPainted = await this.colorSubstringOnTextShape(dupShape, item, context);

      if (!isPainted) {
        try {
          duplicatedSlide.delete();
          duplicatedSlide = null;
        } catch {}
        await context.sync();
        exportedBase64 = null;
        return [];
      }

      // 5) Temporary frame around the DUPLICATE shape for region detection
      dupShape.load(["left", "top", "width", "height", "textFrame/textRange/font"]);
      await context.sync();

      const frame = duplicatedSlide.shapes.addGeometricShape(
        PowerPoint.GeometricShapeType.rectangle
      );
      frame.left = dupShape.left;
      frame.top = dupShape.top;
      frame.width = dupShape.width;
      frame.height = dupShape.height;

      frame.lineFormat.weight = 3;
      frame.lineFormat.color = MARKER_FRAME_HEX;

      dupShape.fill.setSolidColor(MARKER_OPPOSITE_HEX);

      // Geometry (points) to convert PX → PT later
      shapePtLeft = dupShape.left;
      shapePtTop = dupShape.top;
      shapePtWidth = dupShape.width;
      shapePtHeight = dupShape.height;

      try {
        frame.fill.transparency = 1;
        await context.sync();
      } catch {}

      // 6) Export the DUPLICATE slide as PNG (base64)
      const slideImage = duplicatedSlide.getImageAsBase64({ width: SLIDE_EXPORT_WIDTH });
      await context.sync();
      exportedBase64 = slideImage.value || null;

      // 7) Remove the duplicate slide
      try {
        duplicatedSlide.delete();
        duplicatedSlide = null;
      } catch {}
      await context.sync();

      if (!exportedBase64) {
        return [];
      }

      const {
        canvasContext,
        width: imageWidth,
        height: imageHeight,
      } = await decodeBase64PngToCanvas(exportedBase64);

      // 1) Find the shape frame bbox (in pixels) to limit the search region
      const frameComponents = findColorComponentsBoundingBoxesPx(
        canvasContext,
        imageWidth,
        imageHeight,
        frameRgb,
        COLOR_TOLERANCE
      );
      if (frameComponents.length === 0) {
        return [];
      }
      // The frame is a rectangle, but anti-aliased; the outermost bbox of all frame components approximates the shape area
      const shapePxRect = (() => {
        const minX = Math.min(...frameComponents.map((b) => b.x));
        const minY = Math.min(...frameComponents.map((b) => b.y));
        const maxX = Math.max(...frameComponents.map((b) => b.x + b.width));
        const maxY = Math.max(...frameComponents.map((b) => b.y + b.height));
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
      })();

      // 2) Find ALL text components for the marker color inside the shape region
      const textComponents = findColorComponentsBoundingBoxesPx(
        canvasContext,
        imageWidth,
        imageHeight,
        textRgb,
        COLOR_TOLERANCE,
        shapePxRect
      );
      if (textComponents.length === 0) {
        return [];
      }

      // 3) Merge components that belong to the same wrapped line into single line boxes (in pixels)
      const lineBoxesPx = mergeComponentsIntoLines(textComponents);
      if (lineBoxesPx.length === 0) {
        return [];
      }

      // 4) Convert each pixel box into points within the shape and return the list
      const result = lineBoxesPx.map((boxPx) => {
        return pxRectToPointsWithinShape(boxPx, shapePxRect, {
          left: shapePtLeft,
          top: shapePtTop,
          width: shapePtWidth,
          height: shapePtHeight,
        });
      });

      const normalizeBoundingBoxes = normalizeBoundingBoxesVertically(
        result,
        VERTICAL_MERGE_STRATEGY,
        VERTICAL_OVERLAP_THRESHOLD_RATIO,
        dupShape.textFrame.textRange.font.size
      );

      const sizes = normalizeBoundingBoxes.map((size) => {
        const lineHeight = dupShape.textFrame.textRange.font.size
          ? Math.round(dupShape.textFrame.textRange.font.size * 0.7)
          : size.height;

        const isShapeHeight = dupShape.height / lineHeight < 2;
        const heightNormalizeKoeff = isShapeHeight ? lineHeight * 0.15 : 0;
        return {
          ...size,
          top: size.top - heightNormalizeKoeff,
          height: lineHeight,
        };
      });

      return sizes;
    } finally {
      if (duplicatedSlide) {
        duplicatedSlide.delete();
      }
    }
  }

  static async repositionSiblingHighlighting(
    shape: PowerPoint.Shape,
    slide: PowerPoint.Slide,
    sibling: ReplaceItemBase<ReplaceTextData>,
    context: PowerPoint.RequestContext
  ): Promise<void> {
    try {
      if (!shape.textFrame || !shape.textFrame.textRange) {
        throw new Error(
          `[repositionSiblingHighlighting] Target is not a text shape. id=${sibling.id}, shapeId=${sibling.shapeId}, slideId=${sibling.slideId}`
        );
      }

      // 1) Detect line boxes by existing marker (POSITION BY MARKER)
      const sizes = await HighlightingService.getSubstringBoundingBoxesForText(
        sibling,
        slide,
        shape,
        context
      );

      if (sizes.length) {
        try {
          await HighlightingService.deleteHighlightShape(
            slide,
            `${HIGHLIGHT_PREFIX}::${sibling.shapeId}::${sibling.id}`,
            context
          );
        } catch (error) {}
      }

      for (const size of sizes) {
        await HighlightingService.drawHighlightBorder(slide, size, sibling);
      }
      await context.sync();
    } catch (error) {
      const msg = `[repositionSiblingHighlighting] failed for id=${sibling.id}, shapeId=${sibling.shapeId}, slideId=${sibling.slideId}, initialText=${sibling.data.initialText ?? ""}, occurrenceIndex=${sibling.data.occurrenceIndex ?? ""}`;
      console.warn(msg, error);
    }
  }
}
