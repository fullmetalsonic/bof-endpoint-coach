import { coefficientBasisLabel, resolveCoefficientProfile } from "./coefficientProfile.js";
import { calculateHeatBalance } from "./heatBalance.js";
import { calculateMassBalance, scenarioParameters } from "./massBalance.js";
import { buildChargeContext } from "./chemistry/materialInputs.js";
import { calculateSlagScenario } from "./chemistry/slagModel.js";
import { predictSilicon } from "./chemistry/silicon.js";
import { predictPhosphorus } from "./chemistry/phosphorus.js";
import { predictManganese } from "./chemistry/manganese.js";
import { predictSulfur } from "./chemistry/sulfur.js";
import { anchorChemistryPrediction, oxygenProgress } from "./chemistry/trajectoryModel.js";
import { latestAdoptedSample } from "../domain/analysisRecords.js";
import { heatReferenceMode, resolveHeatSettings } from "../domain/referenceSnapshot.js";

function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

const RESULT_KEYS = Object.freeze(["carbon", "temperature", "phosphorus", "manganese", "silicon", "sulfur"]);

function unavailable(reason, mode = "unavailable", extra = {}) {
  return { available: false, mode, reason, ...extra };
}

function endpointResult(scenarioResults, item, sample, offset = 0) {
  const available = scenarioResults.filter((entry) => entry[item]?.available && finite(entry[item].value));
  const base = available.find((entry) => entry.name === "base") ?? available[0];
  if (!base) return unavailable(`${item}_prediction_unavailable`);
  const appliedOffset = finite(offset) ? Number(offset) : 0;
  const values = available.map((entry) => Number(entry[item].value) + appliedOffset);
  const rawValue = Number(base[item].rawLiteratureValue ?? base[item].value);
  const adjustedValue = Number(base[item].value);
  const sampleAnchored = Boolean(sample && base[item].anchored);
  return {
    available: true,
    value: item === "temperature" ? adjustedValue + appliedOffset : Math.max(0, adjustedValue + appliedOffset),
    low: Math.min(...values),
    high: Math.max(...values),
    rangeType: "literature_scenario",
    mode: sampleAnchored ? "sample_anchored_literature" : "literature_static_balance",
    confidence: base[item].confidence ?? (item === "carbon" || item === "temperature" ? "medium" : "low"),
    sourceIds: [...new Set(available.flatMap((entry) => entry[item].sourceIds ?? []))],
    assumptions: [...new Set(available.flatMap((entry) => entry[item].assumptions ?? []))],
    calibrationOffset: appliedOffset,
    rawValue,
    inputs: {
      sampleId: sampleAnchored ? sample.id : null,
      sampleOxygenNm3: sample?.processSnapshot?.cumulativeOxygenNm3 ?? null,
      scenarios: Object.fromEntries(available.map((entry) => [entry.name, Number(entry[item].value) + appliedOffset])),
    },
  };
}

function runScenario(heat, charge, values, name, oxygenNm3) {
  const parameters = scenarioParameters(values, name);
  const mass = calculateMassBalance(heat.initial ?? {}, values, parameters, oxygenNm3, charge);
  const heatBalance = calculateHeatBalance(heat.initial ?? {}, mass, values, parameters);
  const temperature = heatBalance.available
    ? { available: true, value: heatBalance.temperatureC, temperatureC: heatBalance.temperatureC, confidence: "medium", sourceIds: ["S12", "S44"], assumptions: ["static_heat_balance"] }
    : unavailable(heatBalance.reason);
  const slag = calculateSlagScenario(mass, charge);
  return {
    name,
    parameters,
    mass,
    heat: heatBalance,
    slag,
    carbon: mass.available
      ? { available: true, value: mass.carbonPercent, confidence: "medium", sourceIds: ["S12"], assumptions: ["static_oxygen_mass_balance"] }
      : unavailable(mass.reason),
    temperature,
    silicon: { ...predictSilicon(charge, mass, values, parameters), element: "Si" },
    phosphorus: { ...predictPhosphorus(charge, mass, slag, temperature), element: "P" },
    manganese: { ...predictManganese(charge, mass, slag, temperature), element: "Mn" },
    sulfur: { ...predictSulfur(charge, mass, slag, temperature), element: "S" },
  };
}

