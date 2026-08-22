import { describe, expect, it } from "vitest";
import { createDemoState } from "../src/data/demoState.js";
import { resolveCoefficientProfile } from "../src/calculation/coefficientProfile.js";
import { calculateMassBalance, oxygenDensityKgPerNm3, scenarioParameters } from "../src/calculation/massBalance.js";

describe("literature mass balance", () => {
  it("derives oxygen density from the configured normal reference condition", () => {
    const values = resolveCoefficientProfile(createDemoState().settings.coefficientProfiles[0]).effectiveValues;
    expect(oxygenDensityKgPerNm3(values)).toBeCloseTo(1.4276, 4);
  });

  it("keeps low, base, and high scenario carbon results ordered for the demo charge", () => {
    const state = createDemoState();
    const heat = state.heats[0];
    const grade = state.settings.gradeProfiles[0];
    const values = resolveCoefficientProfile(state.settings.coefficientProfiles[0]).effectiveValues;
    const results = ["low", "base", "high"].map((name) => calculateMassBalance(heat.initial, grade, values, scenarioParameters(values, name), heat.initial.plannedTotalOxygenNm3));
    expect(results.every((result) => result.available)).toBe(true);
    expect(results[0].carbonPercent).toBeLessThanOrEqual(results[1].carbonPercent);
    expect(results[1].carbonPercent).toBeLessThanOrEqual(results[2].carbonPercent);
    expect(results[1].oxygenInputKg).toBeGreaterThan(0);
    expect(results[1].oxideMasses.FeO).toBeGreaterThan(0);
  });

  it("records which hot-metal chemistry fields were filled by literature fallbacks", () => {
    const state = createDemoState();
    const initial = { ...state.heats[0].initial, hotMetalSi: null, hotMetalMn: null, hotMetalP: null };
    const values = resolveCoefficientProfile(state.settings.coefficientProfiles[0]).effectiveValues;
    const result = calculateMassBalance(initial, state.settings.gradeProfiles[0], values, scenarioParameters(values, "base"), initial.plannedTotalOxygenNm3);
    expect(result.assumedInputs.map((item) => item.field)).toEqual(["hotMetalSi", "hotMetalMn", "hotMetalP"]);
  });
});
