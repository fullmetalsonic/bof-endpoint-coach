import { describe, expect, it } from "vitest";
import { createReferenceSettings } from "../src/data/referenceSettings.js";
import { diffSettings, prepareSettingsRevision } from "../src/domain/settingsRevision.js";

describe("settings revision", () => {
  it("records field differences without treating revision metadata as a setting change", () => {
    const current = createReferenceSettings();
    const draft = structuredClone(current);
    draft.equipmentProfiles[0].nominalCapacityT = 275;
    const changes = diffSettings(current, draft);
    expect(changes).toEqual([{ path: "equipmentProfiles[0].nominalCapacityT", before: 260, after: 275 }]);
  });

  it("creates a new immutable version with operator, reason, and field changes", () => {
    const current = createReferenceSettings();
    const draft = structuredClone(current);
    draft.gradeProfiles[0].targets.C.max = 0.09;
    const revised = prepareSettingsRevision(current, draft, { displayName: "기준 관리자" }, "강종 기준 검토", new Date("2026-08-23T06:00:00.123Z"));
    expect(revised.version).toBe("LOCAL-REF-20260823060000123");
    expect(revised.lastRevision.previousVersion).toBe("DEMO-REF-001");
    expect(revised.lastRevision.changedBy).toBe("기준 관리자");
    expect(revised.lastRevision.reason).toBe("강종 기준 검토");
    expect(revised.lastRevision.changes[0].path).toBe("gradeProfiles[0].targets.C.max");
  });

  it("archives coefficient values as a dated version before applying a new offset", () => {
    const current = createReferenceSettings();
    const previousVersionId = current.coefficientProfiles[0].versionId;
    const draft = structuredClone(current);
    draft.coefficientProfiles[0].calibrationOffsets.P = 0.0015;
    const revised = prepareSettingsRevision(current, draft, { displayName: "취련 책임자" }, "P 오차 보정 검토", new Date("2026-08-23T07:00:00.000Z"));
    const profile = revised.coefficientProfiles[0];
    expect(profile.parentVersionId).toBe(previousVersionId);
    expect(profile.versionId).toBe("COEF-LIT-001-V-20260823070000000");
    expect(profile.versionHistory).toHaveLength(1);
    expect(profile.versionHistory[0].profile.calibrationOffsets.P).toBe(0);
    expect(profile.versionHistory[0].changeReason).toBe("P 오차 보정 검토");
    expect(profile.calibrationOffsets.P).toBe(0.0015);
  });
});
