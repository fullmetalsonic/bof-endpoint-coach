import { clampRange, confidenceStatus, finite, sortedRange, unavailable } from "./common.js";
import { materialModelParameters } from "./additionProfile.js";
import { buildTimingWindow } from "./timingModel.js";

const O_IN_FEO = 15.9994 / 71.8444;
const O_IN_FE2O3 = 47.9982 / 159.688;

function theoreticalOxideOxygenKgPerKg(material) {
  return Number(material.composition?.FeO ?? 0) / 100 * O_IN_FEO + Number(material.composition?.Fe2O3 ?? 0) / 100 * O_IN_FE2O3;
}

export function calculateCoolantRecommendation({ heat, settings, endpoint, resolvedProfile, calculatedAt }) {
  const model = "coolant";
  const limit = resolvedProfile.profile.limits.coolant;
  if (!limit?.enabled) return unavailable(model, "model_disabled");
  if (!limit.allowedStages.includes(heat.stage)) return unavailable(model, "stage_not_allowed", { allowedStages: limit.allowedStages });
  const target = endpoint?.grade?.targets?.temperature;
  if (!endpoint?.temperature?.available || !finite(target?.max) || Number(endpoint.temperature.value) <= Number(target.max)) return unavailable(model, "temperature_not_high", { predictedTemperature: endpoint?.temperature?.value ?? null, targetMax: target?.max ?? null });
  if (!finite(endpoint.estimatedSteelMass)) return unavailable(model, "estimated_steel_mass_missing");
  const materials = (settings.materials ?? []).filter((material) => material.category === "coolant");
  if (!materials.length) return unavailable(model, "coolant_material_missing");
  const excessC = Number(endpoint.temperature.value) - Number(target.max);
  const heatToRemoveKj = Number(endpoint.estimatedSteelMass) * Number(resolvedProfile.values.steelHeatCapacityKjPerKgC) * excessC;
  const candidates = materials.map((material) => {
    const params = materialModelParameters(material, resolvedProfile);
    const coolingValues = Object.values(params.coolingKjPerKg ?? {}).filter(finite).map(Number);
    if (!coolingValues.length || coolingValues.some((value) => value <= 0)) return null;
    const multiplier = Number(resolvedProfile.corrections.coolantAmountMultiplier ?? 1) / Number(resolvedProfile.corrections.effectMultiplier ?? 1);
    const rawRange = sortedRange(coolingValues.map((cooling) => heatToRemoveKj / cooling * multiplier));
    const limited = clampRange(rawRange, params.minKg ?? limit.minKg, params.maxKg ?? limit.maxKg);
    if (limited.conflict) return { material, conflict: limited };
    const oxygenUpperKgPerKg = theoreticalOxideOxygenKgPerKg(material);
    const baseCoolingKjPerKg = Number(params.coolingKjPerKg?.base ?? coolingValues[Math.floor(coolingValues.length / 2)]);
    const estimatedDeltaC = -limited.range.midpoint * baseCoolingKjPerKg / (Number(endpoint.estimatedSteelMass) * Number(resolvedProfile.values.steelHeatCapacityKjPerKgC));
    return {
      model,
      available: true,
      operationType: "material",
      materialCode: material.code,
      materialNameKo: material.nameKo,
      materialNameEn: material.nameEn,
      amount: { ...limited.range, unit: "kg" },
      timing: buildTimingWindow(heat, "coolant", resolvedProfile.profile, calculatedAt, limited.range.midpoint, params),
      objective: "temperature_upper_limit",
      target: { max: Number(target.max), unit: "°C" },
      effects: {
        temperature: { direction: "decrease", estimatedDeltaC },
        oxideOxygenUpperBoundKg: oxygenUpperKgPerKg * limited.range.midpoint,
      },
      confidence: confidenceStatus(resolvedProfile, finite(params.minKg ?? limit.minKg) && finite(params.maxKg ?? limit.maxKg)),
      assumptions: ["effective_cooling_literature_range", "steel_heat_capacity_linearized", "oxide_oxygen_is_theoretical_upper_bound"],
      sourceIds: ["S44", "S48", "S49", "S52", "S55", "S56"],
    };
  }).filter(Boolean);
  const usable = candidates.filter((candidate) => !candidate.conflict).sort((a, b) => a.amount.midpoint - b.amount.midpoint);
  if (usable.length) return usable[0];
  if (candidates.some((candidate) => candidate.conflict)) return unavailable(model, "site_limit_conflict", { conflicts: candidates.filter((candidate) => candidate.conflict).map((candidate) => ({ materialCode: candidate.material.code, ...candidate.conflict })) });
  return unavailable(model, "cooling_coefficient_missing");
}
