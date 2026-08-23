import { describe, expect, it } from "vitest";
import { calculateEndpoint, qualityRows } from "../src/calculation/endpoint.js";
import { createDemoState } from "../src/data/demoState.js";
import { predictionExplanations } from "../src/domain/predictionExplanation.js";

describe("prediction explanations", () => {
  it("reconciles literature baseline, sample adjustment, approved offset, and final estimate", () => {
    const state = createDemoState();
    state.settings.coefficientProfiles[0].calibrationOffsets.P = 0.001;
    state.heats[0].referenceSnapshot.coefficientProfile.calibrationOffsets.P = 0.001;
    const calculation = calculateEndpoint(state.heats[0], state.settings, "2026-08-23T02:00:00.000Z");
    const rows = qualityRows(state.heats[0], state.settings, calculation);
    const explanations = predictionExplanations(state.heats[0], rows, calculation, []);
    expect(Object.keys(explanations)).toEqual(["C", "temperature", "P", "Mn", "Si", "S"]);
    expect(explanations.P.calibrationOffset).toBe(0.001);
    expect(explanations.P.sampleId).toBe("S-DEMO-03");
    expect(explanations.P.equationVerified).toBe(true);
    expect(explanations.P.finalValue).toBeCloseTo(explanations.P.literatureBase + explanations.P.sampleAdjustment + explanations.P.calibrationOffset, 10);
    expect(explanations.P.warnings).toContain("demo_or_reference_profile");
  });

  it("does not invent an explanation when a prediction is unavailable", () => {
    const state = createDemoState();
    delete state.heats[0].initial.plannedTotalOxygenNm3;
    const calculation = calculateEndpoint(state.heats[0], state.settings);
    const rows = qualityRows(state.heats[0], state.settings, calculation);
    const explanations = predictionExplanations(state.heats[0], rows, calculation, []);
    expect(explanations.C).toMatchObject({ available: false, reason: "planned_oxygen_missing" });
  });
});
