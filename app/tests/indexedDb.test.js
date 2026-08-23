import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRecoveryState, clearState, loadRecoveryState, loadState, replaceWorkspace, saveRecoveryState, saveState, StorageConflictError } from "../src/storage/indexedDb.js";
import { createDemoState } from "../src/data/demoState.js";
import { clearRecoveryPoints, listRecoveryPoints, makeRecoveryPoint, replaceRecoveryPoints, retainRecoveryPoints } from "../src/storage/recoveryStore.js";

describe("IndexedDB state", () => {
  beforeEach(async () => { await clearState(); await clearRecoveryState(); await clearRecoveryPoints(); });
  afterEach(() => vi.unstubAllGlobals());

  it("persists and loads the application state", async () => {
    const state = createDemoState();
    const saved = await saveState(state, 0);
    const loaded = await loadState();
    expect(loaded.currentHeatId).toBe("DEMO-260822-01");
    expect(loaded.heats).toHaveLength(2);
    expect(saved.storageRevision).toBe(1);
    expect(loaded.storageRevision).toBe(1);
  });

  it("rejects a stale writer instead of overwriting a newer workspace", async () => {
    const first = await saveState(createDemoState(), 0);
    const newer = await saveState({ ...first, operatorProfile: { displayName: "새 창" } }, first.storageRevision);

    await expect(saveState({ ...first, operatorProfile: { displayName: "오래된 창" } }, first.storageRevision))
      .rejects.toBeInstanceOf(StorageConflictError);

    const loaded = await loadState();
    expect(loaded.operatorProfile.displayName).toBe("새 창");
    expect(loaded.storageRevision).toBe(newer.storageRevision);
  });

  it("keeps a separate recovery snapshot", async () => {
    const state = createDemoState();
    await saveRecoveryState(state);
    const recovery = await loadRecoveryState();
    expect(recovery.state.currentHeatId).toBe("DEMO-260822-01");
    expect(recovery.savedAt).toBeTruthy();
  });

  it("propagates an initial database open failure instead of returning an empty state", async () => {
    vi.stubGlobal("indexedDB", {
      open() {
        const request = {};
        queueMicrotask(() => {
          request.error = new Error("database_open_failed");
          request.onerror?.();
        });
        return request;
      },
    });
    await expect(loadState()).rejects.toThrow("database_open_failed");
  });

  it("rotates unprotected recovery points while preserving protected points", async () => {
    const state = createDemoState();
    const now = new Date("2026-08-23T12:00:00.000Z");
    const points = Array.from({ length: 25 }, (_, index) => makeRecoveryPoint(state, {
      id: `REC-${index}`,
      createdAt: new Date(now.getTime() - index * 60_000).toISOString(),
      protectedPoint: index === 24,
    }));
    points.push(makeRecoveryPoint(state, { id: "REC-OLD", createdAt: "2026-01-01T00:00:00.000Z" }));
    const retained = retainRecoveryPoints(points, now);
    expect(retained).toHaveLength(21);
    expect(retained.some((point) => point.id === "REC-24" && point.protected)).toBe(true);
    expect(retained.some((point) => point.id === "REC-OLD")).toBe(false);

    await replaceRecoveryPoints(retained);
    expect(await listRecoveryPoints()).toHaveLength(21);
  });

  it("atomically replaces the workspace and recovery collection", async () => {
    const first = await saveState(createDemoState(), 0);
    const imported = createDemoState({ displayName: "복원 작업자" });
    imported.heats = imported.heats.slice(0, 1);
    const point = makeRecoveryPoint(imported, { id: "REC-IMPORT", reason: "import" });

    const saved = await replaceWorkspace(imported, [point], first.storageRevision);
    expect(saved.storageRevision).toBe(first.storageRevision + 1);
    expect((await loadState()).operatorProfile.displayName).toBe("복원 작업자");
    expect((await listRecoveryPoints()).map((entry) => entry.id)).toEqual(["REC-IMPORT"]);

    await expect(replaceWorkspace(createDemoState(), [], first.storageRevision)).rejects.toBeInstanceOf(StorageConflictError);
    expect((await loadState()).operatorProfile.displayName).toBe("복원 작업자");
    expect(await listRecoveryPoints()).toHaveLength(1);
  });
});