function applySampleAnchor(endpointRun, sampleRun, sample, charge, sampleProgress) {
  const carbon = { ...endpointRun.carbon, anchored: false, rawLiteratureValue: endpointRun.carbon.value };
  const temperature = { ...endpointRun.temperature, anchored: false, rawLiteratureValue: endpointRun.temperature.value };
  if (sampleRun?.mass.available && finite(sample?.values?.C)) {
    carbon.value = Math.max(0, Number(sample.values.C) + endpointRun.mass.carbonPercent - sampleRun.mass.carbonPercent);
    carbon.anchored = true;
  }
  if (sampleRun?.heat.available && finite(sample?.values?.temperature)) {
    temperature.value = Number(sample.values.temperature) + endpointRun.heat.temperatureC - sampleRun.heat.temperatureC;
    temperature.anchored = true;
  }
  const initialValues = Object.fromEntries(["Si", "P", "Mn", "S"].map((key) => [key, charge.elements[key]?.initialPercent]));
  const anchoredChemistry = {};
  for (const [item, sampleKey] of [["silicon", "Si"], ["phosphorus", "P"], ["manganese", "Mn"], ["sulfur", "S"]]) {
    anchoredChemistry[item] = anchorChemistryPrediction(endpointRun[item], sample?.values?.[sampleKey], initialValues[sampleKey], sampleProgress);
  }
  return { ...endpointRun, carbon, temperature, ...anchoredChemistry };
}

function unavailableCalculation(calculatedAt, referenceMode, reason, coefficient = null, equipment = null, basis = null) {
  return {
    calculatedAt,
    formulaVersion: coefficient?.formulaVersion ?? null,
    coefficient,
    equipment,
    basis: basis ?? { status: "invalid", labelKo: "계산 기준 없음", labelEn: "Calculation basis missing", sourceIds: [] },
    ...Object.fromEntries(RESULT_KEYS.map((key) => [key, unavailable(reason)])),
    assumedInputs: [],
    usesPlannedValues: false,
    inputMode: "incomplete",
    referenceMode,
    demo: referenceMode !== "manual_reference",
  };
}

