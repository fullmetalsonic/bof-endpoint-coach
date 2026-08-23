import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRecoveryState, clearState, loadRecoveryState, loadState, saveRecoveryState, saveState, StorageConflictError } from "../src/storage/indexedDb.js";
import { createDemoState } from "../src/data/demoState.js";

describe("IndexedDB state", () => {
  beforeEach(async () => { await clearState(); await clearRecoveryState(); });
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
});
