export const DB_NAME = "bof-endpoint-coach";
export const DB_VERSION = 2;
export const STATE_STORE_NAME = "state";
export const RECOVERY_STORE_NAME = "recovery_points";

export function openCoachDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STATE_STORE_NAME)) database.createObjectStore(STATE_STORE_NAME);
      if (!database.objectStoreNames.contains(RECOVERY_STORE_NAME)) database.createObjectStore(RECOVERY_STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

