import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { clearState, loadState, saveState } from "../src/storage/indexedDb.js";
import { createDemoState } from "../src/data/demoState.js";

describe("IndexedDB state", () => {
  beforeEach(async () => clearState());

  it("persists and loads the application state", async () => {
    const state = createDemoState();
    await saveState(state);
    const loaded = await loadState();
    expect(loaded.currentHeatId).toBe("DEMO-260822-01");
    expect(loaded.heats).toHaveLength(2);
  });
});
