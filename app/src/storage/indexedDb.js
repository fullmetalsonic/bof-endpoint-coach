import { openCoachDatabase, RECOVERY_STORE_NAME, STATE_STORE_NAME } from "./database.js";

const STORE_NAME = STATE_STORE_NAME;
const STATE_KEY = "application";
const RECOVERY_KEY = "recovery";

export class StorageConflictError extends Error {
  constructor(expectedRevision, actualRevision) {
    super("storage_revision_conflict");
    this.name = "StorageConflictError";
    this.code = "storage_revision_conflict";
    this.expectedRevision = expectedRevision;
    this.actualRevision = actualRevision;
  }
}

export async function loadState() {
  const database = await openCoachDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(STATE_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveState(state, expectedRevision = null) {
  const database = await openCoachDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(STATE_KEY);
    let saved = null;
    let conflict = null;
    request.onsuccess = () => {
      const currentRevision = Number(request.result?.storageRevision ?? 0);
      if (expectedRevision !== null && currentRevision !== Number(expectedRevision)) {
        conflict = new StorageConflictError(Number(expectedRevision), currentRevision);
        transaction.abort();
        return;
      }
      saved = {
        ...state,
        storageRevision: currentRevision + 1,
        lastSavedAt: new Date().toISOString(),
      };
      store.put(saved, STATE_KEY);
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => {
      database.close();
      resolve(saved);
    };
    transaction.onerror = () => {
      database.close();
      reject(conflict ?? transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(conflict ?? transaction.error ?? new Error("storage_transaction_aborted"));
    };
  });
}

export async function clearState() {
  const database = await openCoachDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(STATE_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function saveRecoveryState(state) {
  const database = await openCoachDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({ state, savedAt: new Date().toISOString() }, RECOVERY_KEY);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function loadRecoveryState() {
  const database = await openCoachDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).get(RECOVERY_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function clearRecoveryState() {
  const database = await openCoachDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(RECOVERY_KEY);
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function replaceWorkspace(state, recoveryPoints, expectedRevision = null) {
  const database = await openCoachDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME, RECOVERY_STORE_NAME], "readwrite");
    const stateStore = transaction.objectStore(STORE_NAME);
    const recoveryStore = transaction.objectStore(RECOVERY_STORE_NAME);
    const request = stateStore.get(STATE_KEY);
    let saved = null;
    let conflict = null;
    request.onsuccess = () => {
      const currentRevision = Number(request.result?.storageRevision ?? 0);
      if (expectedRevision !== null && currentRevision !== Number(expectedRevision)) {
        conflict = new StorageConflictError(Number(expectedRevision), currentRevision);
        transaction.abort();
        return;
      }
      saved = {
        ...state,
        storageRevision: currentRevision + 1,
        lastSavedAt: new Date().toISOString(),
      };
      stateStore.put(saved, STATE_KEY);
      recoveryStore.clear();
      (recoveryPoints ?? []).forEach((point) => recoveryStore.put(structuredClone(point)));
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => { database.close(); resolve(saved); };
    transaction.onerror = () => { database.close(); reject(conflict ?? transaction.error); };
    transaction.onabort = () => { database.close(); reject(conflict ?? transaction.error ?? new Error("workspace_replace_aborted")); };
  });
}
