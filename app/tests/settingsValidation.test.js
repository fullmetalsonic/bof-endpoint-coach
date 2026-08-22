import { describe, expect, it } from "vitest";
import { createDemoState } from "../src/data/demoState.js";
import { validateSettings } from "../src/domain/settingsValidation.js";

describe("settings validation", () => {
  it("accepts the internally consistent demo settings", () => {
    expect(validateSettings(createDemoState().settings)).toEqual([]);
  });

  it("rejects duplicate codes and reversed target bounds", () => {
    const settings = structuredClone(createDemoState().settings);
    settings.gradeProfiles.push(structuredClone(settings.gradeProfiles[0]));
    settings.gradeProfiles[0].targets.C.min = 0.1;
    settings.gradeProfiles[0].targets.C.max = 0.05;
    const errors = validateSettings(settings, "ko");
    expect(errors.some((error) => error.includes("중복"))).toBe(true);
    expect(errors.some((error) => error.includes("최소값"))).toBe(true);
  });

  it("requires approval identity and basis for a site-approved override", () => {
    const settings = structuredClone(createDemoState().settings);
    const profile = settings.coefficientProfiles[0];
    profile.overrideValues.heatLossFractionBase = 0.04;
    profile.overrideStatus = "site_approved";
    profile.approvedAt = "2026-08-22T00:00:00Z";
    const errors = validateSettings(settings, "ko");
    expect(errors.some((error) => error.includes("승인자"))).toBe(true);
  });

  it("rejects impossible fraction values and reversed scenarios", () => {
    const settings = structuredClone(createDemoState().settings);
    const profile = settings.coefficientProfiles[0];
    profile.overrideValues.oxygenPurityFraction = 1.2;
    profile.overrideValues.postCombustionRatioLow = 0.3;
    const errors = validateSettings(settings, "ko");
    expect(errors.some((error) => error.includes("0~1"))).toBe(true);
    expect(errors.some((error) => error.includes("저 ≤ 기준 ≤ 고"))).toBe(true);
  });

  it("rejects an unknown override field", () => {
    const settings = structuredClone(createDemoState().settings);
    settings.coefficientProfiles[0].overrideValues.unknownPlantFactor = 1;
    const errors = validateSettings(settings, "en");
    expect(errors.some((error) => error.includes("unknown override"))).toBe(true);
  });
});
