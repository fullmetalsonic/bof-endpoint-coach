import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearRecoveryState, clearState, loadRecoveryState, loadState, saveRecoveryState, saveState } from "../src/storage/indexedDb.js";
import { createDemoState } from "../src/data/demoState.js";

describe("IndexedDB state", () => {
  beforeEach(async () => { await clearState(); await clearRecoveryState(); });

  it("persists and loads the application state", async () => {
    const state = createDemoState();
    await saveState(state);
    const loaded = await loadState();
    expect(loaded.currentHeatId).toBe("DEMO-260822-01");
    expect(loaded.heats).toHaveLength(2);
  });

  it("keeps a separate recovery snapshot", async () => {
    const state = createDemoState();
    await saveRecoveryState(state);
    const recovery = await loadRecoveryState();
    expect(recovery.state.currentHeatId).toBe("DEMO-260822-01");
    expect(recovery.savedAt).toBeTruthy();
  });
});
