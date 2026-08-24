import { oxygenDensityKgPerNm3, STOICHIOMETRIC_OXYGEN } from "../massBalance.js";
import { clampRange, confidenceStatus, finite, latestActualAnalysis, sortedRange, targetMidpoint, unavailable } from "./common.js";
import { buildTimingWindow } from "./timingModel.js";

export function calculateOxygenRecommendation({ heat, endpoint, resolvedProfile, calculatedAt }) {
  const model = "oxygen";
  const limit = resolvedProfile.profile.limits.oxygen;
  if (!limit?.enabled) return unavailable(model, "model_disabled");
  if (!limit.allowedStages.includes(heat.stage)) return unavailable(model, "stage_not_allowed", { allowedStages: limit.allowedStages });
  const sample = latestActualAnalysis(heat);
  const sampleCarbon = sample?.values?.C;
  const targetCarbon = targetMidpoint(endpoint?.grade?.targets?.C);
  if (!finite(sampleCarbon) || !finite(targetCarbon)) return unavailable(model, "adopted_carbon_sample_required");
  if (Number(sampleCarbon) <= Number(targetCarbon)) return unavailable(model, "carbon_not_above_target", { sampleCarbon: Number(sampleCarbon), targetCarbon });
  if (!finite(endpoint?.estimatedSteelMass) || !finite(heat.process?.oxygenFlowNm3PerMinute) || Number(heat.process.oxygenFlowNm3PerMinute) <= 0) return unavailable(model, "oxygen_context_incomplete");
  const endpointValues = endpoint?.effectiveValues ?? {};
  const density = oxygenDensityKgPerNm3(endpointValues);
  if (!(density > 0)) return unavailable(model, "oxygen_density_invalid");
  const carbonToRemoveKg = Number(endpoint.estimatedSteelMass) * (Number(sampleCarbon) - Number(targetCarbon)) / 100;
  const purity = Number(endpointValues.oxygenPurityFraction ?? 1);
  const pcrs = [endpointValues.postCombustionRatioLow, endpointValues.postCombustionRatioBase, endpointValues.postCombustionRatioHigh].filter(finite).map(Number);
  const raw = pcrs.map((pcr) => {
    const oxygenPerCarbon = (1 - pcr) * STOICHIOMETRIC_OXYGEN.carbonToCO + pcr * STOICHIOMETRIC_OXYGEN.carbonToCO2;
    return carbonToRemoveKg * oxygenPerCarbon / density / purity;
  });
  const multiplier = Number(resolvedProfile.corrections.oxygenAmountMultiplier ?? 1) / Number(resolvedProfile.corrections.effectMultiplier ?? 1);
  let range = sortedRange(raw.map((value) => value * multiplier));
  if (!range) return unavailable(model, "oxygen_calculation_failed");
  if (finite(endpoint.oxygenRemaining)) range = { low: Math.min(range.low, Number(endpoint.oxygenRemaining)), high: Math.min(range.high, Number(endpoint.oxygenRemaining)), midpoint: 0 };
  range.midpoint = (range.low + range.high) / 2;
  if (!(range.high > 0)) return unavailable(model, "planned_oxygen_exhausted");
  const limited = clampRange(range, limit.minNm3, limit.maxNm3);
  if (limited.conflict) return unavailable(model, "site_limit_conflict", limited);
  const timing = buildTimingWindow(heat, "oxygen", resolvedProfile.profile, calculatedAt);
  timing.durationMinutes = limited.range.midpoint / Number(heat.process.oxygenFlowNm3PerMinute);
  timing.endAt = new Date(new Date(calculatedAt).getTime() + timing.durationMinutes * 60000).toISOString();
  return {
    model,
    available: true,
    operationType: "oxygen",
    materialCode: null,
    amount: { ...limited.range, unit: "Nm³" },
    timing,
    objective: "carbon_to_target_midpoint",
    target: { value: targetCarbon, unit: "%" },
    effects: { carbon: { direction: "decrease", from: Number(sampleCarbon), target: targetCarbon, estimatedDelta: targetCarbon - Number(sampleCarbon) }, temperature: { direction: "uncertain" } },
    confidence: confidenceStatus(resolvedProfile, finite(limit.minNm3) && finite(limit.maxNm3)),
    assumptions: ["carbon_only_stoichiometric_lower_bound", "post_combustion_scenarios", "other_oxygen_demand_not_recalculated"],
    sourceIds: ["S12", "S40", "S48", "S49"],
  };
}
