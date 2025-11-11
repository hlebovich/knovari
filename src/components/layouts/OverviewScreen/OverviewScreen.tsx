import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  runActionChangeForItem,
  runClearFile,
  runUpdateForChangelog,
  runUpdateForItem,
} from "../../../engine/Engine.ts";
import { ApiService } from "../../../services/Api.service.ts";
import { HighlightingService } from "../../../services/Highlighting.service.ts";
import type { IndexDBService } from "../../../services/indexDB.service.ts";
import type { LoggerService } from "../../../services/Logger.service.ts";
import type { PresentationService } from "../../../services/Presentation.service.ts";
import { useChangelogStore } from "../../../stores/ChangelogStore.ts";
import type { ChangelogItem, Priority, TreatmentAction } from "../../../types/changelog.ts";
import { MessageType } from "../../../types/messages.ts";
import { Card } from "../../blocks";
import { ArrowUpRightIcon, XIcon } from "../../icons";
import { Badge, Button, Dropdown, FilterIconTrigger } from "../../ui";

import styles from "./OverviewScreen.module.css";

type Props = {
  api: ApiService<unknown>;
  presentation: PresentationService;
  logger: LoggerService;
  db: IndexDBService;
};

type FilterValue = Priority | "all";

const CLOSE_DIALOG_CODE = 12006;

