import { describe, expect, it } from "vitest";
import { convertMassToKg, isSupportedMassUnit } from "../src/units/conversion.js";

describe("unit conversion", () => {
  it("normalizes operator mass input to kilograms", () => {
    expect(convertMassToKg(0.5, "t")).toBe(500);
    expect(convertMassToKg(500, "kg")).toBe(500);
    expect(convertMassToKg(500000, "g")).toBe(500);
  });

  it("rejects unsupported or invalid mass input", () => {
    expect(Number.isNaN(convertMassToKg(-1, "kg"))).toBe(true);
    expect(Number.isNaN(convertMassToKg(1, "lb"))).toBe(true);
    expect(isSupportedMassUnit("t")).toBe(true);
  });
});
