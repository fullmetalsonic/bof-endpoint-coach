import { createReferenceSettings } from "./referenceSettings.js";
import { normalizeSampleAnalyses } from "../domain/analysisRecords.js";
import { captureHeatReferenceSnapshot } from "../domain/referenceSnapshot.js";

export const APP_VERSION = "0.6.1";
export const BACKUP_SCHEMA_VERSION = "0.6.0";
export const SUPPORTED_BACKUP_SCHEMA_VERSIONS = ["0.1.0", "0.2.0", "0.2.1", "0.3.0", "0.4.0", BACKUP_SCHEMA_VERSION];

export function createEmptyState({ locale = "ko", operatorProfile = { displayName: "" }, onboardingCompleted = false } = {}) {
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    locale,
    operatorProfile: { displayName: operatorProfile?.displayName?.trim() ?? "" },
    onboardingCompleted,
    currentHeatId: null,
    settings: createReferenceSettings(),
    heats: [],
    operationLog: [],
    modelRegistry: [{ id: "BOF-REF-CALC 0.3.0", type: "literature_hybrid", status: "reference", source: "public_literature", createdAt: "2026-08-23T00:00:00.000Z" }],
    trainingRuns: [],
    restoreMetadata: null,
    lastSavedAt: null,
  };
}

export function createDemoState(operatorProfile = { displayName: "" }) {
  const now = new Date();
  const atMinutes = (offset) => new Date(now.getTime() + offset * 60000).toISOString();
  const state = createEmptyState({ operatorProfile, onboardingCompleted: true });
  const stageHistory = (entries) => entries.map(([from, to, offset]) => ({ id: `STAGE-DEMO-${to}-${Math.abs(offset)}`, from, to, occurredAt: atMinutes(offset), recordedAt: atMinutes(offset), recordedBy: { displayName: "DEMO" }, note: "" }));
  const demo = {
    ...state,
    currentHeatId: "DEMO-260822-01",
    heats: [
      {
        id: "DEMO-260822-01",
        gradeCode: "DEMO-LC",
        equipmentProfileId: "BOF-DEMO-A",
        coefficientProfileId: "COEF-LIT-001",
        demo: true,
        status: "in_progress",
        stage: "G6",
        stageLabelKo: "출강 검토",
        stageLabelEn: "Tap review",
        startedAt: atMinutes(-42),
        expectedTapAt: atMinutes(18),
        initial: {
          hotMetalKg: 230000,
          hotMetalC: 4.5,
          hotMetalSi: 0.641,
          hotMetalMn: 0.043,
          hotMetalP: 0.176,
          hotMetalS: 0.023,
          hotMetalTemperatureC: 1350,
          scrapKg: 30000,
          scrapC: 0.2,
          scrapSi: 0.03,
          scrapMn: 0.35,
          scrapP: 0.02,
          scrapS: 0.02,
          fluxKg: 12000,
          plannedTotalOxygenNm3: 13000,
        },
        process: {
          cumulativeOxygenNm3: 12990,
          lanceHeightM: 1.8,
          oxygenFlowNm3PerMinute: 300,
          remainingMinutes: 1,
          plannedValuesIncluded: false,
        },
        samples: [
          { id: "S-DEMO-01", sampledAt: atMinutes(-24), stage: "G3", method: "OES", adopted: false, processSnapshot: { cumulativeOxygenNm3: 4000 }, values: { C: 2.9, Si: 0.2, Mn: 0.036, P: 0.1, S: 0.017, temperature: 1465 } },
          { id: "S-DEMO-02", sampledAt: atMinutes(-17), stage: "G4", method: "OES", adopted: false, processSnapshot: { cumulativeOxygenNm3: 9000 }, values: { C: 1.4, Si: 0.07, Mn: 0.034, P: 0.045, S: 0.009, temperature: 1605 } },
          { id: "S-DEMO-03", sampledAt: atMinutes(-6), stage: "G5", method: "OES", adopted: true, processSnapshot: { cumulativeOxygenNm3: 12970 }, values: { C: 0.074, Si: 0.01, Mn: 0.032, P: 0.017, S: 0.005, temperature: 1654 } },
        ],
        events: [
          { id: "EV-DEMO-01", type: "charge", occurredAt: atMinutes(-42), summaryKo: "가상 장입 완료", summaryEn: "Synthetic charge complete" },
          { id: "EV-DEMO-02", type: "blow_start", occurredAt: atMinutes(-34), summaryKo: "취련 시작", summaryEn: "Blow started" },
          { id: "EV-DEMO-03", type: "checkpoint", stage: "G6", occurredAt: atMinutes(-0.15), summaryKo: "누적 산소 12,990 Nm³", summaryEn: "Cumulative oxygen 12,990 Nm³", payload: { occurredAt: atMinutes(-0.15), cumulativeOxygenNm3: 12990, lanceHeightM: 1.8, oxygenFlowNm3PerMinute: 300, remainingMinutes: 1 } },
        ],
        stageHistory: stageHistory([[null, "G0", -42], ["G0", "G1", -34], ["G1", "G2", -29], ["G2", "G3", -25], ["G3", "G4", -18], ["G4", "G5", -10], ["G5", "G6", -2]]),
      },
      {
        id: "DEMO-260822-02",
        gradeCode: "DEMO-LC",
        equipmentProfileId: "BOF-DEMO-A",
        coefficientProfileId: "COEF-LIT-001",
        demo: true,
        status: "in_progress",
        stage: "G3",
        stageLabelKo: "용해 중기",
        stageLabelEn: "Mid blow",
        startedAt: atMinutes(-17),
        expectedTapAt: atMinutes(34),
        initial: { hotMetalKg: 228000, hotMetalC: 4.45, hotMetalSi: 0.641, hotMetalMn: 0.043, hotMetalP: 0.176, hotMetalS: 0.023, hotMetalTemperatureC: 1348, scrapKg: 32000, scrapC: 0.18, scrapSi: 0.03, scrapMn: 0.35, scrapP: 0.02, scrapS: 0.02, fluxKg: 11800, plannedTotalOxygenNm3: 13200 },
        process: { cumulativeOxygenNm3: 9000, lanceHeightM: 2.1, oxygenFlowNm3PerMinute: 323.076923, remainingMinutes: 13, plannedValuesIncluded: true },
        samples: [
          { id: "S-DEMO-11", sampledAt: atMinutes(-4), stage: "G3", method: "OES", adopted: true, processSnapshot: { cumulativeOxygenNm3: 8800 }, values: { C: 1.65, Si: 0.08, Mn: 0.035, P: 0.031, S: 0.01, temperature: 1540 } },
        ],
        events: [{ id: "EV-DEMO-11", type: "blow_start", occurredAt: atMinutes(-13), summaryKo: "취련 시작", summaryEn: "Blow started" }],
        stageHistory: stageHistory([[null, "G0", -17], ["G0", "G1", -13], ["G1", "G2", -8], ["G2", "G3", -5]]),
      },
    ],
    operationLog: [{ id: "LOG-DEMO-001", type: "demo_initialized", at: now.toISOString() }],
  };
  return {
    ...demo,
    heats: demo.heats.map((heat) => {
      const selection = { gradeCode: heat.gradeCode, equipmentProfileId: heat.equipmentProfileId, coefficientProfileId: heat.coefficientProfileId };
      return {
        ...heat,
        events: heat.events.map((event) => ({ ...event, status: "active", recordedAt: event.recordedAt ?? event.occurredAt, recordedBy: event.recordedBy ?? { displayName: "DEMO" } })),
        stageHistory: heat.stageHistory.map((entry) => ({ ...entry, status: "active", process: structuredClone(heat.process) })),
        samples: heat.samples.map((sample) => normalizeSampleAnalyses({ ...sample, status: "active", recordedAt: sample.recordedAt ?? sample.sampledAt })),
        correctionBase: { ...selection, initial: structuredClone(heat.initial), process: { ...structuredClone(heat.process), cumulativeOxygenNm3: 0 }, expectedTapAt: heat.expectedTapAt, replayInitial: true, replayProcess: true, legacy: false },
        referenceSnapshot: captureHeatReferenceSnapshot(demo.settings, selection, heat.startedAt),
        predictionSnapshots: [],
        correctionLog: [],
        actualEndpointAnalysisId: null,
      };
    }),
  };
}
