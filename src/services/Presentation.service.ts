import type { ChangelogSlide, IllustrationCollection } from "../types/changelog.ts";
import type {
  LoadedReplaceShape,
  ReplaceBaseData,
  ReplaceItemBase,
  ReplaceMaskData,
  ReplaceTableData,
  ReplaceTextData,
  RevertImageData,
  RevertTableData,
  SlideId,
  UnprocessedItem,
} from "../types/presentationService.ts";
import { COLORS } from "./constants/presentation-constants.ts";
import { HighlightingService } from "./Highlighting.service.ts";
import { MarkerService } from "./Marker.service.ts";
import { getSlidesToBeMarked } from "./utils/presentation-utils.ts";
import { toUint8 } from "./utils/toUint8.ts";

export class PresentationService {
  private masterShapeNames: Set<string> = new Set();

  constructor() {
    Office.onReady(() => {
      PowerPoint.run(async (context) => {
        try {
          this.masterShapeNames = await this.getMasterShapeNames(context);
        } catch (error) {}
      });
    });
  }

  private async getMasterShapeNames(context: PowerPoint.RequestContext): Promise<Set<string>> {
    const names = new Set<string>();

    const slideMasters: PowerPoint.SlideMasterCollection =
      context.presentation.slideMasters.load("items");
    await context.sync();

    for (const slideMaster of slideMasters.items) {
      slideMaster.load("shapes");
      await context.sync();

      for (const shape of slideMaster.shapes.items) {
        shape.load("name");
        await context.sync();
        names.add(shape.name);
      }
    }

    return names;
  }

