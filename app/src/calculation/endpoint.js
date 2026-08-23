import { coefficientBasisLabel, resolveCoefficientProfile } from "./coefficientProfile.js";
import { calculateHeatBalance } from "./heatBalance.js";
import { calculateMassBalance, scenarioParameters } from "./massBalance.js";
import { latestAdoptedSample } from "../domain/analysisRecords.js";
import { heatReferenceMode, resolveHeatSettings } from "../domain/referenceSnapshot.js";

function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function unavailable(reason, mode = "unavailable") {
  return { available: false, mode, reason };
}

function endpointResult(scenarioResults, item, sample) {
  const available = scenarioResults.filter((entry) => entry[item]?.available && finite(entry[item].value));
  const base = available.find((entry) => entry.name === "base") ?? available[0];
  if (!base) return unavailable(item === "carbon" ? "carbon_balance_unavailable" : "heat_balance_unavailable");
  const values = available.map((entry) => Number(entry[item].value));
  return {
    available: true,
    value: Number(base[item].value),
    low: Math.min(...values),
    high: Math.max(...values),
    rangeType: "literature_scenario",
    mode: sample && base[item].anchored ? "sample_anchored_literature" : "literature_static_balance",
    inputs: {
      sampleId: sample && base[item].anchored ? sample.id : null,
      sampleOxygenNm3: sample?.processSnapshot?.cumulativeOxygenNm3 ?? null,
      scenarios: Object.fromEntries(available.map((entry) => [entry.name, entry[item].value])),
    },
  };
}

function runScenario(initial, grade, values, name, oxygenNm3) {
  const parameters = scenarioParameters(values, name);
  const mass = calculateMassBalance(initial, grade, values, parameters, oxygenNm3);
  const heat = calculateHeatBalance(initial, mass, values, parameters);
  return { name, parameters, mass, heat };
}

function applySampleAnchor(endpointRun, sampleRun, sample) {
  const carbon = endpointRun.mass.available
    ? { available: true, value: endpointRun.mass.carbonPercent, anchored: false }
    : unavailable(endpointRun.mass.reason);
  const temperature = endpointRun.heat.available
    ? { available: true, value: endpointRun.heat.temperatureC, anchored: false }
    : unavailable(endpointRun.heat.reason);
  if (sampleRun?.mass.available && finite(sample?.values?.C)) {
    carbon.value = Math.max(0, Number(sample.values.C) + endpointRun.mass.carbonPercent - sampleRun.mass.carbonPercent);
    carbon.anchored = true;
  }
  if (sampleRun?.heat.available && finite(sample?.values?.temperature)) {
    temperature.value = Number(sample.values.temperature) + endpointRun.heat.temperatureC - sampleRun.heat.temperatureC;
    temperature.anchored = true;
  }
  return { ...endpointRun, carbon, temperature };
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
    return { calculatedAt, formulaVersion: null, coefficient: null, equipment, basis: { status: "invalid", labelKo: "계수 프로필 없음", labelEn: "Coefficient profile missing", sourceIds: [] }, carbon: unavailable("coefficient_profile_missing"), temperature: unavailable("coefficient_profile_missing"), assumedInputs: [], usesPlannedValues: false, inputMode: "incomplete", referenceMode, demo: referenceMode !== "manual_reference" };
  }

  const resolved = resolveCoefficientProfile(rawCoefficient);
  const coefficient = resolved.profile;
  const values = resolved.effectiveValues;
  if (resolved.validationErrors.length) {
    return {
      calculatedAt,
      formulaVersion: coefficient.formulaVersion,
      coefficient,
      equipment,
      basis: {
        status: "invalid",
        labelKo: coefficientBasisLabel("invalid", "ko"),
        labelEn: coefficientBasisLabel("invalid", "en"),
        approved: false,
        overrideFields: resolved.overrideFields,
        sourceIds: resolved.sourceIds,
      },
      carbon: unavailable("coefficient_profile_invalid"),
      temperature: unavailable("coefficient_profile_invalid"),
      assumedInputs: [],
      usesPlannedValues: false,
      inputMode: "invalid_coefficients",
      referenceMode,
      demo: referenceMode !== "manual_reference",
    };
  }
  if (!finite(initial.plannedTotalOxygenNm3)) {
    return {
      calculatedAt,
      formulaVersion: coefficient.formulaVersion,
      coefficient,
      equipment,
      basis: {
        status: resolved.status,
        labelKo: coefficientBasisLabel(resolved.status, "ko"),
        labelEn: coefficientBasisLabel(resolved.status, "en"),
        approved: resolved.approved,
        overrideFields: resolved.overrideFields,
        sourceIds: resolved.sourceIds,
      },
      carbon: unavailable("planned_oxygen_missing"),
      temperature: unavailable("planned_oxygen_missing"),
      assumedInputs: [],
      usesPlannedValues: false,
      inputMode: "incomplete",
      referenceMode,
      demo: referenceMode !== "manual_reference",
    };
  }

  const plannedOxygenNm3 = Number(initial.plannedTotalOxygenNm3);
  const sampleOxygenNm3 = sample?.processSnapshot?.cumulativeOxygenNm3;
  const canAnchor = finite(sampleOxygenNm3) && Number(sampleOxygenNm3) <= plannedOxygenNm3;
  const runs = ["low", "base", "high"].map((name) => {
    const endpointRun = runScenario(initial, grade, values, name, plannedOxygenNm3);
    const sampleRun = canAnchor ? runScenario(initial, grade, values, name, Number(sampleOxygenNm3)) : null;
    return applySampleAnchor(endpointRun, sampleRun, sample);
  });
  const carbon = endpointResult(runs, "carbon", sample);
  const temperature = endpointResult(runs, "temperature", sample);
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
    scenarioResults: runs.map((entry) => ({
      name: entry.name,
      parameters: entry.parameters,
      carbon: entry.carbon,
      temperature: entry.temperature,
      massBalance: entry.mass,
      heatBalance: entry.heat,
    })),
    assumedInputs: baseRun?.mass?.assumedInputs ?? [],
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
  return keys.map((key) => {
    const target = grade?.targets?.[key];
    const prediction = key === "C" ? calculation.carbon : key === "temperature" ? calculation.temperature : unavailable("formula_not_configured");
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
