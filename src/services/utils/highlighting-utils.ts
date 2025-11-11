import type { Priority } from "../../types/changelog.ts";
import type { ReplaceBaseData, ReplaceTextData } from "../../types/presentationService.ts";
import { COLORS } from "../constants/presentation-constants.ts";

export const HIGHLIGHT_PREFIX = "HIGHLIGHT";
export const IMAGE_BORDER_OFFSET = 10;
export const TEXT_BORDER_OFFSET = 4;

export const MARKER_TEXT_HEX = "#FF00FF"; // color to mark text
export const MARKER_OPPOSITE_HEX = "#5a5a5a"; // color to mark text
export const MARKER_FRAME_HEX = "#00FFFF"; // color to mark frame area
export const COLOR_TOLERANCE = 24; // rgb antialiasing detection range
export const SLIDE_EXPORT_WIDTH = 2880; // px
// Force bold for snapshot to improve detection on thin italic fonts.
// Turn off if it ever causes layout shifts.
export const FORCE_BOLD_FOR_SNAPSHOT: boolean = true;

export type VerticalMergeStrategy = "first" | "average" | "first_start_union_height";

/** Default threshold for considering two boxes vertically overlapping enough to merge (relative to the smaller height). */
export const DEFAULT_VERTICAL_OVERLAP_THRESHOLD_RATIO: number = 0.3;

export function isTextReplaceData(data: ReplaceBaseData): data is ReplaceTextData {
  return "proposedText" in data;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m
    ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) }
    : { r: 255, g: 0, b: 255 };
}

function isNearColor(
  r: number,
  g: number,
  b: number,
  ref: { r: number; g: number; b: number },
  tolerance: number
): boolean {
  return (
    Math.abs(r - ref.r) <= tolerance &&
    Math.abs(g - ref.g) <= tolerance &&
    Math.abs(b - ref.b) <= tolerance
  );
}

export async function decodeBase64PngToCanvas(dataUrlOrBase64: string): Promise<{
  canvasContext: CanvasRenderingContext2D;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
}> {
  const dataUrl = `data:image/png;base64,${dataUrlOrBase64}`;

  const img = new Image();
  img.crossOrigin = "anonymous";
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load exported slide PNG"));
    img.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const canvasContext = canvas.getContext("2d", { willReadFrequently: true });
  if (!canvasContext) {
    throw new Error("Canvas 2D context is not available");
  }
  canvasContext.drawImage(img, 0, 0);
  return { canvasContext: canvasContext, width: canvas.width, height: canvas.height, canvas };
}

export function pxRectToPointsWithinShape(
  markerPx: { x: number; y: number; width: number; height: number },
  shapePx: { x: number; y: number; width: number; height: number },
  shapePt: { left: number; top: number; width: number; height: number }
): { left: number; top: number; width: number; height: number } {
  const scaleX = shapePt.width / shapePx.width;
  const scaleY = shapePt.height / shapePx.height;

  const left = shapePt.left + (markerPx.x - shapePx.x) * scaleX;
  const top = shapePt.top + (markerPx.y - shapePx.y) * scaleY;
  const width = markerPx.width * scaleX;
  const height = markerPx.height * scaleY;

  return { left, top, width, height };
}

/**
 * Finds all connected components (4-neighborhood) of pixels close to the given color.
 * Returns raw bounding boxes in pixels for each component, optionally limited to a region.
 */
