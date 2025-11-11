import { Fragment, useEffect, useMemo, useState } from "react";
import { finalChangelogResponseToChangelog } from "../../../helpers/changelogResponseToChangelog.ts";
import { formatSessionDuration } from "../../../helpers/formatSessionDuration.ts";
import { useGenerateFileFromTaskpane } from "../../../hooks/useGenerateFileFromTaskpane.ts";
import { useIllustrationsFromTaskpane } from "../../../hooks/useIllustrationsFromTaskpane.ts";
import { ApiService } from "../../../services/Api.service.ts";
import type { IndexDBService } from "../../../services/indexDB.service.ts";
import type { LoggerService } from "../../../services/Logger.service.ts";
import { useChangelogStore } from "../../../stores/ChangelogStore.ts";
import type { FinalChangelog, Priority } from "../../../types/changelog.ts";
import { ApplyCheckIcon } from "../../icons";
import { Badge, Button } from "../../ui";
import type { BadgeColor } from "../../ui/Badge/Badge.tsx";
import { CircularLoader } from "../../ui/CircularLoader/CircularLoader.tsx";

import styles from "./ReportScreen.module.css";

const CONFIDENCE_SCORE_CONFIG: Record<Priority, { color: BadgeColor; text: string }> = {
  high: { color: "green" as const, text: "High" },
  medium: { color: "yellow" as const, text: "Medium" },
  low: { color: "orange" as const, text: "Low" },
  veryLow: { color: "red" as const, text: "Very Low" },
  unknown: { color: "default" as const, text: "Unknown" },
};

const RESOLUTION_ACTIONS = {
  replace: "Replaced",
  redact: "Redacted",
  obfuscate: "Obfuscated",
  skip: "Skipped",
};

