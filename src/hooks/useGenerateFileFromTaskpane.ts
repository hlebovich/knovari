import { MessageType } from "../types/messages.ts";

export function useGenerateFileFromTaskpane() {
  const requestFile = (): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      try {
        Office.onReady().then(() => {
          Office.context.ui.addHandlerAsync(
            Office.EventType.DialogParentMessageReceived,
            (event) => {
              const message = JSON.parse(event.message) as {
                type: string;
                data: string;
              };
              if (message.type === MessageType.REQUEST_FILE_DATA) {
                resolve(message.data);
              }
            }
          );

          try {
            Office.context.ui.messageParent(MessageType.REQUEST_FILE);
          } catch (error) {
            reject(error);
          }
        });
      } catch (error) {
        reject("Failed to initialize Office context.");
      }
    });
  };

  return { requestFile };
}