export function findColorComponentsBoundingBoxesPx(
  context2d: CanvasRenderingContext2D,
  imageWidth: number,
  imageHeight: number,
  referenceColor: { r: number; g: number; b: number },
  tolerance: number,
  region?: { x: number; y: number; width: number; height: number }
): Array<{ x: number; y: number; width: number; height: number }> {
  const startX = region ? Math.max(0, Math.floor(region.x)) : 0;
  const startY = region ? Math.max(0, Math.floor(region.y)) : 0;
  const endX = region ? Math.min(imageWidth, Math.ceil(region.x + region.width)) : imageWidth;
  const endY = region ? Math.min(imageHeight, Math.ceil(region.y + region.height)) : imageHeight;

  const width = endX - startX;
  const height = endY - startY;

  // Read pixels once for the region
  const imageData: ImageData = context2d.getImageData(startX, startY, width, height);
  const data: Uint8ClampedArray = imageData.data;

  // Visited map to avoid revisiting pixels; one boolean per pixel
  const visited: Uint8Array = new Uint8Array(width * height);

  const components: Array<{ x: number; y: number; width: number; height: number }> = [];

  // Small inline helper to test whether pixel matches
  function pixelMatches(localX: number, localY: number): boolean {
    const index = (localY * width + localX) * 4;
    const r = data[index];
    const g = data[index + 1];
    const b = data[index + 2];
    const a = data[index + 3];

    return a > 0 && isNearColor(r, g, b, referenceColor, tolerance);
  }

  // BFS over 4 neighbors
  const queueX: number[] = [];
  const queueY: number[] = [];

  for (let localY = 0; localY < height; localY += 1) {
    for (let localX = 0; localX < width; localX += 1) {
      const flatIndex = localY * width + localX;
      if (visited[flatIndex] === 1) {
        continue;
      }
      visited[flatIndex] = 1;

      if (!pixelMatches(localX, localY)) {
        continue;
      }

      // Start a new component BFS
      let minX = localX;
      let minY = localY;
      let maxX = localX;
      let maxY = localY;

      queueX.length = 0;
      queueY.length = 0;
      queueX.push(localX);
      queueY.push(localY);

      while (queueX.length > 0) {
        const qx = queueX.pop() as number;
        const qy = queueY.pop() as number;

        // Update bounds
        if (qx < minX) {
          minX = qx;
        }
        if (qy < minY) {
          minY = qy;
        }
        if (qx > maxX) {
          maxX = qx;
        }
        if (qy > maxY) {
          maxY = qy;
        }

        // Explore 4-neighborhood
        const neighbors = [
          { nx: qx - 1, ny: qy },
          { nx: qx + 1, ny: qy },
          { nx: qx, ny: qy - 1 },
          { nx: qx, ny: qy + 1 },
        ];

        for (const { nx, ny } of neighbors) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
            continue;
          }
          const nFlat = ny * width + nx;
          if (visited[nFlat] === 1) {
            continue;
          }
          visited[nFlat] = 1;

          if (pixelMatches(nx, ny)) {
            queueX.push(nx);
            queueY.push(ny);
          }
        }
      }

      // Push component bbox in absolute canvas coordinates
      components.push({
        x: startX + minX,
        y: startY + minY,
        width: maxX - minX + 1,
        height: maxY - minY + 1,
      });
    }
  }

  return components;
}

/**
 * Merges components that likely belong to the same wrapped line.
 * Heuristics:
 *  - strong vertical overlap (e.g. >= 65% of the smaller height),
 *  - reasonable horizontal gap (e.g. <= 0.6 × median component height).
 *
 * Tweak thresholds below if needed:
 *  - OVERLAP_THRESHOLD: how much vertical overlap counts as "same line"
 *  - HORIZONTAL_GAP_FACTOR: max gap between neighbors to merge into one line
 *  - MIN_COMPONENT_AREA: drop noise components that are too small
 */
export function mergeComponentsIntoLines(
  components: Array<{ x: number; y: number; width: number; height: number }>
): Array<{ x: number; y: number; width: number; height: number }> {
  const OVERLAP_THRESHOLD = 0.4;
  const HORIZONTAL_GAP_FACTOR = 10;
  const MIN_COMPONENT_AREA = 25;

  // Filter tiny components (noise)
  const filtered = components.filter((c) => c.width * c.height >= MIN_COMPONENT_AREA);
  if (filtered.length === 0) {
    return [];
  }

  // Sort by top, then by left
  filtered.sort((a, b) => a.y - b.y || a.x - b.x);

  // Compute median component height for gap threshold
  const heights = filtered.map((c) => c.height).sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] || 1;
  const maxHorizontalGap = Math.max(1, Math.round(medianHeight * HORIZONTAL_GAP_FACTOR));

  // Group components into lines
  const lines: Array<Array<{ x: number; y: number; width: number; height: number }>> = [];

  for (const box of filtered) {
    let attached = false;

    for (const line of lines) {
      // Check overlap with the last box in this line (or better use line's vertical span)
      const lineTop = Math.min(...line.map((b) => b.y));
      const lineBottom = Math.max(...line.map((b) => b.y + b.height));
      const boxTop = box.y;
      const boxBottom = box.y + box.height;

      const overlap = Math.max(0, Math.min(lineBottom, boxBottom) - Math.max(lineTop, boxTop));
      const minHeight = Math.min(lineBottom - lineTop, box.height);
      const verticalOverlapRatio = minHeight > 0 ? overlap / minHeight : 0;

      // Horizontal proximity: if the new box starts near or after the last box's right edge
      const lastInLine = line[line.length - 1];
      const gap = box.x - (lastInLine.x + lastInLine.width);

      if (verticalOverlapRatio >= OVERLAP_THRESHOLD && gap <= maxHorizontalGap) {
        line.push(box);
        attached = true;
        break;
      }
    }

    if (!attached) {
      lines.push([box]);
    }
  }

  // Merge each line's boxes into a single bounding box
  const merged = lines.map((line) => {
    const minX = Math.min(...line.map((b) => b.x));
    const minY = Math.min(...line.map((b) => b.y));
    const maxX = Math.max(...line.map((b) => b.x + b.width));
    const maxY = Math.max(...line.map((b) => b.y + b.height));
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  });

  // Sort final boxes top-to-bottom, then left-to-right
  merged.sort((a, b) => a.y - b.y || a.x - b.x);

  return merged;
}

