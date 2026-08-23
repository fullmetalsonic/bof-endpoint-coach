import { openCoachDatabase, RECOVERY_STORE_NAME } from "./database.js";

export const RECOVERY_POINT_LIMIT = 20;
export const RECOVERY_POINT_MAX_AGE_DAYS = 30;

function cloneWorkspace(state) {
  if (!state) return null;
  const workspace = structuredClone(state);
  delete workspace.storageRevision;
  delete workspace.lastSavedAt;
  return workspace;
}

export function recoveryPointSummary(state) {
  const heats = state?.heats ?? [];
  return {
    heatCount: heats.length,
    activeHeatCount: heats.filter((heat) => heat.status === "in_progress").length,
    completedHeatCount: heats.filter((heat) => ["tapped", "completed", "archived"].includes(heat.status)).length,
    coefficientVersionCount: (state?.settings?.coefficientProfiles ?? []).reduce((count, profile) => count + 1 + (profile.versionHistory?.length ?? 0), 0),
  };
}

export function makeRecoveryPoint(state, { reason, labelKo, labelEn, protectedPoint = false, createdAt = new Date().toISOString(), id = `REC-${crypto.randomUUID()}`, sourceRevision } = {}) {
  if (!state) throw new Error("recovery_state_missing");
  return {
    id,
    createdAt,
    reason: reason || "manual",
    labelKo: labelKo || "수동 복구점",
    labelEn: labelEn || "Manual recovery point",
    protected: Boolean(protectedPoint),
    operator: state.operatorProfile?.displayName ?? "",
    sourceRevision: Number(sourceRevision ?? state.storageRevision ?? 0),
    summary: recoveryPointSummary(state),
    state: cloneWorkspace(state),
  };
}

export function retainRecoveryPoints(points, now = new Date()) {
  const cutoff = now.getTime() - RECOVERY_POINT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const unique = [...new Map((points ?? []).filter((point) => point?.id && point?.state).map((point) => [point.id, point])).values()];
  const protectedPoints = unique.filter((point) => point.protected).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const rotating = unique
    .filter((point) => !point.protected && Number.isFinite(new Date(point.createdAt).getTime()) && new Date(point.createdAt).getTime() >= cutoff)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, RECOVERY_POINT_LIMIT);
  return [...protectedPoints, ...rotating].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function listRecoveryPoints() {
  const database = await openCoachDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RECOVERY_STORE_NAME, "readonly");
    const request = transaction.objectStore(RECOVERY_STORE_NAME).getAll();
    request.onsuccess = () => resolve(retainRecoveryPoints(request.result ?? []));
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function replaceRecoveryPoints(points) {
  const retained = retainRecoveryPoints(points);
  const database = await openCoachDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(RECOVERY_STORE_NAME, "readwrite");
    const store = transaction.objectStore(RECOVERY_STORE_NAME);
    store.clear();
    retained.forEach((point) => store.put(structuredClone(point)));
    transaction.oncomplete = () => { database.close(); resolve(retained); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
    transaction.onabort = () => { database.close(); reject(transaction.error ?? new Error("recovery_transaction_aborted")); };
  });
}

export async function saveRecoveryPoint(point) {
  const existing = await listRecoveryPoints();
  return replaceRecoveryPoints([point, ...existing]);
}

export async function setRecoveryPointProtected(pointId, protectedPoint) {
  const points = await listRecoveryPoints();
  const next = points.map((point) => point.id === pointId ? { ...point, protected: Boolean(protectedPoint) } : point);
  return replaceRecoveryPoints(next);
}

export async function removeRecoveryPoint(pointId) {
  const points = await listRecoveryPoints();
  return replaceRecoveryPoints(points.filter((point) => point.id !== pointId));
}

export async function clearRecoveryPoints() {
  return replaceRecoveryPoints([]);
}
