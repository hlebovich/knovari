import { useEffect, useState } from "react";
import type { LoggerService } from "../services/Logger.service.ts";
import type { IllustrationCollection } from "../types/changelog.ts";
import { MessageType } from "../types/messages.ts";

export function useIllustrationsFromTaskpane(logger: LoggerService) {
  const [data, setData] = useState<IllustrationCollection | null>(null);

  useEffect(() => {
    try {
      Office.onReady().then(() => {
        Office.context.ui.addHandlerAsync(Office.EventType.DialogParentMessageReceived, (event) => {
          const message = JSON.parse(event.message) as {
            type: string;
            data: IllustrationCollection;
          };
          if (message.type === MessageType.REQUEST_ILLUSTRATIONS_DATA) {
            setData(message.data);
          } else if (message.type === MessageType.REQUEST_ERROR) {
            logger.error("Error loading illustrations:", event.message);
          }
        });

        try {
          Office.context.ui.messageParent(MessageType.REQUEST_ILLUSTRATIONS);
        } catch (error) {
          logger.error("Dialog send failed:", error);
        }
      });
    } catch (error) {
      logger.error("Failed to initialize Office context.");
    }
  }, []);

  return { data };
}
