import { describe, expect, it } from "vitest";
import { advanceHeat, applyHeatEvent, createHeatFromForm } from "../src/domain/heatOperations.js";
import { adoptAnalysisRecord, correctAnalysisRecord, correctEventRecord, correctTapRecord, invalidateAnalysisRecord, invalidateEventRecord, rollbackLastStage, setActualEndpointAnalysis } from "../src/domain/correctionOperations.js";
import { getActiveAnalysisResults } from "../src/domain/analysisRecords.js";
import { capturePredictionSnapshot, endpointValidationComparison } from "../src/domain/predictionHistory.js";
import { createDemoState } from "../src/data/demoState.js";
import { validateOperationalState } from "../src/domain/stateIntegrity.js";

const operator = { displayName: "TEST" };

function newHeat(state, id = "CORR-001") {
  const startedAt = new Date(Date.now() - 60_000).toISOString();
  return createHeatFromForm({
    id,
    gradeCode: "DEMO-LC",
    equipmentProfileId: "BOF-DEMO-A",
    coefficientProfileId: "COEF-LIT-001",
    startedAt,
    expectedDurationMinutes: 40,
    hotMetalKg: 230000,
    hotMetalC: 4.5,
    hotMetalSi: 0.6,
    hotMetalMn: 0.04,
    hotMetalP: 0.17,
    hotMetalTemperatureC: 1350,
    scrapKg: 30000,
    scrapC: 0.2,
    fluxKg: 12000,
    plannedTotalOxygenNm3: 13000,
    cumulativeOxygenNm3: 0,
    lanceHeightM: 2.1,
    oxygenFlowNm3PerMinute: 300,
  }, operator, new Date().toISOString(), state.settings);
}

