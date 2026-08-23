import { describe, expect, it } from "vitest";
import { buildCalibrationRecommendations, learningStage } from "../src/calibration/recommendation.js";
import { calculateEndpoint } from "../src/calculation/endpoint.js";
import { calculateSampleResiduals } from "../src/calculation/chemistry/sampleResiduals.js";
import { createDemoState } from "../src/data/demoState.js";
import { restoreCoefficientVersion } from "../src/domain/coefficientVersions.js";
import { prepareSettingsRevision } from "../src/domain/settingsRevision.js";
import { capturePredictionSnapshot } from "../src/domain/predictionHistory.js";

function residualRows(count, { residual = 0.01, synthetic = false } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    id: `R-${index}`,
    groupKey: "DEMO-LC|BOF-A|FORMULA|COEF",
    element: "P",
    unit: "%",
    predicted: 0.015,
    actual: 0.015 + residual,
    residual,
    actualAt: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
    coefficientVersionId: "COEF-V1",
    calibrationOffset: 0,
    synthetic,
  }));
}

describe("learning correction loop", () => {
  it("keeps evidence thresholds explicit and holds out the latest 20 rows", () => {
    expect(learningStage(9)).toBe("ledger_only");
    expect(learningStage(10)).toBe("bias_direction");
    expect(learningStage(30)).toBe("provisional_candidate");
    expect(learningStage(50)).toBe("validation_set_pending");
    expect(learningStage(70)).toBe("validation_ready");
    const recommendation = buildCalibrationRecommendations(residualRows(70), { P: 0 }, "COEF-V1")[0];
    expect(recommendation.trainingCount).toBe(50);
    expect(recommendation.validationCount).toBe(20);
    expect(recommendation.candidateOffset).toBeCloseTo(0.01, 9);
    expect(recommendation.validationCandidate.mae).toBeCloseTo(0, 9);
    expect(recommendation.eligibleForApproval).toBe(true);
  });

  it("keeps residuals from different coefficient versions in separate groups and blocks historical recommendations", () => {
    const oldRows = residualRows(30).map((row) => ({ ...row, coefficientVersionId: "COEF-V1", groupKey: "DEMO-LC|BOF-A|FORMULA|COEF-V1|FIELD" }));
    const currentRows = residualRows(30).map((row, index) => ({ ...row, id: `CURRENT-${index}`, coefficientVersionId: "COEF-V2", groupKey: "DEMO-LC|BOF-A|FORMULA|COEF-V2|FIELD" }));
    const recommendations = buildCalibrationRecommendations([...oldRows, ...currentRows], { P: 0.002 }, "COEF-V2");
    expect(recommendations).toHaveLength(2);
    expect(recommendations.find((item) => item.coefficientVersionId === "COEF-V1")).toMatchObject({ versionCurrent: false, eligibleForApproval: false, reason: "historical_coefficient_version" });
    expect(recommendations.find((item) => item.coefficientVersionId === "COEF-V2")).toMatchObject({ versionCurrent: true, currentOffset: 0.002 });
  });

  it("never makes synthetic DEMO residuals field-approval eligible", () => {
    const recommendation = buildCalibrationRecommendations(residualRows(100, { synthetic: true }), { P: 0 })[0];
    expect(recommendation.stage).toBe("synthetic_only");
    expect(recommendation.eligibleForApproval).toBe(false);
  });

  it("keeps every sample residual for comparison but marks only the adopted analysis as the endpoint anchor", () => {
    const state = createDemoState();
    const heat = state.heats[0];
    const calculation = calculateEndpoint(heat, state.settings);
    const rows = calculateSampleResiduals(heat, state.settings, calculation);
    expect(rows).toHaveLength(18);
    expect(rows.filter((row) => row.adopted)).toHaveLength(6);
    expect(new Set(rows.map((row) => row.sampleId))).toEqual(new Set(["S-DEMO-01", "S-DEMO-02", "S-DEMO-03"]));
  });

  it("snapshots all six estimates with the coefficient version used at that time", () => {
    const state = createDemoState();
    const heat = capturePredictionSnapshot(state.heats[0], state.settings, { type: "checkpoint", id: "EV-1" }, "2026-08-23T00:00:00.000Z");
    const snapshot = heat.predictionSnapshots.at(-1);
    for (const key of ["carbon", "temperature", "phosphorus", "manganese", "silicon", "sulfur"]) expect(snapshot[key].available).toBe(true);
    expect(snapshot.coefficientVersionId).toBe("COEF-LIT-001-V1");
  });

  it("restores an archived coefficient as a new draft without deleting later history", () => {
    const state = createDemoState();
    const current = state.settings;
    const draft = structuredClone(current);
    draft.coefficientProfiles[0].calibrationOffsets.P = 0.002;
    const revised = prepareSettingsRevision(current, draft, { displayName: "검증자" }, "첫 보정", new Date("2026-08-23T01:00:00.000Z"));
    const profile = revised.coefficientProfiles[0];
    const restored = restoreCoefficientVersion(profile, "COEF-LIT-001-V1");
    expect(restored.calibrationOffsets.P).toBe(0);
    expect(restored.versionHistory).toHaveLength(1);
    expect(restored.restoredFromVersionId).toBe("COEF-LIT-001-V1");
    expect(profile.calibrationOffsets.P).toBe(0.002);
  });
});
