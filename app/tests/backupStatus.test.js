import { describe, expect, it } from "vitest";
import { backupStatus } from "../src/domain/backupStatus.js";
import { createEmptyState } from "../src/data/demoState.js";

describe("external backup status", () => {
  it("distinguishes browser autosave from a verified external JSON backup", () => {
    const state = createEmptyState();
    expect(backupStatus(state).status).toBe("current");
    state.operationLog.push({ id: "L1", type: "heat_created", at: "2026-08-23T00:00:00.000Z" });
    expect(backupStatus(state, new Date("2026-08-23T01:00:00.000Z"))).toMatchObject({ status: "needed", reason: "never_exported" });
    state.operationLog.push({ id: "L2", type: "json_backup_exported", at: "2026-08-23T02:00:00.000Z", readVerified: true });
    expect(backupStatus(state, new Date("2026-08-23T03:00:00.000Z")).status).toBe("current");
  });

  it("requires a new JSON after an endpoint or coefficient-significant change", () => {
    const state = createEmptyState();
    state.operationLog.push({ id: "L1", type: "json_backup_exported", at: "2026-08-23T02:00:00.000Z", readVerified: true });
    state.operationLog.push({ id: "L2", type: "actual_endpoint_selected", at: "2026-08-23T02:01:00.000Z" });
    expect(backupStatus(state, new Date("2026-08-23T03:00:00.000Z"))).toMatchObject({ status: "needed", reason: "important_change" });
  });
});
