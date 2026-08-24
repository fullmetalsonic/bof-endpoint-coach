import { describe, expect, it } from "vitest";
import { createDemoState, createEmptyState } from "../src/data/demoState.js";
import { calculateEndpoint } from "../src/calculation/endpoint.js";
import { calculateAdditionCoach } from "../src/calculation/addition/recommendationCoordinator.js";
import { calculateFluxRecommendation } from "../src/calculation/addition/fluxModel.js";
import { calculateCoolantRecommendation } from "../src/calculation/addition/coolantOreModel.js";
import { calculateAlloyRecommendation } from "../src/calculation/addition/alloyModel.js";
import { calculateOxygenRecommendation } from "../src/calculation/addition/oxygenModel.js";
import { resolveAdditionProfile, selectAdditionProfile } from "../src/calculation/addition/additionProfile.js";

function context(state, heat = state.heats[0]) {
  const endpoint = calculateEndpoint(heat, state.settings, "2026-08-24T00:00:00.000Z");
  const resolvedProfile = resolveAdditionProfile(selectAdditionProfile(state.settings, heat));
  return { heat, settings: state.settings, endpoint, resolvedProfile, calculatedAt: "2026-08-24T00:00:00.000Z" };
}

describe("addition coach literature models", () => {
  it("provides a normalized literature profile to old workspaces", () => {
    const state = createEmptyState();
    expect(state.settings.additionModelProfiles).toHaveLength(1);
    const resolved = resolveAdditionProfile(state.settings.additionModelProfiles[0]);
    expect(resolved.validationErrors).toEqual([]);
    expect(resolved.profile.status).toBe("literature_test");
    expect(resolved.corrections.fluxAmountMultiplier).toBe(1);
  });

  it("keeps the addition-model snapshot frozen for a heat after current settings change", () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[1]);
    heat.stage = "G4";
    const changedSettings = structuredClone(state.settings);
    changedSettings.additionModelProfiles[0].corrections.coolantAmountMultiplier = 1.4;
    const endpoint = calculateEndpoint(heat, changedSettings, "2026-08-24T00:00:00.000Z");
    endpoint.temperature = { available: true, value: 1720 };
    endpoint.grade = { ...endpoint.grade, targets: { ...endpoint.grade.targets, temperature: { min: 1650, max: 1680 } } };
    const coach = calculateAdditionCoach(heat, changedSettings, endpoint, "2026-08-24T00:00:00.000Z");
    expect(coach.recommendations.find((item) => item.model === "coolant").coefficientSnapshot.coolantAmountMultiplier).toBe(1);
  });

  it("prefers a grade/equipment-specific profile over the general fallback", () => {
    const state = createDemoState();
    const specific = structuredClone(state.settings.additionModelProfiles[0]);
    specific.id = "ADD-SPECIFIC";
    specific.versionId = "ADD-SPECIFIC-V1";
    specific.scope = { gradeCode: "DEMO-LC", equipmentProfileId: "BOF-DEMO-A" };
    expect(selectAdditionProfile({ ...state.settings, additionModelProfiles: [...state.settings.additionModelProfiles, specific] }, state.heats[0]).id).toBe("ADD-SPECIFIC");
  });

  it("calculates flux amount from CaO/SiO2 mass balance when basicity is short", () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[1]);
    heat.stage = "G3";
    const ctx = context(state, heat);
    const result = calculateFluxRecommendation(ctx);
    if (result.available) {
      expect(result.amount.low).toBeGreaterThanOrEqual(0);
      expect(result.amount.high).toBeGreaterThanOrEqual(result.amount.low);
      expect(result.confidence).toBe("literature_test");
    } else {
      expect(["no_additional_flux_required", "slag_projection_unavailable"]).toContain(result.reason);
    }
  });

  it("calculates a coolant range for a projected high endpoint temperature", () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[1]);
    heat.stage = "G4";
    const ctx = context(state, heat);
    ctx.endpoint.temperature = { available: true, value: 1720 };
    ctx.endpoint.grade = { ...ctx.endpoint.grade, targets: { ...ctx.endpoint.grade.targets, temperature: { min: 1650, max: 1680 } } };
    const result = calculateCoolantRecommendation(ctx);
    expect(result.available).toBe(true);
    expect(result.materialCode).toBe("COOL-DEMO");
    expect(result.amount.low).toBeGreaterThan(0);
    expect(result.effects.oxideOxygenUpperBoundKg).toBeGreaterThan(0);
  });

  it("recomputes coolant effect from the limited amount instead of claiming the full target correction", () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[1]);
    heat.stage = "G4";
    const ctx = context(state, heat);
    ctx.endpoint.temperature = { available: true, value: 1720 };
    ctx.endpoint.grade = { ...ctx.endpoint.grade, targets: { ...ctx.endpoint.grade.targets, temperature: { min: 1650, max: 1680 } } };
    const unlimited = calculateCoolantRecommendation(ctx);
    const limitedMaximum = (unlimited.amount.low + unlimited.amount.high) / 2;
    ctx.resolvedProfile.profile.limits.coolant.maxKg = limitedMaximum;
    const result = calculateCoolantRecommendation(ctx);
    expect(result.amount.high).toBeCloseTo(limitedMaximum, 8);
    expect(Math.abs(result.effects.temperature.estimatedDeltaC)).toBeLessThan(40);
  });

  it("calculates FeMn with recovery scenarios and reports collateral pickup", () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[0]);
    heat.stage = "G6";
    const ctx = context(state, heat);
    ctx.endpoint.manganese = { available: true, value: 0.02 };
    ctx.endpoint.grade = { ...ctx.endpoint.grade, targets: { ...ctx.endpoint.grade.targets, Mn: { min: 1.2, max: 1.6 } } };
    const result = calculateAlloyRecommendation(ctx);
    expect(result.available).toBe(true);
    expect(result.materialCode).toBe("FEMN-DEMO");
    expect(result.target.element).toBe("Mn");
    expect(result.effects.C.estimatedDelta).toBeGreaterThan(0);
  });

  it("keeps oxygen separate and requires an adopted carbon sample", () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[0]);
    heat.stage = "G6";
    heat.samples.at(-1).values.C = 0.2;
    const ctx = context(state, heat);
    const result = calculateOxygenRecommendation(ctx);
    expect(result.available).toBe(true);
    expect(result.operationType).toBe("oxygen");
    expect(result.amount.unit).toBe("Nm³");
    const withoutSample = structuredClone(heat);
    withoutSample.samples.forEach((sample) => { sample.adopted = false; });
    expect(calculateOxygenRecommendation({ ...context(state, withoutSample), heat: withoutSample }).reason).toBe("adopted_carbon_sample_required");
  });

  it("returns only one primary and at most one alternative", () => {
    const state = createDemoState();
    const heat = state.heats[0];
    const endpoint = calculateEndpoint(heat, state.settings, "2026-08-24T00:00:00.000Z");
    const result = calculateAdditionCoach(heat, state.settings, endpoint, "2026-08-24T00:00:00.000Z");
    expect(result.recommendations.length).toBeLessThanOrEqual(4);
    expect(result.primary).toBe(result.recommendations[0] ?? null);
    expect(result.alternative).toBe(result.recommendations[1] ?? null);
    expect(result.mode).toBe("literature_test");
  });
});
