import { describe, expect, it } from "vitest";
import { buildAdditionEvidenceLedger } from "../src/calibration/additionEvidence.js";
import { buildAdditionCorrectionRecommendations } from "../src/calibration/additionRecommendations.js";
import { createEmptyState } from "../src/data/demoState.js";

function evidenceHeat(index, { demo = false, ratio = 0.8, profileVersionId = "ADD-LIT-001-V1", day = index, operator = `OP-${index % 3}`, actualAmount = 100 } = {}) {
  const base = new Date(Date.UTC(2026, 0, 1 + day, 0, 0, 0));
  const at = (minute) => new Date(base.getTime() + minute * 60000).toISOString();
  const recommended = 100;
  const actual = actualAmount;
  const expectedDelta = -20;
  return {
    id: `H-${index}`, gradeCode: "DEMO-LC", equipmentProfileId: "BOF-DEMO-A", coefficientProfileId: "COEF-LIT-001", demo,
    status: "completed", stage: "G8", startedAt: at(0), referenceSnapshot: { mode: demo ? "demo_snapshot" : "manual_reference", gradeProfile: { targets: { temperature: { min: 1650, max: 1700 } } } },
    events: [{ id: `EV-${index}`, type: "material", status: "active", occurredAt: at(10), recordedAt: at(10), recordedBy: { displayName: operator }, payload: { materialCode: "COOL-DEMO", materialCategory: "coolant", amountKg: actual } }],
    samples: [
      { id: `SB-${index}`, status: "active", sampledAt: at(5), analysisResults: [{ id: `AB-${index}`, status: "active", occurredAt: at(6), recordedAt: at(6), values: { temperature: 1720 } }] },
      { id: `SA-${index}`, status: "active", sampledAt: at(15), analysisResults: [{ id: `AA-${index}`, status: "active", occurredAt: at(16), recordedAt: at(16), values: { temperature: 1720 + expectedDelta * actual / recommended * ratio } }] },
    ],
    additionCoach: { operatorPlans: [], decisions: [], proposals: [{ id: `PROP-${index}`, status: "active", triggerId: `EV-${index}`, calculatedAt: at(10), result: { profile: { id: "ADD-LIT-001", versionId: profileVersionId, formulaVersion: "BOF-ADD-REF 0.7.2" }, recommendations: [{ model: "coolant", operationType: "material", materialCode: "COOL-DEMO", amount: { midpoint: recommended, unit: "kg" }, effects: { temperature: { estimatedDeltaC: expectedDelta } }, coefficientSnapshot: { coolantAmountMultiplier: 1 } }] } }] },
  };
}

describe("addition correction learning", () => {
  it("derives an isolated coolant effect ratio and an amount-correction target", () => {
    const state = createEmptyState();
    state.heats = [evidenceHeat(1)];
    const [row] = buildAdditionEvidenceLedger(state);
    expect(row.eligible).toBe(true);
    expect(row.effectRatio).toBeCloseTo(0.8, 8);
    expect(row.inferredCorrection).toBeCloseTo(1.25, 8);
  });

  it("excludes evidence when another addition confounds the before/after interval", () => {
    const state = createEmptyState();
    const heat = evidenceHeat(2);
    heat.events.push({ id: "INTERFERE", type: "reblow", status: "active", occurredAt: new Date(new Date(heat.startedAt).getTime() + 12 * 60000).toISOString(), payload: { additionalOxygenNm3: 100 } });
    state.heats = [heat];
    const [row] = buildAdditionEvidenceLedger(state);
    expect(row.eligible).toBe(false);
    expect(row.exclusionReason).toBe("confounded_by_other_action");
  });

  it("requires real, distributed, holdout-improving evidence before field approval", () => {
    const state = createEmptyState();
    state.heats = Array.from({ length: 70 }, (_, index) => evidenceHeat(index, { ratio: 0.8, day: index % 14, operator: `OP-${index % 3}`, actualAmount: [80, 100, 120][index % 3] }));
    const ledger = buildAdditionEvidenceLedger(state);
    const [recommendation] = buildAdditionCorrectionRecommendations(state, ledger);
    expect(recommendation.candidateValue).toBeCloseTo(1.25, 8);
    expect(recommendation.validationCount).toBe(20);
    expect(recommendation.eligibleForApproval).toBe(true);
  });

  it("builds a separate timing-shift candidate only from an earlier proposal and a target-hit result", () => {
    const state = createEmptyState();
    const heat = evidenceHeat(71, { ratio: 1 });
    const at = (minute) => new Date(new Date(heat.startedAt).getTime() + minute * 60000).toISOString();
    heat.events[0].occurredAt = at(12);
    heat.additionCoach.proposals.unshift({
      id: "PROP-TIMING-71",
      status: "active",
      triggerId: null,
      calculatedAt: at(4),
      result: {
        profile: { id: "ADD-LIT-001", versionId: "ADD-LIT-001-V1", formulaVersion: "BOF-ADD-REF 0.7.2" },
        recommendations: [{ model: "coolant", operationType: "material", materialCode: "COOL-DEMO", amount: { midpoint: 100, unit: "kg" }, timing: { startAt: at(8), endAt: at(10) }, effects: { temperature: { estimatedDeltaC: -20 } }, coefficientSnapshot: { coolantAmountMultiplier: 1, timingShiftMinutes: 0 } }],
      },
    });
    state.heats = [heat];
    const ledger = buildAdditionEvidenceLedger(state);
    expect(ledger[0].timingEligible).toBe(true);
    const timing = buildAdditionCorrectionRecommendations(state, ledger).find((item) => item.correctionKey === "timingShiftMinutes");
    expect(timing.candidateValue).toBeCloseTo(3, 8);
    expect(timing.bandKind).toBe("timing");
  });

  it("never promotes DEMO evidence", () => {
    const state = createEmptyState();
    state.heats = Array.from({ length: 70 }, (_, index) => evidenceHeat(index, { demo: true, day: index % 14, operator: `OP-${index % 3}`, actualAmount: [80, 100, 120][index % 3] }));
    const [recommendation] = buildAdditionCorrectionRecommendations(state, buildAdditionEvidenceLedger(state));
    expect(recommendation.eligibleForApproval).toBe(false);
    expect(recommendation.reason).toBe("synthetic_rows_not_field_eligible");
  });
});
