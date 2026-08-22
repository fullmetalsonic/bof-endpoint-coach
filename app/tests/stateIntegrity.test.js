import { describe, expect, it } from "vitest";
import { createDemoState } from "../src/data/demoState.js";
import { validateOperationalState } from "../src/domain/stateIntegrity.js";

describe("restored operational state integrity", () => {
  it("accepts the current demo timeline", () => {
    expect(validateOperationalState(createDemoState())).toBeNull();
  });

  it("rejects a backwards stage timeline", () => {
    const state = createDemoState();
    state.heats[0].stageHistory[3].occurredAt = new Date(new Date(state.heats[0].stageHistory[2].occurredAt).getTime() - 1000).toISOString();
    expect(validateOperationalState(state)).toBe("heat_state_integrity_failed");
  });

  it("rejects a skipped gate or a status-stage mismatch", () => {
    const skipped = createDemoState();
    skipped.heats[0].stageHistory[2].to = "G4";
    expect(validateOperationalState(skipped)).toBe("heat_state_integrity_failed");

    const mismatched = createDemoState();
    mismatched.heats[0].status = "completed";
    expect(validateOperationalState(mismatched)).toBe("heat_state_integrity_failed");
  });

  it("rejects a sample whose stage disagrees with its actual timestamp", () => {
    const state = createDemoState();
    state.heats[0].samples[0].stage = "G5";
    expect(validateOperationalState(state)).toBe("sample_state_integrity_failed");
  });

  it("rejects more than one adopted sample", () => {
    const state = createDemoState();
    state.heats[0].samples[0].adopted = true;
    expect(validateOperationalState(state)).toBe("sample_state_integrity_failed");
  });

  it("rejects a selected heat that does not exist", () => {
    const state = createDemoState();
    state.currentHeatId = "MISSING";
    expect(validateOperationalState(state)).toBe("state_reference_integrity_failed");
  });

  it("rejects a negative process value", () => {
    const state = createDemoState();
    state.heats[0].process.cumulativeOxygenNm3 = -1;
    expect(validateOperationalState(state)).toBe("heat_value_integrity_failed");
  });

  it("rejects a decreasing cumulative oxygen timeline", () => {
    const state = createDemoState();
    state.heats[0].events.find((event) => event.type === "checkpoint").payload.cumulativeOxygenNm3 = 12000;
    expect(validateOperationalState(state)).toBe("cumulative_oxygen_integrity_failed");
  });

  it("rejects correction logs without a reason or an existing target", () => {
    const state = createDemoState();
    state.heats[0].correctionLog.push({ id: "CORR-BAD", type: "record_voided", targetKind: "event", targetId: "MISSING", reason: "", recordedAt: new Date().toISOString() });
    expect(validateOperationalState(state)).toBe("correction_log_integrity_failed");
  });
});
