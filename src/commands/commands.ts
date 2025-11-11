import { ApiService } from "../services/Api.service.ts";
import { PresentationService } from "../services/Presentation.service.ts";

type CmdEvent = Office.AddinCommands.Event;

const LOADER_URL = "https://localhost:3000/taskpane.html#/loader";

const api = new ApiService();
const presentation = new PresentationService();

Office.onReady(async () => {});

function openLoaderDialog(url: string): Promise<Office.Dialog> {
  return new Promise((resolve, reject) => {
    Office.context.ui.displayDialogAsync(
      url,
      {
        height: 25,
        width: 25,
        displayInIframe: true,
      },
      (res) => {
        if (res.status === Office.AsyncResultStatus.Succeeded) {
          resolve(res.value);
        } else {
          reject(res.error);
        }
      }
    );
  });
}

async function uploadFile() {
  try {
    console.log("Preparing file...");
    const file = await presentation.getCurrentFile();

    console.log("Sending file...");

    const response = await api.api.sanitize({ file });
    console.log("Sanitization taskId:", response.data.taskId);

    return response.data.taskId;
  } catch (e) {
    console.error("Error getting current presentation:", e);
  }
}

async function sanitizeFile(event: CmdEvent) {
  try {
    const dialog = await openLoaderDialog(LOADER_URL);

    await uploadFile();

    dialog.close();
    await Office.addin.showAsTaskpane().catch((err) => {
      console.error("Error showing as taskpane:", err);
    });
  } catch (e) {
    console.error("Error in sanitizeFile:", e);
  }

  event.completed();
}

Office.actions.associate("uploadFile", sanitizeFile);
