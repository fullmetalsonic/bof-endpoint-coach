import { describe, expect, it } from "vitest";
import { calculateEndpoint, qualityRows } from "../src/calculation/endpoint.js";
import { createDemoState } from "../src/data/demoState.js";
import { getOpenChecks } from "../src/domain/operationalGuidance.js";

describe("operational guidance", () => {
  it("uses the dynamic workflow action when no quality deviation is open", () => {
    const heat = { ...createDemoState().heats[1], stage: "G1", events: [], samples: [] };
    expect(getOpenChecks(heat, [], "ko")[0].text).toBe("현재 작업: 실제 조업값 기록");
  });

  it("flags out-of-target endpoint estimates for the early heat", () => {
    const state = createDemoState();
    const heat = state.heats[1];
    heat.samples[0].analysisResults[0].values.C = 0.01;
    heat.samples[0].analysisResults[0].values.temperature = 1800;
    const calculation = calculateEndpoint(heat, state.settings, "2026-08-22T10:24:05+09:00");
    const rows = qualityRows(heat, state.settings, calculation);
    const checks = getOpenChecks(heat, rows, "ko").map((item) => item.text);
    expect(checks).toContain("탄소 종점 예상 하한 미달");
    expect(checks).toContain("온도 종점 예상 상한 초과");
  });
});