  async getSlideData(slideId: string): Promise<File | null> {
    try {
      return await PowerPoint.run(async (context) => {
        const slide = context.presentation.slides.getItem(slideId);
        const slideData = slide.exportAsBase64();
        await context.sync();

        const base64Pptx = slideData.value;
        const byteChars = atob(base64Pptx);
        const bytes = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i += 1) {
          bytes[i] = byteChars.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        });
        return new File([blob], "slide.pptx", { type: blob.type });
      });
    } catch (error) {
      throw Error(`Error getting slide data or creating file for slideId: ${slideId}`, {
        cause: error,
      });
    }
  }

  async replaceSlide(slideId: string, base64Data: string): Promise<string> {
    try {
      return await PowerPoint.run(async (context) => {
        const presentation = context.presentation;
        const slide = presentation.slides.getItem(slideId);
        slide.load("index");
        await context.sync();
        const slideIndex = slide.index;
        presentation.insertSlidesFromBase64(base64Data, {
          sourceSlideIds: [slideId],
          targetSlideId: slideId,
        });
        slide.delete();
        await context.sync();
        const newSlide = presentation.slides.getItemAt(slideIndex);
        newSlide.load("id");
        await context.sync();
        return newSlide.id;
      });
    } catch (error) {
      throw Error(`Error replacing slide with id: ${slideId}`, { cause: error });
    }
  }

  private groupBySlide<T extends ReplaceBaseData>(
    items: ReplaceItemBase<T>[]
  ): Map<SlideId, ReplaceItemBase<T>[]> {
    const map = new Map<string, ReplaceItemBase<T>[]>();
    for (const item of items) {
      const arr = map.get(item.slideId) ?? [];
      arr.push(item);
      map.set(item.slideId, arr);
    }
    return map;
  }

  private async findShapeInGroups(
    shapeId: string,
    shapes: PowerPoint.ShapeCollection | PowerPoint.ShapeScopedCollection,
    context: PowerPoint.RequestContext
  ): Promise<PowerPoint.Shape | null> {
    shapes.load("items/type");
    await context.sync();

    const shapeGroups = shapes.items.filter((item) => item.type === PowerPoint.ShapeType.group);

    if (shapeGroups.length === 0) {
      return null;
    }

    let shape: PowerPoint.Shape | null = null;

    for (const shapeGroup of shapeGroups) {
      const shapeInGroup = shapeGroup.group.shapes.getItemOrNullObject(shapeId);
      await context.sync();

      if (!shapeInGroup.isNullObject) {
        shape = shapeInGroup;
        break;
      }

      const shapeInSubGroup = await this.findShapeInGroups(
        shapeId,
        shapeGroup.group.shapes,
        context
      );

      if (shapeInSubGroup) {
        shape = shapeInSubGroup;
        break;
      }
    }

    return shape;
  }

  private async getShapeById(
    shapeId: string,
    slide: PowerPoint.Slide,
    context: PowerPoint.RequestContext
  ) {
    try {
      const shapeOnSlide = slide.shapes.getItemOrNullObject(shapeId);
      await context.sync();

      if (!shapeOnSlide.isNullObject) {
        return shapeOnSlide;
      }

      slide.load(["shapes"]);
      await context.sync();

      const shapes: PowerPoint.ShapeCollection = slide.shapes;
      const shapeInGroups = await this.findShapeInGroups(shapeId, shapes, context);

      if (!shapeInGroups) {
        throw new Error(`[getShapeById] Shape is not found on slide.`);
      }

      return shapeInGroups;
    } catch (error) {
      throw new Error(`[getShapeById] Failed to load shape with ID: ${shapeId}`, { cause: error });
    }
  }

  private async loadShapesByIds<T extends ReplaceBaseData>(
    itemGroups: Map<SlideId, ReplaceItemBase<T>[]>,
    context: PowerPoint.RequestContext,
    properties: string | string[]
  ): Promise<{
    loadedShapes: LoadedReplaceShape<T>[];
    slides: Map<SlideId, PowerPoint.Slide>;
    unprocessedItems: UnprocessedItem[];
  }> {
    const presentation = context.presentation;

    const slides = new Map<string, PowerPoint.Slide>();
    const loadedShapes: LoadedReplaceShape<T>[] = [];
    const errors: UnprocessedItem[] = [];

    for (const [slideId, list] of itemGroups) {
      const slide = presentation.slides.getItem(slideId);
      slides.set(slideId, slide);

      for (const item of list) {
        const { id, shapeId, data } = item;
        try {
          const normalizedId = data.shapeId ? data.shapeId : shapeId;
          const shape = await this.getShapeById(normalizedId, slide, context);
          shape.load([...properties, "name"]);
          await context.sync();
          loadedShapes.push({ id, slideId, shape: shape, data });
        } catch (error) {
          errors.push({
            itemId: item.id,
            message: `Can not find the element`,
            cause: new Error(
              `[loadShapesByIds] Failed to load shape. Item id=${item.id} shapeId=${shapeId}, slideId=${slideId}`,
              { cause: error }
            ),
          });
        }
      }
    }

    return { loadedShapes, slides, unprocessedItems: errors };
  }

  private async getTableCell(
    context: PowerPoint.RequestContext,
    shape: PowerPoint.Shape,
    row: number | null | undefined,
    column: number | null | undefined
  ): Promise<PowerPoint.TableCell> {
    if (shape.type !== "Table" || (!row && row !== 0) || (!column && column !== 0)) {
      throw Error(
        `[getTableCell] Not a table shape or row/column not defined. shapeId: ${shape.id}, type: ${shape.type} row: ${row}, column: ${column}`
      );
    }

    const table = shape.getTable();

    const rowCountResult = table.rows.getCount();
    const columnCountResult = table.columns.getCount();
    await context.sync();

    const rowCount = rowCountResult.value;
    const columnCount = columnCountResult.value;

    if (row < 0 || column < 0 || row >= rowCount || column >= columnCount) {
      throw Error(
        `[getTableCell] Row/column out of range. shapeId: ${shape.id}, row: ${row}, column: ${column}, rowCount: ${rowCount}, columnCount: ${columnCount}`
      );
    }

    const cell = table.getCellOrNullObject(row, column);
    await context.sync();

    if (cell.isNullObject) {
      throw new Error(
        `[getTableCell] Table cell is null. shapeId: ${shape.id}, row: ${row}, column: ${column}`
      );
    }

    return cell;
  }

  async goToSlideById(slideNumber: number): Promise<void> {
    return new Promise((resolve, reject) => {
      Office.context.document.goToByIdAsync(slideNumber, Office.GoToType.Index, (res) => {
        if (res.status === Office.AsyncResultStatus.Succeeded) {
          resolve();
        } else {
          reject({ error: res.error, slideNumber });
        }
      });
    });
  }

  async addShapeMask(items: ReplaceItemBase<ReplaceMaskData>[]): Promise<{
    updatedShapeIds: (string | null)[];
    unprocessedItems: UnprocessedItem[];
  }> {
    if (!items.length) {
      return { updatedShapeIds: [], unprocessedItems: [] };
    }

    const updatedShapeIds: (string | null)[] = [];
    const aggregatedUnprocessedItems: UnprocessedItem[] = [];
    const itemsGroupedBySlide = this.groupBySlide<ReplaceMaskData>(items);

    await PowerPoint.run(async (context) => {
      const { loadedShapes, slides, unprocessedItems } = await this.loadShapesByIds(
        itemsGroupedBySlide,
        context,
        ["id", "type", "left", "top", "width", "height"]
      );

      if (unprocessedItems && unprocessedItems.length > 0) {
        aggregatedUnprocessedItems.push(...unprocessedItems);
      }

      for (const loadedShape of loadedShapes) {
        const { id, slideId, shape, data } = loadedShape;

        try {
          const { left, top, width, height } = shape;

          const slide = slides.get(slideId)!;
          const rectangleShape = slide.shapes.addGeometricShape(
            PowerPoint.GeometricShapeType.rectangle,
            {
              left,
              top,
              width,
              height,
            }
          );

          rectangleShape.fill.setSolidColor(COLORS.BG_GRAY);
          rectangleShape.lineFormat.visible = false;
          rectangleShape.textFrame.textRange.text = data.text;
          rectangleShape.textFrame.textRange.font.color = COLORS.BLACK;
          rectangleShape.textFrame.verticalAlignment =
            PowerPoint.TextVerticalAlignment.middleCentered;
          rectangleShape.textFrame.textRange.paragraphFormat.horizontalAlignment =
            PowerPoint.ParagraphHorizontalAlignment.center;

          rectangleShape.load("id");
          await context.sync();

          updatedShapeIds.push(rectangleShape.id);
          await HighlightingService.updateHighlight(
            slide,
            shape,
            {
              id,
              shapeId: shape.id,
              slideId,
              data,
            },
            false,
            context
          );
        } catch (error) {
          updatedShapeIds.push(null);
          aggregatedUnprocessedItems.push({
            itemId: id,
            message: "Can not apply changes to the item",
            cause: new Error(
              `[addShapeMask] Failed to apply mask for id=${id}, shapeId=${shape.id}, slideId=${slideId}`,
              { cause: error }
            ),
          });
        }
      }

      await context.sync();
    });

    return {
      updatedShapeIds,
      unprocessedItems: aggregatedUnprocessedItems,
    };
  }

  async removeShapes(
    items: ReplaceItemBase<ReplaceBaseData | RevertImageData>[],
    updateHighlighting: boolean = true
  ): Promise<{ unprocessedItems: UnprocessedItem[] }> {
    if (!items.length) {
      return { unprocessedItems: [] };
    }

    const aggregatedUnprocessedItems: UnprocessedItem[] = [];
    const itemsGroupedBySlide = this.groupBySlide(items);

    await PowerPoint.run(async (context) => {
      const {
        loadedShapes,
        slides: slidesMap,
        unprocessedItems,
      } = await this.loadShapesByIds(itemsGroupedBySlide, context, [
        "id",
        "type",
        "left",
        "top",
        "width",
        "height",
      ]);

      if (unprocessedItems && unprocessedItems.length > 0) {
        aggregatedUnprocessedItems.push(...unprocessedItems);
      }

      for (const loadedShape of loadedShapes) {
        const { id, slideId, shape, data } = loadedShape;
        const slide = slidesMap.get(slideId)!;

        try {
          shape.delete();

          if (updateHighlighting) {
            await HighlightingService.updateHighlight(
              slide,
              shape,
              {
                id,
                shapeId:
                  "initialShapeId" in data && data.initialShapeId ? data.initialShapeId : shape.id,
                slideId,
                data,
              },
              false,
              context
            );
          }

          await context.sync();
        } catch (error) {
          aggregatedUnprocessedItems.push({
            itemId: id,
            message: "Can not delete the image or image mask",
            cause: new Error(
              `[removeShapes] Failed to delete id=${id}, shapeId=${shape.id}, slideId=${slideId}`,
              { cause: error }
            ),
          });
        }
      }
    });

    return { unprocessedItems: aggregatedUnprocessedItems };
  }

  async replaceTextInShapes(
    items: ReplaceItemBase<ReplaceTextData>[]
  ): Promise<{ unprocessedItems: UnprocessedItem[] }> {
    if (!items.length) {
      return { unprocessedItems: [] };
    }

    const itemsGroupedBySlide = this.groupBySlide<ReplaceTextData>(items);
    const aggregatedUnprocessedItems: UnprocessedItem[] = [];

    await PowerPoint.run(async (context) => {
      const {
        loadedShapes,
        unprocessedItems,
        slides: slidesMap,
      } = await this.loadShapesByIds(itemsGroupedBySlide, context, [
        "id",
        "textFrame/textRange/font",
        "textFrame/textRange/text",
        "type",
        "left",
        "top",
        "width",
        "height",
        "name",
      ]);

      const slides = Array.from(slidesMap.values());
      context.trackedObjects.add(slides);

      if (unprocessedItems && unprocessedItems.length > 0) {
        aggregatedUnprocessedItems.push(...unprocessedItems);
      }

      try {
        for (const loadedShape of loadedShapes) {
          const { id, shape, data, slideId } = loadedShape;
          const slide = slidesMap.get(slideId);

          try {
            if (!slide || !shape.textFrame?.textRange) {
              continue;
            }

            context.trackedObjects.add(shape);
            const isMasterSlideShape = this.masterShapeNames.has(shape.name);
            await MarkerService.replaceTextInShape(
              shape,
              { id, shapeId: shape.id, slideId, data },
              isMasterSlideShape,
              context
            );

            /* ChangeHighlighting  */
            try {
              const isMasterSlideShape = this.masterShapeNames.has(shape.name);
              await HighlightingService.updateHighlight(
                slide,
                shape,
                {
                  id,
                  shapeId: shape.id,
                  slideId,
                  data: {
                    ...data,
                    initialText: data.proposedText,
                  },
                },
                isMasterSlideShape,
                context
              );

              if (data.siblings?.length) {
                for (const sibling of data.siblings) {
                  await HighlightingService.repositionSiblingHighlighting(
                    shape,
                    slide,
                    {
                      id: sibling.id,
                      slideId,
                      shapeId: shape.id,
                      data: { ...sibling, hasSiblings: true },
                    },
                    context
                  );
                }
              }
            } catch (error) {
              console.warn("Can not update highlight after text replacement", error);
            }
          } catch (error) {
            aggregatedUnprocessedItems.push({
              itemId: id,
              message: "Can not replace text in the element",
              cause: new Error(
                `[replaceTextInShapes] Failed to replace text (id=${id}, shapeId=${shape.id}, slideId=${slideId})`,
                { cause: error }
              ),
            });
          } finally {
            context.trackedObjects.remove(shape);
          }
        }
      } finally {
        context.trackedObjects.remove(slides);
      }
    });

    return { unprocessedItems: aggregatedUnprocessedItems };
  }

  async replaceTextInTables(items: ReplaceItemBase<ReplaceTableData>[]): Promise<{
    textRuns: (PowerPoint.TextRun[] | null)[];
    unprocessedItems: UnprocessedItem[];
  }> {
    if (!items.length) {
      return { textRuns: [], unprocessedItems: [] };
    }

    const itemsGroupedBySlide = this.groupBySlide<ReplaceTableData>(items);

    const initialItemTextRuns: (PowerPoint.TextRun[] | null)[] = [];
    const aggregatedUnprocessedItems: UnprocessedItem[] = [];

    await PowerPoint.run(async (context) => {
      const { loadedShapes, unprocessedItems } = await this.loadShapesByIds<ReplaceTableData>(
        itemsGroupedBySlide,
        context,
        ["id", "type"]
      );
      if (unprocessedItems && unprocessedItems.length > 0) {
        aggregatedUnprocessedItems.push(...unprocessedItems);
      }

      for (const loadedShape of loadedShapes) {
        const { id, shape, data, slideId } = loadedShape;
        const { row, column } = data;

        if (!data.initialText || !data.proposedText) {
          aggregatedUnprocessedItems.push({
            itemId: id,
            message: "No text to replace found",
            cause: new Error(
              `[replaceTextInTables] Initial or proposed text not defined (id=${id}, shapeId=${shape.id}, slideId=${slideId}, row=${row}, column=${column})`
            ),
          });
          continue;
        }

        try {
          const cell = await this.getTableCell(context, shape, row, column);

          cell.load(["textRuns"]);
          await context.sync();

          if (!cell.textRuns) {
            await MarkerService.replaceTextInSimpleCell(
              cell,
              {
                id,
                shapeId: shape.id,
                slideId,
                data,
              },
              context
            );
          } else {
            const { initialTextRuns } = await MarkerService.replaceTextInFormattedCell(
              cell,
              {
                id,
                shapeId: shape.id,
                slideId,
                data,
              },
              context
            );
            initialItemTextRuns.push(initialTextRuns);
          }

          await context.sync();
        } catch (error) {
          initialItemTextRuns.push(null);
          const isCellNotFound =
            error instanceof Error && error.message.startsWith("[getTableCell]");
          aggregatedUnprocessedItems.push({
            itemId: id,
            message: isCellNotFound
              ? "Table cell not found"
              : "Can not replace text in the table cell",
            cause: new Error(
              `[replaceTextInTables] Failed to replace text (id=${id}, shapeId=${shape.id}, slideId=${slideId}, row=${row}, column=${column})`,
              { cause: error }
            ),
          });
        }
      }
    });

    return {
      textRuns: initialItemTextRuns,
      unprocessedItems: aggregatedUnprocessedItems,
    };
  }

  async revertTextInTables(
    items: ReplaceItemBase<RevertTableData>[]
  ): Promise<{ unprocessedItems: UnprocessedItem[] }> {
    if (!items.length) {
      return { unprocessedItems: [] };
    }

    const itemsGroupedBySlide = this.groupBySlide<RevertTableData>(items);
    const aggregatedUnprocessedItems: UnprocessedItem[] = [];

    await PowerPoint.run(async (context) => {
      const { loadedShapes, unprocessedItems } = await this.loadShapesByIds<RevertTableData>(
        itemsGroupedBySlide,
        context,
        ["id", "type"]
      );

      if (unprocessedItems && unprocessedItems.length > 0) {
        aggregatedUnprocessedItems.push(...unprocessedItems);
      }

      for (const loadedShape of loadedShapes) {
        const { id, shape, data, slideId } = loadedShape;
        const { row, column } = data;

        if (!data.initialText || !data.proposedText) {
          aggregatedUnprocessedItems.push({
            itemId: id,
            message: "No text to revert found",
            cause: new Error(
              `[revertTextInTables] Initial or proposed text not defined (id=${id}, shapeId=${shape.id}, slideId=${slideId}, row=${row}, column=${column})`
            ),
          });
          continue;
        }

        try {
          const cell = await this.getTableCell(context, shape, row, column);

          cell.load(["text", "textRuns", "font"]);
          await context.sync();

          if (!cell.textRuns) {
            await MarkerService.replaceTextInSimpleCell(
              cell,
              {
                id,
                shapeId: shape.id,
                slideId,
                data,
              },
              context
            );
          } else {
            await MarkerService.revertTextInFormattedCell(
              cell,
              {
                id,
                slideId,
                shapeId: shape.id,
                data,
              },
              context
            );
          }
        } catch (error) {
          const isCellNotFound =
            error instanceof Error && error.message.startsWith("[getTableCell]");
          aggregatedUnprocessedItems.push({
            itemId: id,
            message: isCellNotFound
              ? "Table cell not found"
              : "Can not revert text in the table cell",
            cause: new Error(
              `[revertTextInTables] Failed to revert text (id=${id}, shapeId=${shape.id}, slideId=${slideId}, row=${row}, column=${column})`,
              { cause: error }
            ),
          });
        }
      }
    });

    return { unprocessedItems: aggregatedUnprocessedItems };
  }

  async getCurrentScreenshots() {
    const results: IllustrationCollection = {};

    try {
      await PowerPoint.run(async (context) => {
        const slides = context.presentation.slides;
        slides.load("items");
        await context.sync();

        for (const slide of slides.items) {
          slide.load("index");

          const image = slide.getImageAsBase64();
          await context.sync();

          results[slide.index] = image.value ? `data:image/png;base64,${image.value}` : "";
        }
      });
    } catch (error) {
      throw new Error("[getCurrentScreenshots] failed", { cause: error });
    }

    return results;
  }

  async getSlideIdsList() {
    const results: Array<string> = [];

    try {
      await PowerPoint.run(async (context) => {
        const slides = context.presentation.slides;
        slides.load("items");
        await context.sync();

        for (const slide of slides.items) {
          slide.load("id");
        }

        await context.sync();

        for (const slide of slides.items) {
          results.push(slide.id);
        }
      });
    } catch (error) {
      throw new Error("[getSlideIdsList] failed", { cause: error });
    }

    return results;
  }

  async getCurrentFile(): Promise<File> {
    const MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const SLICE_SIZE = 4 * 1024 * 1024; // 4MB

    return new Promise<File>((resolve, reject) => {
      Office.context.document.getFileAsync(
        Office.FileType.Compressed,
        { sliceSize: SLICE_SIZE },
        (result) => {
          if (result.status !== Office.AsyncResultStatus.Succeeded) {
            reject(new Error("Failed to get file", { cause: result }));
          }

          const file = result.value;
          const total = file.sliceCount;
          const parts: BlobPart[] = [];
          let i = 0;

          const cleanup = () => file.closeAsync(() => void 0);

          const readNext = () => {
            file.getSliceAsync(i, (r2) => {
              if (r2.status !== Office.AsyncResultStatus.Succeeded) {
                cleanup();
                reject(new Error(String(r2.error || r2.status)));
                return;
              }

              parts.push(toUint8(r2.value.data));
              i++;

              if (i < total) {
                readNext();
              } else {
                const blob = new Blob(parts, { type: MIME });
                const fullFile = new File([blob], "presentation.pptx", { type: MIME });
                cleanup();
                resolve(fullFile);
              }
            });
          };

          readNext();
        }
      );
    });
  }

  async addMarkersForChangelog(changelog: ChangelogSlide[]): Promise<void> {
    try {
      await PowerPoint.run(async (context) => {
        const presentation = context.presentation;

        for (const changelogSlide of changelog) {
          const slide = presentation.slides.getItem(changelogSlide.slideId);

          for (const item of changelogSlide.items) {
            try {
              const shape = await this.getShapeById(item.shapeId, slide, context);
              shape.load("type");
              await context.sync();

              const replacementItem: ReplaceItemBase<ReplaceTextData> = {
                id: item.id,
                slideId: item.slideId,
                shapeId: item.shapeId,
                data: {
                  priority: item.priority,
                  isApplied: item.isApplied,
                  initialText: item.initialValue,
                  proposedText: item.proposedValue || "",
                  hasSiblings: item.hasSibling,
                  occurrenceIndex: item.occurrenceIndex,
                  siblings: item.siblings?.map((sibling) => {
                    const siblingFullItem = changelogSlide.items.find((i) => i.id === sibling.id);
                    return {
                      ...sibling,
                      proposedText: siblingFullItem?.proposedValue || "",
                      priority: siblingFullItem?.priority || "unknown",
                      isApplied: siblingFullItem?.isApplied,
                    };
                  }),
                },
              };

              if (shape.type === PowerPoint.ShapeType.table) {
                const table = shape.getTable();
                const cell = table.getCellOrNullObject(item.row!, item.column!);
                await context.sync();
                if (!cell.isNullObject) {
                  cell.load(["text", "textRuns", "font"]);
                  await context.sync();

                  const tableReplacementItem: ReplaceItemBase<ReplaceTableData> = {
                    ...replacementItem,
                    data: {
                      ...replacementItem.data,
                      row: item.row,
                      column: item.column,
                    },
                  };

                  if (cell.textRuns && cell.textRuns.length > 0) {
                    await MarkerService.addMarkersForSimpleCell(
                      cell,
                      tableReplacementItem,
                      context
                    );
                  } else {
                    MarkerService.addMarkersForFormattedCell(
                      cell.textRuns,
                      tableReplacementItem,
                      cell.font
                    );
                  }
                }
              }

              await MarkerService.addMarkersForShape(shape, replacementItem, context);
              shape.textFrame.textRange.load("text");
              await context.sync();
            } catch (error) {
              console.warn(
                `[addMarkersForChangelog] Failed to add markers for item: id=${item.id}, shapeId=${item.shapeId}, slideId=${changelogSlide.slideId}`,
                { cause: error }
              );
            }
          }
        }

        await context.sync();
      });
    } catch (error) {
      console.warn("[addMarkersForChangelog] failed", { cause: error });
    }
  }

  async prepareLayoutForChangelog(changelog: ChangelogSlide[]): Promise<void> {
    try {
      const slidesToBeMarked = getSlidesToBeMarked(changelog);

      await this.addMarkersForChangelog(slidesToBeMarked);
      await this.highlightChangelogItems(changelog);
    } catch (error) {}
  }

  async highlightChangelogItems(changelog: ChangelogSlide[]) {
    try {
      await PowerPoint.run(async (context) => {
        const presentation = context.presentation;

        for (const changelogSlide of changelog) {
          const slide = presentation.slides.getItem(changelogSlide.slideId);

          for (const item of changelogSlide.items) {
            try {
              const shape = await this.getShapeById(item.shapeId, slide, context);
              shape.load(["type", "name"]);
              await context.sync();

              const replacementItemBase: ReplaceItemBase<ReplaceTextData> = {
                id: item.id,
                slideId: item.slideId,
                shapeId: item.shapeId,
                data: {
                  proposedText: item.proposedValue || "",
                  priority: item.priority,
                  isApplied: item.isApplied,
                  hasSiblings: item.hasSibling,
                  occurrenceIndex: item.occurrenceIndex,
                  siblings: item.siblings?.map((sibling) => {
                    const siblingFullItem = changelogSlide.items.find((i) => i.id === sibling.id);
                    return {
                      ...sibling,
                      proposedText: siblingFullItem?.proposedValue || "",
                      priority: siblingFullItem?.priority || "unknown",
                      isApplied: siblingFullItem?.isApplied,
                    };
                  }),
                },
              };

              if (item.shapeType === "image" || item.shapeType === "chart") {
                await HighlightingService.highlightShape(
                  slide,
                  shape,
                  replacementItemBase,
                  context
                );
                continue;
              }

              if (item.shapeType === "table") {
                await HighlightingService.highlightTableShape(
                  slide,
                  shape,
                  replacementItemBase,
                  context
                );
                continue;
              }

              if (item.shapeType === "text") {
                const isMasterSlideShape = this.masterShapeNames.has(shape.name);

                await HighlightingService.highlightTextShape(
                  slide,
                  shape,
                  {
                    ...replacementItemBase,
                    data: {
                      ...replacementItemBase.data,
                      initialText: item.isApplied ? item.proposedValue : item.initialValue,
                      proposedText: item.isApplied
                        ? item.initialValue || ""
                        : item.proposedValue || "",
                    },
                  },
                  isMasterSlideShape,
                  context
                );
              }
            } catch (error) {
              console.warn(
                `[highlightChangelogItems] Failed to highlight item: id=${item.id}, shapeId=${item.shapeId}, slideId=${changelogSlide.slideId}`,
                { cause: error }
              );
            }
          }
        }

        await context.sync();
      });
    } catch (error) {
      console.warn("[highlightChangelogItems] failed", { cause: error });
    }
  }
}