type Props = {
  api: ApiService<unknown>;
  logger: LoggerService;
  db: IndexDBService;
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ReportScreen({ api, logger, db }: Props) {
  const { taskId } = useChangelogStore();

  const { data: currentIllustrations } = useIllustrationsFromTaskpane(logger);
  const { requestFile } = useGenerateFileFromTaskpane();

  const [finalChangelog, setFinalChangelog] = useState<FinalChangelog | null>(null);
  const [sessionDuration, setSessionDuration] = useState<string | null>("00:00");
  const [fileIsLoading, setFileIsLoading] = useState<boolean>(false);
  const [changelogIsLoading, setChangelogIsLoading] = useState<boolean>(false);
  const [dataIsLoading, setDataIsLoading] = useState<boolean>(true);

  const changelogWithIllustrations = useMemo(() => {
    if (!finalChangelog || !currentIllustrations) {
      return [];
    }

    const final = finalChangelog.slides.map((item) => {
      return {
        ...item,
        beforeImage: `${BASE_URL}/api/v1/screenshots/${taskId}/${item.slideNumber - 1}`,
        afterImage: currentIllustrations[item.slideNumber - 1] || "",
      };
    });

    setDataIsLoading(false);
    return final;
  }, [finalChangelog, currentIllustrations]);

  const statsConfig = useMemo(() => {
    return [
      { label: "Items Sanitized", value: finalChangelog?.itemsModified },
      { label: "Slides Modified", value: finalChangelog?.slidesModified },
      { label: "Items Skipped", value: finalChangelog?.itemsSkipped },
      { label: "Manual Review", value: finalChangelog?.itemsManualReviewed },
      { label: "Session Duration", value: sessionDuration },
    ];
  }, [finalChangelog]);

  const loadChangelog = async () => {
    if (!taskId) {
      logger.error("No task ID found");
      return;
    }

    const changelogData = await api.api.getFinalChangelog(taskId);
    const appliedChanges = changelogData.data.data.filter((item) => item.isApplied);
    setFinalChangelog(finalChangelogResponseToChangelog(appliedChanges));
    setSessionDuration(formatSessionDuration(changelogData.data.sessionDurationSeconds));
  };

  const downloadFile = async (objectUrl: string, fileName: string) => {
    try {
      const anchor: HTMLAnchorElement = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName || "download";

      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } finally {
      setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 0);
    }
  };

  const handleFileDownload = async () => {
    setFileIsLoading(true);
    const transferKey = await requestFile();
    const file = await db.getFile(transferKey);

    if (!file) {
      logger.error("No file received from taskpane");
      setFileIsLoading(false);
      return;
    }

    const clearedFile = await api.api.removePresentationMetadata({ file });

    const blob: Blob = await clearedFile.blob();
    const objectUrl: string = URL.createObjectURL(blob);
    await downloadFile(objectUrl, file.name || "download");

    setFileIsLoading(false);
  };

  const handleChangelogDownload = async () => {
    if (!taskId) {
      logger.error("No task ID found");
      return;
    }

    setChangelogIsLoading(true);
    const changelogData = await api.api.exportFinalChangelog(taskId);
    const blob: Blob = await changelogData.blob();
    const objectUrl: string = URL.createObjectURL(blob);
    await downloadFile(objectUrl, "changelog.docx");
    setChangelogIsLoading(false);
  };

  useEffect(() => {
    loadChangelog().then();
  }, []);

  if (dataIsLoading) {
    return (
      <div className={`${styles.root} ${styles.loading}`}>
        <div className={styles.loaderWrapper}>
          <CircularLoader size={40} />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div className={styles.title}>
          <h1 className={styles.titleText}>Sanitization completed</h1>
          <div className={styles.iconWrapper}>
            <ApplyCheckIcon className={styles.checkIcon} />
          </div>
        </div>
        <div className={styles.stats}>
          {statsConfig.map((stat, index) => (
            <div className={styles.statItem} key={index}>
              <span className={styles.statLabel}>{stat.label}:</span>
              <span className={styles.statValue}>{stat.value}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.content}>
        {changelogWithIllustrations.map((slide) => (
          <div className={styles.slideCard} key={slide.slideId}>
            <h2 className={styles.slideTitle}>Slide {slide.slideNumber}</h2>
            <div className={styles.slideContent}>
              <div className={styles.imageWrapper}>
                {slide.beforeImage ? (
                  <img
                    src={slide.beforeImage}
                    alt={`Slide ${slide.slideNumber} before sanitization`}
                    className={styles.image}
                  />
                ) : (
                  <div className={styles.placeholder}>No image available</div>
                )}
              </div>
              <div className={styles.imageWrapper}>
                {slide.afterImage ? (
                  <img
                    src={slide.afterImage}
                    alt={`Slide ${slide.slideNumber} after sanitization`}
                    className={styles.image}
                  />
                ) : (
                  <div className={styles.placeholder}>No image available</div>
                )}
              </div>
              {slide.items.map((change, idx) => (
                <Fragment key={change.id}>
                  <div className={styles.changeItem} key={`${idx}-finding`}>
                    <div className={styles.changeIndex}>
                      <div className={styles.changeIndexText}>{idx + 1}</div>
                    </div>
                    <div className={styles.changeInfo}>
                      <div className={styles.changeCategory}>{change.category}</div>
                      <div className={styles.changeValue}>
                        {change.shapeType === "image" ? "Image" : change.initialValue}
                      </div>
                    </div>
                    <Badge
                      variant="default"
                      color={CONFIDENCE_SCORE_CONFIG[change.priority].color}
                      text={CONFIDENCE_SCORE_CONFIG[change.priority].text}
                    />
                  </div>
                  <div className={styles.changeResolved} key={`${idx}-resolution`}>
                    <div className={styles.changeAction}>{RESOLUTION_ACTIONS[change.action]}</div>
                    {change.action === "replace" &&
                      change.shapeType !== "image" &&
                      change.proposedValue && (
                        <div className={styles.proposedValue}>{change.proposedValue}</div>
                      )}
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        <Button
          onClick={handleChangelogDownload}
          className={styles.actionButton}
          variant="secondary"
          loading={changelogIsLoading}
        >
          Export Log
        </Button>
        <Button
          loading={fileIsLoading}
          onClick={handleFileDownload}
          className={styles.actionButton}
        >
          Generate File
        </Button>
      </div>
    </div>
  );
}
