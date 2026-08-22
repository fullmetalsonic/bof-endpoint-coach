function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function latestAdoptedSample(heat) {
  return [...(heat.samples ?? [])]
    .filter((sample) => sample.adopted && sample.values)
    .sort((a, b) => new Date(b.sampledAt) - new Date(a.sampledAt))[0] ?? null;
}

function unavailable(reason, mode = "unavailable") {
  return { available: false, mode, reason };
}

function result(value, uncertainty, mode, inputs) {
  return {
    available: true,
    value,
    low: value - uncertainty,
    high: value + uncertainty,
    uncertainty,
    mode,
    inputs,
  };
}

export function calculateEndpoint(heat, settings, calculatedAt = new Date().toISOString()) {
  const coefficient = settings.coefficientProfiles.find((item) => item.id === heat.coefficientProfileId);
  const equipment = settings.equipmentProfiles.find((item) => item.id === heat.equipmentProfileId);
  const sample = latestAdoptedSample(heat);
  const initial = heat.initial ?? {};
  const process = heat.process ?? {};

  if (!coefficient) {
    return { calculatedAt, formulaVersion: null, coefficient: null, equipment, carbon: unavailable("coefficient_profile_missing"), temperature: unavailable("coefficient_profile_missing") };
  }

  const estimatedSteelMass = finite(initial.hotMetalKg) && finite(initial.scrapKg)
    ? (Number(initial.hotMetalKg) + Number(initial.scrapKg)) * Number(coefficient.liquidSteelYield)
    : NaN;
  const oxygenRemaining = finite(initial.plannedTotalOxygenNm3) && finite(process.cumulativeOxygenNm3)
    ? Math.max(0, Number(initial.plannedTotalOxygenNm3) - Number(process.cumulativeOxygenNm3))
    : NaN;
  const projectedRemainingMinutes = finite(oxygenRemaining) && finite(process.oxygenFlowNm3PerMinute) && Number(process.oxygenFlowNm3PerMinute) > 0
    ? oxygenRemaining / Number(process.oxygenFlowNm3PerMinute)
    : Number(process.remainingMinutes);

  let carbon;
  if (sample && finite(sample.values.C) && finite(oxygenRemaining) && finite(estimatedSteelMass) && finite(coefficient.carbonAfterSampleKgPerNm3)) {
    const removedFraction = Number(coefficient.carbonAfterSampleKgPerNm3) * oxygenRemaining / estimatedSteelMass;
    const estimate = Math.max(0, Number(sample.values.C) - 100 * removedFraction);
    carbon = result(estimate, Number(coefficient.carbonUncertainty), "sample_correction", { sampleId: sample.id, oxygenRemaining, estimatedSteelMass });
  } else if ([initial.hotMetalKg, initial.hotMetalC, initial.scrapKg, initial.scrapC, initial.plannedTotalOxygenNm3].every(finite)) {
    const initialCarbonKg = Number(initial.hotMetalKg) * Number(initial.hotMetalC) / 100 + Number(initial.scrapKg) * Number(initial.scrapC) / 100;
    const oxygenKg = Number(initial.plannedTotalOxygenNm3) * Number(coefficient.oxygenKgPerNm3);
    const effectiveOxygenKg = oxygenKg * Number(coefficient.oxygenEfficiency) - Number(coefficient.otherOxygenKg);
    const remainingCarbonKg = Math.max(0, initialCarbonKg - Math.max(0, effectiveOxygenKg) * Number(coefficient.carbonRemovalKgPerKgO));
    const estimate = 100 * remainingCarbonKg / estimatedSteelMass;
    carbon = result(estimate, Number(coefficient.carbonUncertainty), "static_balance", { initialCarbonKg, oxygenKg, effectiveOxygenKg, estimatedSteelMass });
  } else {
    carbon = unavailable("carbon_required_inputs_missing");
  }

  let temperature;
  if (sample && finite(sample.values.temperature) && finite(oxygenRemaining) && finite(projectedRemainingMinutes)) {
    const estimate = Number(sample.values.temperature)
      + Number(coefficient.tempAfterSampleCPerNm3) * oxygenRemaining
      - Number(coefficient.tempLossCPerMinute) * projectedRemainingMinutes;
    temperature = result(estimate, Number(coefficient.temperatureUncertainty), "sample_correction", { sampleId: sample.id, oxygenRemaining, remainingMinutes: projectedRemainingMinutes });
  } else if ([initial.hotMetalTemperatureC, initial.plannedTotalOxygenNm3, initial.scrapKg, initial.fluxKg].every(finite)) {
    const reactionHeat = Number(initial.plannedTotalOxygenNm3) * Number(coefficient.heatPerNm3OxygenKj);
    const scrapHeat = Number(initial.scrapKg) * Number(coefficient.scrapHeatKjPerKg);
    const fluxHeat = Number(initial.fluxKg) * Number(coefficient.fluxHeatKjPerKg);
    const netHeat = reactionHeat - scrapHeat - fluxHeat - Number(coefficient.fixedHeatLossKj);
    const estimate = Number(initial.hotMetalTemperatureC) + netHeat / (estimatedSteelMass * Number(coefficient.equivalentHeatCapacityKjPerKgC));
    temperature = result(estimate, Number(coefficient.temperatureUncertainty), "static_balance", { reactionHeat, scrapHeat, fluxHeat, netHeat, estimatedSteelMass });
  } else {
    temperature = unavailable("temperature_required_inputs_missing");
  }

  return {
    calculatedAt,
    formulaVersion: coefficient.formulaVersion,
    coefficient,
    equipment,
    estimatedSteelMass,
    oxygenRemaining,
    projectedRemainingMinutes,
    sample,
    carbon,
    temperature,
    usesPlannedValues: Boolean(process.plannedValuesIncluded || carbon.mode === "static_balance" || temperature.mode === "static_balance"),
    demo: Boolean(coefficient.demo),
  };
}

export function targetState(value, target) {
  if (!finite(value) || !target) return "unknown";
  if (finite(target.min) && Number(value) < Number(target.min)) return "low";
  if (finite(target.max) && Number(value) > Number(target.max)) return "high";
  return "within";
}

export function qualityRows(heat, settings, calculation) {
  const grade = settings.gradeProfiles.find((item) => item.code === heat.gradeCode);
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
