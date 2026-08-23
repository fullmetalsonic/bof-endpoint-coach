import { createLiteratureCoefficientProfile } from "../calculation/coefficientProfile.js";

export function createReferenceSettings() {
  return {
    status: "literature_reference",
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
    revisionHistory: [],
    lastRevision: null,
  };
}
