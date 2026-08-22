import { describe, expect, it } from "vitest";
import { createDemoState } from "../src/data/demoState.js";
import { normalizeCoachState } from "../src/data/stateMigration.js";

describe("state migration", () => {
  it("archives a legacy synthetic coefficient profile without changing its ID", () => {
    const state = createDemoState();
    const legacy = {
      id: "COEF-LEGACY-001",
      formulaVersion: "BOF-REF-CALC 0.1.0",
      oxygenEfficiency: 0.95,
    };
    state.settings.coefficientProfiles = [legacy];
    state.heats.forEach((heat) => { heat.coefficientProfileId = legacy.id; });
    const migrated = normalizeCoachState(state);
    const profile = migrated.settings.coefficientProfiles[0];
    expect(profile.id).toBe(legacy.id);
    expect(profile.formulaVersion).toBe("BOF-REF-CALC 0.2.0");
    expect(profile.legacyProfileArchived.oxygenEfficiency).toBe(0.95);
    expect(migrated.operationLog.at(-1).type).toBe("legacy_coefficient_profile_archived");
  });

  it("does not add a migration log for the current literature profile", () => {
    const state = createDemoState();
    const before = state.operationLog.length;
    expect(normalizeCoachState(state).operationLog).toHaveLength(before);
  });
});
