import { describe, expect, it } from "vitest";
import { advanceHeat, applyHeatEvent, archiveHeat, canDeleteHeat, cancelHeat, createHeatFromForm } from "../src/domain/heatOperations.js";

const operator = { displayName: "김작업" };
const baseForm = {
  id: "H-001", gradeCode: "DEMO-LC", equipmentProfileId: "BOF-DEMO-A", coefficientProfileId: "COEF-LIT-001",
  startedAt: "2026-08-22T01:00:00.000Z", expectedDurationMinutes: "40",
  hotMetalKg: "", hotMetalC: "", hotMetalSi: "", hotMetalMn: "", hotMetalP: "", hotMetalTemperatureC: "",
  scrapKg: "", scrapC: "", fluxKg: "", plannedTotalOxygenNm3: "", cumulativeOxygenNm3: "", lanceHeightM: "", oxygenFlowNm3PerMinute: "",
};

describe("heat operations", () => {
  it("creates a real heat at G0 without invented numeric values", () => {
    const heat = createHeatFromForm(baseForm, operator, "2026-08-22T01:00:01.000Z");
    expect(heat.stage).toBe("G0");
    expect(heat.demo).toBe(false);
    expect(heat.initial.hotMetalKg).toBeNull();
    expect(heat.process.cumulativeOxygenNm3).toBe(0);
    expect(heat.stageHistory[0].recordedBy.displayName).toBe("김작업");
  });

  it("runs the manual G0-G8 lifecycle and records real transition times", () => {
    let heat = createHeatFromForm(baseForm, operator);
    for (const stage of ["G1", "G2", "G3", "G4", "G5"]) {
      heat = advanceHeat(heat, { occurredAt: `2026-08-22T01:0${stage.slice(1)}:00.000Z`, note: "", cumulativeOxygenNm3: "", lanceHeightM: "", oxygenFlowNm3PerMinute: "" }, operator);
      expect(heat.stage).toBe(stage);
    }
    heat = applyHeatEvent(heat, "sample", { sampleId: "S-1", occurredAt: "2026-08-22T01:06:00.000Z" }, operator);
    heat = applyHeatEvent(heat, "analysis", { sampleId: "S-1", occurredAt: "2026-08-22T01:07:00.000Z", method: "OES", cumulativeOxygenNm3: "12000", values: { C: "0.06", temperature: "1670" } }, operator);
    heat = advanceHeat(heat, { occurredAt: "2026-08-22T01:08:00.000Z", note: "", cumulativeOxygenNm3: "", lanceHeightM: "", oxygenFlowNm3PerMinute: "" }, operator);
    expect(heat.stage).toBe("G6");
    heat = applyHeatEvent(heat, "tap", { occurredAt: "2026-08-22T01:09:00.000Z", note: "" }, operator);
    expect(heat.status).toBe("tapped");
    expect(heat.stage).toBe("G7");
    heat = advanceHeat(heat, { occurredAt: "2026-08-22T01:10:00.000Z", note: "", cumulativeOxygenNm3: "", lanceHeightM: "", oxygenFlowNm3PerMinute: "" }, operator);
    expect(heat.status).toBe("completed");
    expect(heat.stage).toBe("G8");
    expect(heat.stageHistory.at(-1).occurredAt).toBe("2026-08-22T01:10:00.000Z");
  });

  it("blocks G5 advance without adopted C and temperature", () => {
    let heat = createHeatFromForm(baseForm, operator);
    for (let index = 0; index < 5; index += 1) heat = advanceHeat(heat, { occurredAt: baseForm.startedAt }, operator);
    expect(() => advanceHeat(heat, { occurredAt: baseForm.startedAt }, operator)).toThrow("endpoint_sample_required");
  });

  it("does not overwrite sampling time when analysis arrives", () => {
    let heat = { ...createHeatFromForm(baseForm, operator), stage: "G3", stageLabelKo: "용해 중기", stageLabelEn: "Mid blow" };
    heat = applyHeatEvent(heat, "sample", { sampleId: "S-1", occurredAt: "2026-08-22T01:03:00.000Z" }, operator);
    heat = applyHeatEvent(heat, "analysis", { sampleId: "S-1", occurredAt: "2026-08-22T01:05:00.000Z", method: "OES", cumulativeOxygenNm3: "5000", values: { C: "0.2" } }, operator);
    expect(heat.samples[0].sampledAt).toBe("2026-08-22T01:03:00.000Z");
    expect(heat.samples[0].analyzedAt).toBe("2026-08-22T01:05:00.000Z");
  });

  it("supports delete eligibility, cancellation, and archival", () => {
    const draft = createHeatFromForm(baseForm, operator);
    expect(canDeleteHeat(draft)).toBe(true);
    const active = { ...draft, stage: "G1", events: [...draft.events, { type: "checkpoint" }] };
    expect(canDeleteHeat(active)).toBe(false);
    const cancelled = cancelHeat(active, "시험 취소", operator, baseForm.startedAt);
    expect(cancelled.status).toBe("cancelled");
    expect(archiveHeat(cancelled, operator, baseForm.startedAt).status).toBe("archived");
  });
});