export function getHighlightColor(isApplied: boolean, priority: Priority): string {
  if (isApplied) {
    return COLORS.GRAY;
  }
  switch (priority) {
    case "high":
      return COLORS.GREEN;
    case "medium":
      return COLORS.YELLOW;
    case "low":
      return COLORS.ORANGE;
    case "veryLow":
      return COLORS.RED;
    default:
      return COLORS.GRAY;
  }
}

/** Compute vertical overlap ratio relative to the smaller height. */
export function getVerticalOverlapRatio(
  a: { top: number; height: number },
  b: { top: number; height: number }
): number {
  const aBottom = a.top + a.height;
  const bBottom = b.top + b.height;
  const overlap = Math.max(0, Math.min(aBottom, bBottom) - Math.max(a.top, b.top));
  const minHeight = Math.min(a.height, b.height);
  return minHeight > 0 ? overlap / minHeight : 0;
}

/** Merge two boxes horizontally as a union: left-most start and total width. */
function mergeHorizontalUnion(
  a: { left: number; width: number },
  b: { left: number; width: number }
): { left: number; width: number } {
  const left = Math.min(a.left, b.left);
  const right = Math.max(a.left + a.width, b.left + b.width);
  return { left, width: right - left };
}

/** Merge two boxes according to vertical strategy; horizontal always union. */
export function mergeBoxesByStrategy(
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
  strategy: VerticalMergeStrategy
): { left: number; top: number; width: number; height: number } {
  const horizontal = mergeHorizontalUnion(a, b);

  if (strategy === "first") {
    return { left: horizontal.left, top: a.top, width: horizontal.width, height: a.height };
  }

  if (strategy === "average") {
    return {
      left: horizontal.left,
      top: (a.top + b.top) / 2,
      width: horizontal.width,
      height: (a.height + b.height) / 2,
    };
  }

  // "first_start_union_height": keep first start, union bottom
  const aBottom = a.top + a.height;
  const bBottom = b.top + b.height;
  const unionHeight = Math.max(aBottom, bBottom) - a.top;
  return { left: horizontal.left, top: a.top, width: horizontal.width, height: unionHeight };
}

/**
 * Normalize list of bounding boxes by merging consecutive boxes
 * when their vertical overlap ratio >= overlapThresholdRatio.
 * Boxes are processed top-to-bottom, then left-to-right.
 */
export function normalizeBoundingBoxesVertically(
  boxes: Array<{ left: number; top: number; width: number; height: number }>,
  strategy: VerticalMergeStrategy,
  overlapThresholdRatio: number = DEFAULT_VERTICAL_OVERLAP_THRESHOLD_RATIO,
  fontSize: number | null
): Array<{ left: number; top: number; width: number; height: number }> {
  if (boxes.length <= 1) {
    return boxes;
  }

  const minHeight = fontSize ? fontSize / 3 : 1;
  const filtered = boxes.filter((b) => b.height >= minHeight);
  const sorted = filtered
    .slice()
    .sort((a, b) => (a.top === b.top ? a.left - b.left : a.top - b.top));

  const result: Array<{ left: number; top: number; width: number; height: number }> = [];
  let current = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const candidate = sorted[i];
    const ratio = getVerticalOverlapRatio(current, candidate);

    if (ratio >= overlapThresholdRatio) {
      current = mergeBoxesByStrategy(current, candidate, strategy);
    } else {
      result.push(current);
      current = candidate;
    }
  }

  result.push(current);
  return result;
}
