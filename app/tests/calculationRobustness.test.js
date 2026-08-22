import { describe, expect, it } from "vitest";
import { calculateEndpoint } from "../src/calculation/endpoint.js";
import { createDemoState } from "../src/data/demoState.js";

function generator(seed = 20260822) {
  let value = seed >>> 0;
  return (min, max) => {
    value = (1664525 * value + 1013904223) >>> 0;
    return min + (value / 2 ** 32) * (max - min);
  };
}

describe("calculation robustness scenarios", () => {
  it("keeps 50 varied valid charge scenarios finite without inventing unavailable outputs", () => {
    const random = generator();
    const state = createDemoState();
    for (let index = 0; index < 50; index += 1) {
      const heat = structuredClone(state.heats[0]);
      heat.samples = [];
      heat.initial = {
        ...heat.initial,
        hotMetalKg: random(150000, 320000),
        hotMetalC: random(3.5, 5.2),
        hotMetalSi: random(0.1, 1.2),
        hotMetalMn: random(0.02, 0.8),
        hotMetalP: random(0.03, 0.3),
        hotMetalTemperatureC: random(1250, 1500),
        scrapKg: random(10000, 80000),
        scrapC: random(0.05, 1),
        fluxKg: random(5000, 20000),
        plannedTotalOxygenNm3: random(8000, 25000),
      };
      const result = calculateEndpoint(heat, state.settings);
      expect(result.carbon.available).toBe(true);
      expect(Number.isFinite(result.carbon.value)).toBe(true);
      expect(result.carbon.value).toBeGreaterThanOrEqual(0);
      expect(result.carbon.low).toBeLessThanOrEqual(result.carbon.value);
      expect(result.carbon.high).toBeGreaterThanOrEqual(result.carbon.value);
      if (result.temperature.available) {
        expect(Number.isFinite(result.temperature.value)).toBe(true);
        expect(result.temperature.value).toBeGreaterThanOrEqual(1200);
        expect(result.temperature.value).toBeLessThanOrEqual(2100);
      }
    }
  });

  it("does not raise static endpoint carbon when planned oxygen is increased", () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[0]);
    heat.samples = [];
    const lowOxygen = calculateEndpoint({ ...heat, initial: { ...heat.initial, plannedTotalOxygenNm3: 10000 } }, state.settings);
    const highOxygen = calculateEndpoint({ ...heat, initial: { ...heat.initial, plannedTotalOxygenNm3: 14000 } }, state.settings);
    expect(highOxygen.carbon.value).toBeLessThanOrEqual(lowOxygen.carbon.value);
  });

  it("moves the anchored endpoint by the same carbon correction entered for the adopted sample", () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[0]);
    const baseline = calculateEndpoint(heat, state.settings).carbon.value;
    heat.samples.at(-1).analysisResults[0].values.C += 0.01;
    const corrected = calculateEndpoint(heat, state.settings).carbon.value;
    expect(corrected - baseline).toBeCloseTo(0.01, 8);
  });
});
