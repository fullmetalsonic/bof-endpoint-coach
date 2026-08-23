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
          Mn: { min: 0.02, max: 0.08, unit: "%", decimals: 3 },
          Si: { max: 0.02, unit: "%", decimals: 3 },
          S: { max: 0.01, unit: "%", decimals: 3 },
        },
      },
    ],
    materials: [
      { code: "LIME-DEMO", nameKo: "가상 석회", nameEn: "Synthetic lime", category: "flux", unit: "kg", composition: { CaO: 90, MgO: 5, SiO2: 2, Al2O3: 1 } },
      { code: "COOL-DEMO", nameKo: "가상 산화철 냉각재", nameEn: "Synthetic iron-oxide coolant", category: "coolant", unit: "kg", composition: { Fe2O3: 95 } },
      { code: "FEMN-DEMO", nameKo: "가상 FeMn", nameEn: "Synthetic FeMn", category: "alloy", unit: "kg", composition: { Mn: 75, C: 6, Si: 2, P: 0.3, S: 0.05 } },
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
