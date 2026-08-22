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
});
