export class IndexDBService {
  private databaseName = "pptx-transfer-db";
  private databaseVersion = 1;
  private storeName = "files";

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, this.databaseVersion);

      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(this.storeName)) {
          database.createObjectStore(this.storeName);
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  async saveFile(key: string, file: File): Promise<void> {
    const database = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);

      const payload = {
        blob: file,
        name: file.name,
        type: file.type,
        size: file.size,
        savedAt: Date.now(),
      };

      transaction.oncomplete = () => {
        resolve();
      };
      transaction.onabort = () => {
        reject(transaction.error);
      };
      transaction.onerror = () => {
        reject(transaction.error);
      };

      store.put(payload, key);
    });
    database.close();
  }

  async getFile(key: string): Promise<File | null> {
    const database = await this.openDatabase();
    const record = await new Promise<any>((resolve, reject) => {
      const transaction = database.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);

      const getRequest = store.get(key);
      getRequest.onsuccess = () => {
        resolve(getRequest.result ?? null);
      };
      getRequest.onerror = () => {
        reject(getRequest.error);
      };
    });
    database.close();

    if (record == null) {
      return null;
    }

    const blob: Blob = record.blob as Blob;
    const name: string = String(record.name || "presentation.pptx");
    const type: string = String(
      record.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    );

    const file = new File([blob], name, { type });
    this.deleteFile(key).then();
    return file;
  }

  async deleteFile(key: string): Promise<void> {
    const database = await this.openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);

      const deleteRequest = store.delete(key);
      deleteRequest.onsuccess = () => {
        resolve();
      };
      deleteRequest.onerror = () => {
        reject(deleteRequest.error);
      };
    });
    database.close();
  }
}
