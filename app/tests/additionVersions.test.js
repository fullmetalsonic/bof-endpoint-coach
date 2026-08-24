import { describe, expect, it } from "vitest";
import { createLiteratureAdditionProfile } from "../src/calculation/addition/additionProfile.js";
import { restoreAdditionVersion, versionAdditionProfiles } from "../src/domain/addition/additionVersions.js";
import { addOperatorPlan, recordAdditionDecision } from "../src/domain/addition/operatorPlan.js";

describe("addition model version history", () => {
  it("archives an applied profile and preserves a restorable snapshot", () => {
    const previous = createLiteratureAdditionProfile();
    const draft = structuredClone(previous);
    draft.corrections.fluxAmountMultiplier = 1.05;
    const [versioned] = versionAdditionProfiles([previous], [draft], { displayName: "작업자" }, "현장 후보 검토", new Date("2026-08-24T01:02:03.000Z"));
    expect(versioned.parentVersionId).toBe(previous.versionId);
    expect(versioned.versionHistory).toHaveLength(1);
    expect(versioned.versionHistory[0].profile.corrections.fluxAmountMultiplier).toBe(1);
    const restored = restoreAdditionVersion(versioned, previous.versionId);
    expect(restored.corrections.fluxAmountMultiplier).toBe(1);
    expect(restored.restoredFromVersionId).toBe(previous.versionId);
  });
});

describe("operator addition-plan history", () => {
  it("keeps one active plan and supersedes the prior plan", () => {
    const heat = { id: "H-1", stage: "G3", startedAt: "2026-08-24T00:00:00.000Z", additionCoach: { hidden: false, operatorPlans: [], proposals: [], decisions: [] } };
    const input = { operationType: "material", materialCode: "LIME", amount: 100, timingMode: "now" };
    const first = addOperatorPlan(heat, input, { displayName: "A" }, "2026-08-24T00:10:00.000Z");
    const second = addOperatorPlan(first, { ...input, amount: 120 }, { displayName: "A" }, "2026-08-24T00:11:00.000Z");
    expect(second.additionCoach.operatorPlans.map((plan) => plan.status)).toEqual(["superseded", "active"]);
    expect(second.additionCoach.operatorPlans[1].correctionOf).toBe(second.additionCoach.operatorPlans[0].id);
  });

  it("does not duplicate the same decision for one proposal", () => {
    const heat = { id: "H-1", stage: "G6", additionCoach: { hidden: false, operatorPlans: [], proposals: [{ id: "P-1" }], decisions: [] } };
    const first = recordAdditionDecision(heat, "P-1", "keep_operator_plan", { displayName: "A" }, "2026-08-24T00:10:00.000Z");
    const second = recordAdditionDecision(first, "P-1", "keep_operator_plan", { displayName: "A" }, "2026-08-24T00:11:00.000Z");
    expect(second).toBe(first);
    expect(second.additionCoach.decisions).toHaveLength(1);
  });
});
