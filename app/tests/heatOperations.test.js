import { describe, expect, it } from "vitest";
import { advanceHeat, applyHeatEvent, archiveHeat, canDeleteHeat, cancelHeat, createHeatFromForm, updateHeatInputs } from "../src/domain/heatOperations.js";

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

  it("updates initial prediction inputs without changing identity or losing the operator audit trail", () => {
    const heat = createHeatFromForm(baseForm, operator, "2026-08-22T01:00:01.000Z");
    const next = updateHeatInputs(heat, {
      ...baseForm,
      id: "SHOULD-NOT-REPLACE",
      hotMetalKg: "230000",
      hotMetalC: "4.5",
      hotMetalTemperatureC: "1350",
      scrapKg: "30000",
      scrapC: "0.2",
      plannedTotalOxygenNm3: "13000",
      expectedDurationMinutes: "45",
      inputMetadata: { canonicalMassUnit: "kg" },
    }, { displayName: "수정 작업자" }, "2026-08-22T01:01:00.000Z");
    expect(next.id).toBe("H-001");
    expect(next.initial.hotMetalKg).toBe(230000);
    expect(next.initial.plannedTotalOxygenNm3).toBe(13000);
    expect(next.expectedTapAt).toBe("2026-08-22T01:45:00.000Z");
    expect(next.events.at(-1)).toMatchObject({ type: "initial_updated", stage: "G0", recordedBy: { displayName: "수정 작업자" } });
    expect(canDeleteHeat(next)).toBe(true);
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

  it("blocks a stage time that goes backwards", () => {
    const heat = createHeatFromForm(baseForm, operator);
    expect(() => advanceHeat(heat, { occurredAt: "2026-08-22T00:59:00.000Z" }, operator)).toThrow("time_before_heat_start");
  });

  it("blocks decreasing cumulative oxygen at a checkpoint", () => {
    const heat = { ...createHeatFromForm({ ...baseForm, cumulativeOxygenNm3: "5000" }, operator), stage: "G3" };
    expect(() => applyHeatEvent(heat, "checkpoint", { occurredAt: "2026-08-22T01:10:00.000Z", cumulativeOxygenNm3: "4900" }, operator)).toThrow("cumulative_oxygen_decrease");
  });

  it("blocks analysis time before sampling time", () => {
    let heat = { ...createHeatFromForm(baseForm, operator), stage: "G3" };
    heat = applyHeatEvent(heat, "sample", { sampleId: "S-1", occurredAt: "2026-08-22T01:10:00.000Z" }, operator);
    expect(() => applyHeatEvent(heat, "analysis", { sampleId: "S-1", occurredAt: "2026-08-22T01:09:00.000Z", cumulativeOxygenNm3: "1000", values: { C: "0.1" } }, operator)).toThrow("analysis_before_sample");
  });

  it("blocks backdating an event into a stage where that action was unavailable", () => {
    const draft = createHeatFromForm(baseForm, operator);
    const heat = {
      ...draft,
      stage: "G3",
      stageHistory: [
        ...draft.stageHistory,
        { id: "STAGE-G1", from: "G0", to: "G1", occurredAt: "2026-08-22T01:02:00.000Z" },
        { id: "STAGE-G2", from: "G1", to: "G2", occurredAt: "2026-08-22T01:04:00.000Z" },
        { id: "STAGE-G3", from: "G2", to: "G3", occurredAt: "2026-08-22T01:06:00.000Z" },
      ],
    };
    expect(() => applyHeatEvent(heat, "sample", { sampleId: "S-EARLY", occurredAt: "2026-08-22T01:01:00.000Z" }, operator)).toThrow("action_not_available_at_time");
  });

  it("keeps post-tap flux out of the pre-tap heat balance", () => {
    const draft = createHeatFromForm({ ...baseForm, fluxKg: "1000" }, operator);
    const heat = {
      ...draft,
      stage: "G7",
      status: "tapped",
      stageHistory: [...draft.stageHistory, { id: "STAGE-G7", from: "G6", to: "G7", occurredAt: "2026-08-22T01:10:00.000Z" }],
    };
    const next = applyHeatEvent(heat, "material", { occurredAt: "2026-08-22T01:11:00.000Z", amountKg: 500, materialCategory: "flux", materialCode: "LIME" }, operator);
    expect(next.initial.fluxKg).toBe(1000);
    expect(next.events.at(-1).stage).toBe("G7");
  });
});
