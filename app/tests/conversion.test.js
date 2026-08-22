import { describe, expect, it } from "vitest";
import { convertConcentrationFromPercent, convertConcentrationToPercent, convertMassFromKg, convertMassToKg, isSupportedConcentrationUnit, isSupportedMassUnit } from "../src/units/conversion.js";

describe("unit conversion", () => {
  it("normalizes operator mass input to kilograms", () => {
    expect(convertMassToKg(0.5, "t")).toBe(500);
    expect(convertMassToKg(500, "kg")).toBe(500);
    expect(convertMassToKg(500000, "g")).toBe(500);
  });

  it("restores canonical kilograms to the operator-selected display unit", () => {
    expect(convertMassFromKg(230000, "t")).toBe(230);
    expect(convertMassFromKg(500, "kg")).toBe(500);
    expect(convertMassFromKg(0.5, "g")).toBe(500);
  });

  it("rejects unsupported or invalid mass input", () => {
    expect(Number.isNaN(convertMassToKg(-1, "kg"))).toBe(true);
    expect(Number.isNaN(convertMassToKg(1, "lb"))).toBe(true);
    expect(isSupportedMassUnit("t")).toBe(true);
  });
});

describe("concentration conversion", () => {
  it("normalizes percent and ppm to percent", () => {
    expect(convertConcentrationToPercent(0.02, "%")).toBe(0.02);
    expect(convertConcentrationToPercent(200, "ppm")).toBe(0.02);
    expect(convertConcentrationToPercent(0.02, "wt%")).toBe(0.02);
  });

  it("restores canonical percent to the operator-selected display unit", () => {
    expect(convertConcentrationFromPercent(0.02, "ppm")).toBe(200);
    expect(convertConcentrationFromPercent(0.02, "%")).toBe(0.02);
  });

  it("rejects unsupported or negative concentration values", () => {
    expect(Number.isNaN(convertConcentrationToPercent(-1, "ppm"))).toBe(true);
    expect(Number.isNaN(convertConcentrationToPercent(1, "ppb"))).toBe(true);
    expect(isSupportedConcentrationUnit("ppm")).toBe(true);
  });
});