describe("correction ledger operations", () => {
  it("preserves multiple analysis results and allows explicit adoption", () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[1]);
    const sample = heat.samples[0];
    const reanalysis = applyHeatEvent(heat, "analysis", {
      occurredAt: new Date().toISOString(),
      sampleId: sample.id,
      method: "OES-RERUN",
      cumulativeOxygenNm3: 8800,
      values: { C: 1.6, temperature: 1545 },
    }, operator);
    expect(getActiveAnalysisResults(reanalysis.samples[0])).toHaveLength(2);
    const newest = reanalysis.samples[0].analysisResults.at(-1);
    expect(reanalysis.samples[0].adoptedAnalysisId).toBe(newest.id);
    const original = reanalysis.samples[0].analysisResults[0];
    const adopted = adoptAnalysisRecord(reanalysis, original.id, "재분석 비교 후 원결과 채택", operator);
    expect(adopted.samples[0].adoptedAnalysisId).toBe(original.id);
    expect(adopted.samples[0].values.C).toBe(1.65);
  });

  it("corrects and voids an analysis without deleting its original", () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[0]);
    const original = heat.samples.at(-1).analysisResults[0];
    const corrected = correctAnalysisRecord(heat, original.id, { values: { C: 0.071 } }, "전사 오류", operator);
    const results = corrected.samples.at(-1).analysisResults;
    expect(results.find((item) => item.id === original.id).status).toBe("superseded");
    expect(corrected.samples.at(-1).values.C).toBe(0.071);
    const replacement = results.at(-1);
    const voided = invalidateAnalysisRecord(corrected, replacement.id, "분석실 재통보", operator);
    expect(voided.samples.at(-1).analysisResults.find((item) => item.id === replacement.id).status).toBe("voided");
    expect(voided.correctionLog).toHaveLength(2);
  });

  it("recalculates material projection after correction and invalidation", () => {
    const state = createDemoState();
    const heat = newHeat(state);
    const entered = applyHeatEvent(heat, "material", { occurredAt: new Date().toISOString(), materialCode: "LIME", materialName: "생석회", materialCategory: "flux", amountKg: 1000 }, operator);
    const event = entered.events.at(-1);
    const corrected = correctEventRecord(entered, event.id, { amountKg: 1500 }, "계량값 정정", operator);
    expect(corrected.initial.fluxKg).toBe(13500);
    expect(corrected.events.find((item) => item.id === event.id).status).toBe("superseded");
    const replacement = corrected.events.at(-1);
    const voided = invalidateEventRecord(corrected, replacement.id, "실제 미투입", operator);
    expect(voided.initial.fluxKg).toBe(12000);
  });

  it("rolls back exactly one stage and preserves the voided transition", () => {
    const state = createDemoState();
    const heat = rollbackLastStage(structuredClone(state.heats[0]), "G6 전환 오입력", operator);
    expect(heat.stage).toBe("G5");
    expect(heat.stageHistory.find((item) => item.to === "G6").status).toBe("voided");
    expect(validateOperationalState({ ...state, currentHeatId: heat.id, heats: [heat] })).toBeNull();
  });

  it("corrects tap time while retaining the superseded tap record", () => {
    const state = createDemoState();
    const original = structuredClone(state.heats[0]);
    const tapTime = new Date().toISOString();
    const tapped = applyHeatEvent(original, "tap", { occurredAt: tapTime, note: "" }, operator);
    const correctedTime = new Date(new Date(tapTime).getTime() - 1_000).toISOString();
    const corrected = correctTapRecord(tapped, correctedTime, "출강 시작 시각 정정", operator);
    expect(corrected.tappedAt).toBe(correctedTime);
    expect(corrected.events.filter((event) => event.type === "tap")).toHaveLength(2);
    expect(corrected.events.find((event) => event.type === "tap" && event.status === "superseded")).toBeTruthy();
  });

  it("keeps a prediction snapshot and compares a selected actual result", () => {
    const state = createDemoState();
    let heat = applyHeatEvent(structuredClone(state.heats[0]), "tap", { occurredAt: new Date().toISOString(), note: "" }, operator);
    heat = capturePredictionSnapshot(heat, state.settings, { type: "tap", id: "TAP-1" });
    const analysisId = heat.samples.at(-1).analysisResults[0].id;
    heat = setActualEndpointAnalysis(heat, analysisId, "최종 성분 확정", operator);
    const comparison = endpointValidationComparison(heat);
    expect(comparison.prediction.carbon.available).toBe(true);
    expect(comparison.actual.values.C).toBe(0.074);
    expect(comparison.carbonError).toBeCloseTo(0.074 - comparison.prediction.carbon.value, 8);
  });

  it("rejects invalid corrections before mutating the source heat", () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[0]);
    const analysis = heat.samples.at(-1).analysisResults[0];
    expect(() => correctAnalysisRecord(heat, analysis.id, { values: { C: 101 } }, "범위 검사", operator)).toThrow("chemistry_out_of_range");
    expect(() => correctAnalysisRecord(heat, analysis.id, { values: { C: 0.07 } }, "", operator)).toThrow("correction_reason_required");
    const checkpoint = heat.events.find((event) => event.type === "checkpoint");
    expect(() => correctEventRecord(heat, checkpoint.id, { cumulativeOxygenNm3: 12000 }, "순서 검사", operator)).toThrow("cumulative_oxygen_sequence");
    expect(() => correctEventRecord(heat, checkpoint.id, { occurredAt: heat.startedAt, cumulativeOxygenNm3: 12990 }, "단계 검사", operator)).toThrow("action_not_available_at_time");
    expect(heat.samples.at(-1).analysisResults).toHaveLength(1);
    expect(heat.correctionLog).toHaveLength(0);
  });

  it("blocks a tap correction that would cross existing pre-tap or post-tap records", () => {
    const state = createDemoState();
    const original = structuredClone(state.heats[0]);
    const tapTime = new Date().toISOString();
    let heat = applyHeatEvent(original, "tap", { occurredAt: tapTime, note: "" }, operator);
    const finalCheckpoint = original.events.find((event) => event.type === "checkpoint");
    expect(() => correctTapRecord(heat, new Date(new Date(finalCheckpoint.occurredAt).getTime() - 1_000).toISOString(), "너무 빠른 출강", operator)).toThrow("tap_before_pre_tap_record");
    const postTapTime = new Date(new Date(tapTime).getTime() + 1_000).toISOString();
    heat = applyHeatEvent(heat, "material", { occurredAt: postTapTime, materialCode: "LIME", materialName: "생석회", materialCategory: "flux", amountKg: 10 }, operator, new Date(new Date(postTapTime).getTime() + 1_000).toISOString());
    expect(() => correctTapRecord(heat, new Date(new Date(postTapTime).getTime() + 1_000).toISOString(), "너무 늦은 출강", operator, new Date(new Date(postTapTime).getTime() + 2_000).toISOString())).toThrow("tap_after_post_tap_record");
  });

  it("keeps analysis-event references synchronized through correction and sample invalidation", () => {
    const state = createDemoState();
    let heat = newHeat(state, "CORR-REF-001");
    const started = new Date(heat.startedAt).getTime();
    heat = advanceHeat(heat, { occurredAt: new Date(started + 10_000).toISOString() }, operator);
    heat = advanceHeat(heat, { occurredAt: new Date(started + 20_000).toISOString() }, operator);
    heat = applyHeatEvent(heat, "sample", { sampleId: "S-REF", occurredAt: new Date(started + 30_000).toISOString() }, operator);
    heat = applyHeatEvent(heat, "analysis", { sampleId: "S-REF", occurredAt: new Date(started + 40_000).toISOString(), method: "OES", cumulativeOxygenNm3: 1000, values: { C: 0.2, temperature: 1600 } }, operator);
    const originalAnalysis = heat.samples[0].analysisResults[0];
    heat = correctAnalysisRecord(heat, originalAnalysis.id, { values: { C: 0.19 } }, "재전사", operator);
    const replacement = heat.samples[0].analysisResults.at(-1);
    expect(heat.events.find((event) => event.analysisId === originalAnalysis.id).status).toBe("superseded");
    expect(heat.events.find((event) => event.analysisId === replacement.id).status).toBe("active");
    expect(validateOperationalState({ ...state, currentHeatId: heat.id, heats: [heat] })).toBeNull();
    const sampleEvent = heat.events.find((event) => event.type === "sample" && event.status === "active");
    heat = invalidateEventRecord(heat, sampleEvent.id, "시료 오염", operator);
    expect(heat.events.find((event) => event.analysisId === replacement.id).status).toBe("voided");
    expect(heat.samples[0].status).toBe("voided");
    expect(validateOperationalState({ ...state, currentHeatId: heat.id, heats: [heat] })).toBeNull();
  });
});
