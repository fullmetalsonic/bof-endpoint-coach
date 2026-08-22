import { describe, expect, it } from "vitest";
import { calculateEndpoint, qualityRows, targetState } from "../src/calculation/endpoint.js";
import { createDemoState } from "../src/data/demoState.js";

describe("endpoint calculation", () => {
  it("matches the documented synthetic sample-correction case", () => {
    const state = createDemoState();
    const result = calculateEndpoint(state.heats[0], state.settings, "2026-08-22T01:24:05Z");
    expect(result.carbon.available).toBe(true);
    expect(result.carbon.value).toBeCloseTo(0.061019, 6);
    expect(result.temperature.value).toBe(1655);
    expect(result.carbon.mode).toBe("sample_correction");
    expect(result.oxygenRemaining).toBe(300);
    expect(result.projectedRemainingMinutes).toBe(1);
  });

  it("uses planned endpoint oxygen for a heat without a sample", () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[0]);
    heat.samples = [];
    heat.process.cumulativeOxygenNm3 = 0;
    const result = calculateEndpoint(heat, state.settings);
    expect(result.carbon.mode).toBe("static_balance");
    expect(result.temperature.mode).toBe("static_balance");
    expect(result.usesPlannedValues).toBe(true);
  });

  it("returns an explicit unavailable result when the coefficient profile is missing", () => {
    const state = createDemoState();
    state.heats[0].coefficientProfileId = "MISSING";
    const result = calculateEndpoint(state.heats[0], state.settings);
    expect(result.carbon.available).toBe(false);
    expect(result.carbon.reason).toBe("coefficient_profile_missing");
    expect(result.temperature.available).toBe(false);
  });

  it("keeps each quality target state independent", () => {
    expect(targetState(0.05, { min: 0.04, max: 0.08 })).toBe("within");
    expect(targetState(0.03, { min: 0.04, max: 0.08 })).toBe("low");
    expect(targetState(0.09, { min: 0.04, max: 0.08 })).toBe("high");
    expect(targetState(null, { min: 0.04, max: 0.08 })).toBe("unknown");
    const state = createDemoState();
    const calculation = calculateEndpoint(state.heats[0], state.settings);
    const rows = qualityRows(state.heats[0], state.settings, calculation);
    expect(rows.find((row) => row.key === "C").predictionState).toBe("within");
    expect(rows.find((row) => row.key === "P").prediction.available).toBe(false);
  });
});
