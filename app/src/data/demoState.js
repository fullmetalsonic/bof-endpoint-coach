import { createLiteratureCoefficientProfile } from "../calculation/coefficientProfile.js";

export const APP_VERSION = "0.2.0";
export const BACKUP_SCHEMA_VERSION = "0.1.0";

export function createDemoState() {
  const now = new Date();
  const atMinutes = (offset) => new Date(now.getTime() + offset * 60000).toISOString();
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    locale: "ko",
    currentHeatId: "DEMO-260822-01",
    settings: {
      status: "demo",
      gradeProfiles: [
        {
          code: "DEMO-LC",
          nameKo: "가상 저탄소강",
          nameEn: "Synthetic low-carbon steel",
          targets: {
            C: { min: 0.04, max: 0.08, unit: "%", decimals: 3 },
            temperature: { min: 1650, max: 1700, unit: "°C", decimals: 0 },
            P: { min: 0.01, max: 0.02, unit: "%", decimals: 3 },
            Mn: { min: 1.2, max: 1.6, unit: "%", decimals: 2 },
            Si: { max: 0.25, unit: "%", decimals: 2 },
            S: { max: 0.01, unit: "%", decimals: 3 },
          },
        },
      ],
      materials: [
        { code: "LIME-DEMO", nameKo: "가상 석회", nameEn: "Synthetic lime", category: "flux", unit: "kg", composition: { CaO: 90 } },
        { code: "COOL-DEMO", nameKo: "가상 냉각재", nameEn: "Synthetic coolant", category: "coolant", unit: "kg", composition: {} },
        { code: "FEMN-DEMO", nameKo: "가상 FeMn", nameEn: "Synthetic FeMn", category: "alloy", unit: "kg", composition: { Mn: 75 } },
      ],
      equipmentProfiles: [
        {
          id: "BOF-DEMO-A",
          nameKo: "가상 전로 A",
          nameEn: "Synthetic BOF A",
          blowingType: "combined",
          nominalCapacityT: 260,
          lanceProfile: "LANCE-DEMO-06",
          bottomGas: "N2/Ar",
          status: "demo",
        },
      ],
      coefficientProfiles: [createLiteratureCoefficientProfile()],
      gates: ["G0", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"],
      unitPolicy: { mass: "kg", oxygen: "Nm³", temperature: "°C", chemistry: "%" },
      version: "DEMO-REF-001",
    },
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
        startedAt: atMinutes(-34),
        expectedTapAt: atMinutes(18),
        initial: {
          hotMetalKg: 230000,
          hotMetalC: 4.5,
          hotMetalSi: 0.641,
          hotMetalMn: 0.043,
          hotMetalP: 0.176,
          hotMetalTemperatureC: 1350,
          scrapKg: 30000,
          scrapC: 0.2,
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
          { id: "S-DEMO-01", sampledAt: atMinutes(-32), stage: "G3", method: "OES", adopted: true, processSnapshot: { cumulativeOxygenNm3: 4000 }, values: { C: 0.128, Si: 0.24, Mn: 1.52, P: 0.026, S: 0.006, temperature: 1768 } },
          { id: "S-DEMO-02", sampledAt: atMinutes(-19), stage: "G4", method: "OES", adopted: true, processSnapshot: { cumulativeOxygenNm3: 9000 }, values: { C: 0.096, Si: 0.22, Mn: 1.48, P: 0.021, S: 0.005, temperature: 1712 } },
          { id: "S-DEMO-03", sampledAt: atMinutes(-6), stage: "G5", method: "OES", adopted: true, processSnapshot: { cumulativeOxygenNm3: 12970 }, values: { C: 0.074, Si: 0.21, Mn: 1.38, P: 0.017, S: 0.005, temperature: 1654 } },
        ],
        events: [
          { id: "EV-DEMO-01", type: "charge", occurredAt: atMinutes(-42), summaryKo: "가상 장입 완료", summaryEn: "Synthetic charge complete" },
          { id: "EV-DEMO-02", type: "blow_start", occurredAt: atMinutes(-34), summaryKo: "취련 시작", summaryEn: "Blow started" },
          { id: "EV-DEMO-03", type: "checkpoint", occurredAt: atMinutes(-0.15), summaryKo: "누적 산소 12,990 Nm³", summaryEn: "Cumulative oxygen 12,990 Nm³" },
        ],
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
        startedAt: atMinutes(-13),
        expectedTapAt: atMinutes(34),
        initial: { hotMetalKg: 228000, hotMetalC: 4.45, hotMetalSi: 0.641, hotMetalMn: 0.043, hotMetalP: 0.176, hotMetalTemperatureC: 1348, scrapKg: 32000, scrapC: 0.18, fluxKg: 11800, plannedTotalOxygenNm3: 13200 },
        process: { cumulativeOxygenNm3: 9000, lanceHeightM: 2.1, oxygenFlowNm3PerMinute: 323.076923, remainingMinutes: 13, plannedValuesIncluded: true },
        samples: [
          { id: "S-DEMO-11", sampledAt: atMinutes(-4), stage: "G3", method: "OES", adopted: true, processSnapshot: { cumulativeOxygenNm3: 8800 }, values: { C: 1.65, Si: 0.3, Mn: 1.62, P: 0.031, S: 0.006, temperature: 1540 } },
        ],
        events: [{ id: "EV-DEMO-11", type: "blow_start", occurredAt: atMinutes(-13), summaryKo: "취련 시작", summaryEn: "Blow started" }],
      },
    ],
    operationLog: [{ id: "LOG-DEMO-001", type: "demo_initialized", at: now.toISOString() }],
    lastSavedAt: null,
  };
}
