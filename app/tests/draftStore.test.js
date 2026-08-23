// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { clearDraft, loadDraft, saveDraft } from "../src/storage/draftStore.js";

describe("local draft store", () => {
  beforeEach(() => localStorage.clear());

  it("restores only a draft created from the same base version", () => {
    expect(saveDraft("new-heat", "SET-1", { id: "H-001" })).toBe(true);
    expect(loadDraft("new-heat", "SET-1")?.value.id).toBe("H-001");
    expect(loadDraft("new-heat", "SET-2")).toBeNull();
  });

  it("removes a discarded draft", () => {
    saveDraft("settings", "SET-1", { version: "SET-1" });
    clearDraft("settings");
    expect(loadDraft("settings", "SET-1")).toBeNull();
  });
});
