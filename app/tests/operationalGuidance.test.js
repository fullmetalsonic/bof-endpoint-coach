import { describe, expect, it } from "vitest";
import { calculateEndpoint, qualityRows } from "../src/calculation/endpoint.js";
import { createDemoState } from "../src/data/demoState.js";
import { getOpenChecks, getStageGuidance } from "../src/domain/operationalGuidance.js";

describe("operational guidance", () => {
  it("changes the next action with the active process gate", () => {
    expect(getStageGuidance("G3", "ko").title).toBe("중간 체크포인트 확인");
    expect(getStageGuidance("G6", "en").title).toBe("Take final pre-tap sample");
  });

  it("flags out-of-target endpoint estimates for the early heat", () => {
    const state = createDemoState();
    const heat = state.heats[1];
    heat.samples[0].values.C = 0.01;
    heat.samples[0].values.temperature = 1800;
    const calculation = calculateEndpoint(heat, state.settings, "2026-08-22T10:24:05+09:00");
    const rows = qualityRows(heat, state.settings, calculation);
    const checks = getOpenChecks(heat, rows, "ko").map((item) => item.text);
    expect(checks).toContain("탄소 종점 예상 하한 미달");
    expect(checks).toContain("온도 종점 예상 상한 초과");
  });
});
