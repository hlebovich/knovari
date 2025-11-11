import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { runActionForItemGroups } from "../../../engine/Engine.ts";
import { base64ImageToFile } from "../../../helpers/base64ImageToFile.ts";
import {
  changelogItemResponseToChangelogItem,
  changelogResponseToChangelog,
} from "../../../helpers/changelogResponseToChangelog.ts";
import { getChangelogByCategories } from "../../../helpers/getChangelogByCategories.ts";
import { ApiService } from "../../../services/Api.service.ts";
import type { IndexDBService } from "../../../services/indexDB.service.ts";
import type { LoggerService } from "../../../services/Logger.service.ts";
import type { PresentationService } from "../../../services/Presentation.service.ts";
import { useChangelogStore } from "../../../stores/ChangelogStore.ts";
import type {
  ChangelogByCategory,
  ChangelogGroup,
  GroupId,
  TreatmentAction,
} from "../../../types/changelog.ts";
import GroupCard from "../../blocks/GroupCard/GroupCard.tsx";
import { SanitizeProgress } from "../../blocks/SanitizeProgress";
import { XIcon } from "../../icons";
import { Button } from "../../ui";
import styles from "./CategoriesOverviewScreen.module.css";

type Props = {
  api: ApiService<unknown>;
  presentation: PresentationService;
  logger: LoggerService;
  db: IndexDBService;
};

export default function CategoriesOverviewScreen({ api, presentation, logger }: Props) {
  const navigate = useNavigate();
  const { filteredChangelog, setChangelog, setTaskId, taskId } = useChangelogStore();

  const [isFileLoading, setIsFileLoading] = useState(true);
  const [changelogChangesApplyError, setChangelogChangesApplyError] = useState(false);
  const [categoriesChangelog, setCategoriesChangelog] = useState<ChangelogByCategory | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<
    Record<
      GroupId,
      {
        group: ChangelogGroup;
        action: TreatmentAction;
      } | null
    >
  >({});

  const getScreenshots = async (): Promise<File[]> => {
    try {
      const screenshots = await presentation.getCurrentScreenshots();
      const screenshotEntries = Object.entries(screenshots);

      if (screenshotEntries.length === 0) {
        logger.warn("No screenshots to upload.");
        return [];
      }

      return await Promise.all(
        screenshotEntries.map(async ([slideNumberString, imageBase64]) => {
          const slideNumber: number = Number(slideNumberString);
          return await base64ImageToFile(imageBase64, `slide-${slideNumber}-screenshot.png`);
        })
      );
    } catch (error) {
      logger.error(error);
      return [];
    }
  };

  const uploadFile = async () => {
    setIsFileLoading(true);

    try {
      logger.log("Preparing file...");
      const file = await presentation.getCurrentFile();
      const screenshots = await getScreenshots();

      logger.log("Sending file...");
      const changelogData = await api.api.uploadPresentationFile(file, screenshots);
      const slideIds = await presentation.getSlideIdsList();

      const itemsList = changelogData.changelog.data.map((item) =>
        changelogItemResponseToChangelogItem(item, slideIds)
      );

      const byCategory = getChangelogByCategories(itemsList);
      setCategoriesChangelog(byCategory);
      const changelogDataBySlides = changelogResponseToChangelog(itemsList);
      setChangelog(changelogDataBySlides);

      await presentation.prepareLayoutForChangelog(changelogDataBySlides.slides);

      setTaskId(changelogData.taskId);
    } catch (error) {
      logger.error("Error during file upload:", error);
    } finally {
      setIsFileLoading(false);
    }
  };

  const copyTaskId = () => {
    if (taskId) {
      navigator.clipboard.writeText(taskId).then();
    }
  };

  const handleGroupSelectionChange = (
    group: ChangelogGroup,
    action: TreatmentAction,
    isSelected: boolean
  ) => {
    const nextGroup = isSelected
      ? {
          group,
          action,
        }
      : null;
    setSelectedGroups((prev) => ({
      ...prev,
      [group.groupId]: nextGroup,
    }));
  };

  const handleApplyChanges = async () => {
    const groupsToUpdate: {
      group: ChangelogGroup;
      action: TreatmentAction;
    }[] = Object.entries(selectedGroups)
      .map(([, item]) => item)
      .filter((item) => !!item);
    await runActionForItemGroups(groupsToUpdate, {
      api,
      ppt: presentation,
      logger,
      store: useChangelogStore,
    });

    navigate("changelog-overview");
  };

  useEffect(() => {
    uploadFile().then();
  }, []);

  if (isFileLoading) {
    return (
      <div className={`${styles.root} ${styles.noData}`}>
        <SanitizeProgress />
      </div>
    );
  }

  if (!categoriesChangelog) {
    return (
      <div className={`${styles.root} ${styles.noData}`}>
        <div>
          Something went wrong. <br /> Try again later
        </div>
        <Button onClick={uploadFile}>Sanitize</Button>
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
        <Button onClick={handleApplyChanges}>Apply All Changes</Button>
      </div>
      <div className={styles.content}>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>
            Detected sensitive elements <br /> By most frequent categories:
          </h3>
        </div>
        {categoriesChangelog &&
          Object.keys(categoriesChangelog).map((categoryName) => {
            const category = categoriesChangelog[categoryName];
            return (
              <div key={categoryName} className={styles.section}>
                <h4 className={styles.categoryTitle}>
                  {categoryName} [{category.totalItems}]
                </h4>
                <div className={styles.groups}>
                  {Object.keys(category.groups).map((groupId) => {
                    const group = category.groups[parseInt(groupId)];
                    return (
                      <GroupCard
                        key={groupId}
                        group={group}
                        onSelectionChange={handleGroupSelectionChange}
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
