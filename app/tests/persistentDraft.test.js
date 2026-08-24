// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { usePersistentDraft } from "../src/hooks/usePersistentDraft.js";
import { loadDraft, saveDraft } from "../src/storage/draftStore.js";

afterEach(cleanup);

describe("persistent draft compatibility", () => {
  beforeEach(() => localStorage.clear());

  it("rejects and clears an old settings draft that lacks newly required sections", async () => {
    saveDraft("settings", "DEMO-REF-001", { version: "DEMO-REF-001", coefficientProfiles: [{}] });
    const defaults = { version: "DEMO-REF-001", coefficientProfiles: [{}], additionModelProfiles: [{ id: "ADD-DEMO" }] };
    const { result } = renderHook(() => usePersistentDraft({
      key: "settings",
      baseVersion: "DEMO-REF-001",
      defaults,
      validate: (value) => Array.isArray(value.additionModelProfiles) && value.additionModelProfiles.length > 0,
    }));

    expect(result.current.restored).toBe(false);
    expect(result.current.value.additionModelProfiles[0].id).toBe("ADD-DEMO");
    await waitFor(() => expect(loadDraft("settings", "DEMO-REF-001")).toBeNull());
  });

  it("can commit a replacement value and clears the older autosaved draft", async () => {
    const { result } = renderHook(() => usePersistentDraft({ key: "addition-plan", baseVersion: "P-1", defaults: { amount: "10" } }));
    act(() => result.current.setValue({ amount: "999" }));
    await waitFor(() => expect(loadDraft("addition-plan", "P-1")?.value.amount).toBe("999"));

    act(() => result.current.commit({ amount: "25" }));

    expect(result.current.value.amount).toBe("25");
    expect(result.current.dirty).toBe(false);
    await waitFor(() => expect(loadDraft("addition-plan", "P-1")).toBeNull());
  });
});