export function calculateEndpoint(heat, settings, calculatedAt = new Date().toISOString()) {
  const effectiveSettings = resolveHeatSettings(heat, settings);
  const referenceMode = heatReferenceMode(heat, settings);
  const rawCoefficient = effectiveSettings.coefficientProfiles.find((item) => item.id === heat.coefficientProfileId);
  const equipment = effectiveSettings.equipmentProfiles.find((item) => item.id === heat.equipmentProfileId);
  const grade = effectiveSettings.gradeProfiles.find((item) => item.code === heat.gradeCode);
  const sample = latestAdoptedSample(heat);
  const initial = heat.initial ?? {};
  const process = heat.process ?? {};

  if (!rawCoefficient) {
    return unavailableCalculation(calculatedAt, referenceMode, "coefficient_profile_missing", null, equipment, { status: "invalid", labelKo: "계수 프로필 없음", labelEn: "Coefficient profile missing", sourceIds: [] });
  }

  const resolved = resolveCoefficientProfile(rawCoefficient);
  const coefficient = resolved.profile;
  const values = resolved.effectiveValues;
  if (resolved.validationErrors.length) {
    return unavailableCalculation(calculatedAt, referenceMode, "coefficient_profile_invalid", coefficient, equipment, {
      status: "invalid",
      labelKo: coefficientBasisLabel("invalid", "ko"),
      labelEn: coefficientBasisLabel("invalid", "en"),
      approved: false,
      overrideFields: resolved.overrideFields,
      sourceIds: resolved.sourceIds,
      validationErrors: resolved.validationErrors,
    });
  }
  if (!finite(initial.plannedTotalOxygenNm3)) {
    return unavailableCalculation(calculatedAt, referenceMode, "planned_oxygen_missing", coefficient, equipment, {
      status: resolved.status,
      labelKo: coefficientBasisLabel(resolved.status, "ko"),
      labelEn: coefficientBasisLabel(resolved.status, "en"),
      approved: resolved.approved,
      overrideFields: resolved.overrideFields,
      sourceIds: resolved.sourceIds,
    });
  }

  const plannedOxygenNm3 = Number(initial.plannedTotalOxygenNm3);
  const sampleOxygenNm3 = sample?.processSnapshot?.cumulativeOxygenNm3;
  const canAnchor = finite(sampleOxygenNm3) && Number(sampleOxygenNm3) <= plannedOxygenNm3;
  const charge = buildChargeContext(heat, effectiveSettings, values);
  const sampleProgress = canAnchor ? oxygenProgress(Number(sampleOxygenNm3), plannedOxygenNm3) : NaN;
  const runs = ["low", "base", "high"].map((name) => {
    const endpointRun = runScenario(heat, charge, values, name, plannedOxygenNm3);
    const sampleRun = canAnchor ? runScenario(heat, charge, values, name, Number(sampleOxygenNm3)) : null;
    return applySampleAnchor(endpointRun, sampleRun, sample, charge, sampleProgress);
  });
  const offsets = coefficient.calibrationOffsets ?? {};
  const carbon = endpointResult(runs, "carbon", sample, offsets.C);
  const temperature = endpointResult(runs, "temperature", sample, offsets.temperature);
  const phosphorus = endpointResult(runs, "phosphorus", sample, offsets.P);
  const manganese = endpointResult(runs, "manganese", sample, offsets.Mn);
  const silicon = endpointResult(runs, "silicon", sample, offsets.Si);
  const sulfur = endpointResult(runs, "sulfur", sample, offsets.S);
  const baseRun = runs.find((entry) => entry.name === "base");
  const oxygenRemaining = finite(process.cumulativeOxygenNm3)
    ? Math.max(0, plannedOxygenNm3 - Number(process.cumulativeOxygenNm3))
    : NaN;
  const projectedRemainingMinutes = finite(oxygenRemaining) && finite(process.oxygenFlowNm3PerMinute) && Number(process.oxygenFlowNm3PerMinute) > 0
    ? oxygenRemaining / Number(process.oxygenFlowNm3PerMinute)
    : Number(process.remainingMinutes);

  return {
    calculatedAt,
    formulaVersion: coefficient.formulaVersion,
    coefficient,
    equipment,
    grade,
    effectiveValues: values,
    basis: {
      status: resolved.status,
      labelKo: coefficientBasisLabel(resolved.status, "ko"),
      labelEn: coefficientBasisLabel(resolved.status, "en"),
      approved: resolved.approved,
      overrideFields: resolved.overrideFields,
      sourceIds: resolved.sourceIds,
    },
    estimatedSteelMass: baseRun?.mass?.estimatedSteelMassKg,
    oxygenRemaining,
    projectedRemainingMinutes,
    sample,
    carbon,
    temperature,
    phosphorus,
    manganese,
    silicon,
    sulfur,
    scenarioResults: runs.map((entry) => ({
      name: entry.name,
      parameters: entry.parameters,
      carbon: entry.carbon,
      temperature: entry.temperature,
      phosphorus: entry.phosphorus,
      manganese: entry.manganese,
      silicon: entry.silicon,
      sulfur: entry.sulfur,
      massBalance: entry.mass,
      heatBalance: entry.heat,
      slag: entry.slag,
    })),
    assumedInputs: [...(baseRun?.mass?.assumedInputs ?? []), ...(charge.assumptions ?? [])],
    usesPlannedValues: true,
    inputMode: sample ? "sample_anchored" : "static_balance",
    referenceMode,
    demo: referenceMode !== "manual_reference",
  };
}

export function targetState(value, target) {
  if (!finite(value) || !target) return "unknown";
  if (finite(target.min) && Number(value) < Number(target.min)) return "low";
  if (finite(target.max) && Number(value) > Number(target.max)) return "high";
  return "within";
}

export function qualityRows(heat, settings, calculation) {
  const effectiveSettings = resolveHeatSettings(heat, settings);
  const grade = effectiveSettings.gradeProfiles.find((item) => item.code === heat.gradeCode);
  const sample = latestAdoptedSample(heat);
  const values = sample?.values ?? {};
  const keys = ["C", "temperature", "P", "Mn", "Si", "S"];
  const resultKeys = { C: "carbon", temperature: "temperature", P: "phosphorus", Mn: "manganese", Si: "silicon", S: "sulfur" };
  return keys.map((key) => {
    const target = grade?.targets?.[key];
    const prediction = calculation[resultKeys[key]] ?? unavailable("formula_not_configured");
    return {
      key,
      target,
      actual: values[key],
      actualState: targetState(values[key], target),
      prediction,
      predictionState: prediction.available ? targetState(prediction.value, target) : "unknown",
    };
  });
}