export default function OverviewScreen({ api, presentation, logger, db }: Props) {
  const navigate = useNavigate();
  const { changelog, filteredChangelog, priorityFilter, setPriorityFilter, isPendingItem, taskId } =
    useChangelogStore();

  const dialogReferenceRef = useRef<Office.Dialog | null>(null);

  const [changelogChangesApplyError, setChangelogChangesApplyError] = useState(false);

  const filterOptions: { label: string; value: FilterValue }[] = [
    { label: "All", value: "all" },
    { label: "High", value: "high" },
    { label: "Medium", value: "medium" },
    { label: "Low", value: "low" },
    { label: "Very Low", value: "veryLow" },
  ];

  const applyAllChanges = async () => {
    try {
      const result = await runUpdateForChangelog({
        api,
        ppt: presentation,
        logger,
        store: useChangelogStore,
      });

      if (result && result.unprocessedItems.length > 0) {
        result.unprocessedItems.forEach((item) => {
          logger.error(item.error?.error);
        });

        setChangelogChangesApplyError(true);
      }
    } catch (error) {
      setChangelogChangesApplyError(true);
      logger.error(error);
    }
  };
  const openChangelogDialog = async () => {
    await HighlightingService.toggleHighlights(false);
    try {
      const origin = new URL(window.location.origin);
      Office.context.ui.displayDialogAsync(
        `${origin.href}taskpane#report-dialog`,
        {
          height: 70,
          width: 70,
        },
        (asyncResult) => {
          if (asyncResult.status === Office.AsyncResultStatus.Succeeded) {
            const dialogReference = asyncResult.value;
            dialogReferenceRef.current = dialogReference;

            dialogReference.addEventHandler(
              Office.EventType.DialogMessageReceived,
              async (event) => {
                if ("message" in event) {
                  if (event.message === MessageType.REQUEST_ILLUSTRATIONS) {
                    const screenshots = await presentation.getCurrentScreenshots();

                    dialogReference.messageChild(
                      JSON.stringify({
                        type: MessageType.REQUEST_ILLUSTRATIONS_DATA,
                        data: screenshots,
                      })
                    );
                  } else if (event.message === MessageType.REQUEST_FILE) {
                    try {
                      await runClearFile({
                        api,
                        ppt: presentation,
                        logger,
                        store: useChangelogStore,
                      });

                      const file = await presentation.getCurrentFile();
                      const transferKey = "current-pptx";
                      await db.saveFile(transferKey, file);

                      dialogReference.messageChild(
                        JSON.stringify({
                          type: MessageType.REQUEST_FILE_DATA,
                          data: transferKey,
                        })
                      );
                    } catch (error) {
                      logger.error("Error getting current presentation:", error);
                      dialogReference.messageChild(
                        JSON.stringify({
                          type: MessageType.REQUEST_FILE_ERROR,
                          data: null,
                        })
                      );
                    }
                  } else {
                    dialogReference.messageChild(
                      JSON.stringify({
                        type: MessageType.REQUEST_ERROR,
                        error: "Unknown message type",
                      })
                    );
                  }
                } else {
                  logger.error("Dialog error:", event.error);
                }
              }
            );

            dialogReference.addEventHandler(Office.EventType.DialogEventReceived, (event) => {
              dialogReferenceRef.current = null;
              if ("error" in event && event.error === CLOSE_DIALOG_CODE) {
                HighlightingService.toggleHighlights(true);
              }
            });
          } else {
            logger.error("Dialog open failed:", asyncResult.error);
          }
        }
      );
    } catch (error) {
      logger.error(error);
    }
  };

  const handleGoToSlide = (slideNumber: number) => {
    presentation.goToSlideById(slideNumber).catch((err) => {
      logger.error("Error going to slide:", err);
    });
  };

  const handleApplyAction = async (
    item: ChangelogItem,
    isApplied: boolean,
    action: TreatmentAction
  ) => {
    const result = await runUpdateForItem(item, action, isApplied, {
      api,
      ppt: presentation,
      logger,
      store: useChangelogStore,
    }).catch((error) => {
      logger.error(error);
    });

    if (result && result.unprocessedItems.length > 0) {
      result.unprocessedItems.forEach((item) => {
        logger.error(item.error?.error);
      });
    }
  };

  const handleActionChange = async (item: ChangelogItem, action: TreatmentAction) => {
    await runActionChangeForItem(item, action, {
      api,
      ppt: presentation,
      logger,
      store: useChangelogStore,
    }).catch((error) => {
      logger.error(error);
    });
  };

  const copyTaskId = () => {
    if (taskId) {
      navigator.clipboard.writeText(taskId).then();
    }
  };

  const handleStartNewAnalysis = async () => {
    navigate("/");
  };

  if (!changelog) {
    return (
      <div className={`${styles.root} ${styles.noData}`}>
        <div>
          Something went wrong. <br /> Try again later
        </div>
        <Button onClick={handleStartNewAnalysis}>Start New Analysis</Button>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      {changelogChangesApplyError && (
        <div className={styles.error}>
          Something went wrong during saving updates{" "}
          <button
            className={styles.closeButton}
            onClick={() => setChangelogChangesApplyError(false)}
          >
            <XIcon className={styles.closeIcon} />
          </button>
        </div>
      )}
      <div className={styles.applyChangesBanner}>
        <Button onClick={applyAllChanges}>Apply All Changes</Button>
        <Button onClick={openChangelogDialog}>View Summary</Button>
      </div>
      <div className={styles.content}>
        {/* Statistics Section */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Detected sensitive elements <br /> By confidence levels:
          </h3>
          <div className={styles.stats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Total</span>
              <span className={styles.statValue}>{changelog.totalItems}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>
                <Badge color="green" text="High" variant="default" />
              </span>
              <span className={styles.statValue}>{changelog.highPriorityItems}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>
                <Badge color="yellow" text="Medium" variant="default" />
              </span>
              <span className={styles.statValue}>{changelog.mediumPriorityItems}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>
                <Badge color="orange" text="Low" variant="default" />
              </span>
              <span className={styles.statValue}>{changelog.lowPriorityItems}</span>
            </div>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>
                <Badge color="red" text="Very Low" variant="default" />
              </span>
              <span className={styles.statValue}>{changelog.lowPriorityItems}</span>
            </div>
          </div>
        </div>

        {/* Sanitization Summary */}
        <div className={styles.summaryHeader}>
          <h3 className={styles.sectionTitle}>Sanitization Summary</h3>
          <div className={styles.filterWrapper}>
            <Dropdown<FilterValue>
              options={filterOptions}
              value={priorityFilter}
              onChange={setPriorityFilter}
              trigger={<FilterIconTrigger />}
              anchor="bottom end"
              gap={4}
            />
          </div>
        </div>

        {filteredChangelog &&
          filteredChangelog.slides.length > 0 &&
          filteredChangelog.slides.map((slide) => {
            return (
              <div className={styles.slide} key={slide.slideId}>
                <button
                  className={styles.slideLink}
                  onClick={() => handleGoToSlide(slide.slideNumber)}
                >
                  <span>Go to Slide {slide.slideNumber}</span>
                  <ArrowUpRightIcon className={styles.linkIcon} />
                </button>
                <h4 className={styles.slideTitle}>Slide {slide.slideNumber}</h4>
                <div className={styles.cards}>
                  {slide.items.map((item) => {
                    return (
                      <Card
                        key={item.id}
                        {...item}
                        isLoading={isPendingItem(item.id)}
                        onResolveStatusChange={(status, action) =>
                          handleApplyAction(item, status, action)
                        }
                        onActionChange={(action) => handleActionChange(item, action)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}

        <div className={styles.testBlock}>
          Task Id: {taskId}{" "}
          <button className={styles.copyButton} onClick={copyTaskId}>
            Copy
          </button>
        </div>
        {filteredChangelog?.slides.length === 0 && (
          <div className={styles.noChanges}>No changes found for the selected filter.</div>
        )}
      </div>
    </div>
  );
}
