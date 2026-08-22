import { describe, expect, it } from "vitest";
import { calculateEndpoint, qualityRows, targetState } from "../src/calculation/endpoint.js";
import { createDemoState } from "../src/data/demoState.js";

describe("endpoint calculation", () => {
  it("anchors the literature model delta to the latest sample snapshot", () => {
    const state = createDemoState();
    const result = calculateEndpoint(state.heats[0], state.settings, "2026-08-22T01:24:05Z");
    expect(result.carbon.available).toBe(true);
    expect(result.carbon.value).toBeCloseTo(0.062599, 6);
    expect(result.temperature.value).toBeCloseTo(1655.107, 3);
    expect(result.carbon.mode).toBe("sample_anchored_literature");
    expect(result.carbon.rangeType).toBe("literature_scenario");
    expect(result.oxygenRemaining).toBe(10);
    expect(result.projectedRemainingMinutes).toBeCloseTo(1 / 30, 6);
    expect(result.basis.status).toBe("literature_reference");
    expect(result.basis.sourceIds).toEqual(expect.arrayContaining(["S12", "S44"]));
  });

  it("uses planned endpoint oxygen for a heat without a sample", () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[0]);
    heat.samples = [];
    heat.process.cumulativeOxygenNm3 = 0;
    const result = calculateEndpoint(heat, state.settings);
    expect(result.carbon.mode).toBe("literature_static_balance");
    expect(result.temperature.mode).toBe("literature_static_balance");
    expect(result.usesPlannedValues).toBe(true);
    expect(result.carbon.low).toBeLessThanOrEqual(result.carbon.value);
    expect(result.carbon.high).toBeGreaterThanOrEqual(result.carbon.value);
  });

  it("uses an override without changing the preserved literature value", () => {
    const state = createDemoState();
    const profile = state.settings.coefficientProfiles[0];
    const literatureValue = profile.literatureValues.postCombustionRatioBase;
    const baseline = calculateEndpoint(state.heats[0], state.settings).carbon.value;
    profile.overrideValues.postCombustionRatioBase = 0.18;
    profile.overrideStatus = "user_modified";
    const modified = calculateEndpoint(state.heats[0], state.settings);
    expect(modified.basis.status).toBe("user_modified");
    expect(modified.basis.overrideFields).toContain("postCombustionRatioBase");
    expect(modified.carbon.value).not.toBeCloseTo(baseline, 8);
    expect(profile.literatureValues.postCombustionRatioBase).toBe(literatureValue);
  });

  it("labels an approved override as the highest-priority basis", () => {
    const state = createDemoState();
    const profile = state.settings.coefficientProfiles[0];
    profile.overrideValues.heatLossFractionBase = 0.04;
    profile.overrideStatus = "site_approved";
    profile.approvedBy = "BOF supervisor";
    profile.approvalReason = "Local shadow validation";
    profile.approvedAt = "2026-08-22T00:00:00Z";
    const result = calculateEndpoint(state.heats[0], state.settings);
    expect(result.basis.status).toBe("site_approved");
    expect(result.basis.approved).toBe(true);
  });

  it("returns an explicit unavailable result when the coefficient profile is missing", () => {
    const state = createDemoState();
    state.heats[0].coefficientProfileId = "MISSING";
    const result = calculateEndpoint(state.heats[0], state.settings);
    expect(result.carbon.available).toBe(false);
    expect(result.carbon.reason).toBe("coefficient_profile_missing");
    expect(result.temperature.available).toBe(false);
  });

  it("fails closed when loaded coefficient scenarios are invalid", () => {
    const state = createDemoState();
    state.settings.coefficientProfiles[0].overrideValues.oxygenPurityFraction = 1.5;
    const result = calculateEndpoint(state.heats[0], state.settings);
    expect(result.carbon.available).toBe(false);
    expect(result.carbon.reason).toBe("coefficient_profile_invalid");
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
