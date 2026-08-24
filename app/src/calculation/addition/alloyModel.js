import { clampRange, confidenceStatus, finite, sortedRange, targetMidpoint, unavailable } from "./common.js";
import { materialModelParameters } from "./additionProfile.js";
import { buildTimingWindow } from "./timingModel.js";

const PREDICTION_KEYS = Object.freeze({ C: "carbon", Si: "silicon", Mn: "manganese", P: "phosphorus", S: "sulfur" });

function primaryElement(material, params) {
  if (params.primaryElement && finite(material.composition?.[params.primaryElement])) return params.primaryElement;
  return ["Mn", "Si", "C"].filter((key) => finite(material.composition?.[key])).sort((a, b) => Number(material.composition[b]) - Number(material.composition[a]))[0] ?? null;
}

function collateralEffects(material, amountKg, steelMassKg, recovery) {
  return Object.fromEntries(["C", "Si", "Mn", "P", "S"].filter((key) => finite(material.composition?.[key])).map((key) => [key, amountKg * Number(material.composition[key]) * recovery / steelMassKg]));
}

export function calculateAlloyRecommendation({ heat, settings, endpoint, resolvedProfile, calculatedAt }) {
  const model = "alloy";
  if (!finite(endpoint?.estimatedSteelMass)) return unavailable(model, "estimated_steel_mass_missing");
  const materials = (settings.materials ?? []).filter((material) => ["alloy", "carburizer"].includes(material.category));
  if (!materials.length) return unavailable(model, "alloy_material_missing");
  const candidates = [];
  for (const material of materials) {
    const kind = material.category;
    const limit = resolvedProfile.profile.limits[kind];
    if (!limit?.enabled || !limit.allowedStages.includes(heat.stage)) continue;
    const params = materialModelParameters(material, resolvedProfile);
    const element = primaryElement(material, params);
    const prediction = endpoint?.[PREDICTION_KEYS[element]];
    const target = endpoint?.grade?.targets?.[element];
    if (!element || !prediction?.available || !finite(target?.min) || Number(prediction.value) >= Number(target.min)) continue;
    const desired = targetMidpoint(target);
    const deltaPercent = desired - Number(prediction.value);
    const contentPercent = Number(material.composition[element]);
    const recoveryValues = Object.values(params.recovery ?? {}).filter(finite).map(Number).filter((value) => value > 0 && value <= 1);
    if (!(contentPercent > 0) || !recoveryValues.length) continue;
    const multiplier = Number(resolvedProfile.corrections.alloyAmountMultiplier ?? 1) / Number(resolvedProfile.corrections.effectMultiplier ?? 1);
    const amountRange = sortedRange(recoveryValues.map((recovery) => Number(endpoint.estimatedSteelMass) * deltaPercent / (contentPercent * recovery) * multiplier));
    const limited = clampRange(amountRange, params.minKg ?? limit.minKg, params.maxKg ?? limit.maxKg);
    if (limited.conflict) { candidates.push({ material, conflict: limited }); continue; }
    const baseRecovery = Number(params.recovery.base ?? recoveryValues[Math.floor(recoveryValues.length / 2)]);
    const effects = collateralEffects(material, limited.range.midpoint, Number(endpoint.estimatedSteelMass), baseRecovery);
    const targetConflicts = Object.entries(effects).filter(([key, pickup]) => finite(endpoint?.grade?.targets?.[key]?.max) && finite(endpoint?.[PREDICTION_KEYS[key]]?.value) && Number(endpoint[PREDICTION_KEYS[key]].value) + pickup > Number(endpoint.grade.targets[key].max)).map(([key]) => key);
    candidates.push({
      model,
      available: true,
      operationType: "material",
      materialCode: material.code,
      materialNameKo: material.nameKo,
      materialNameEn: material.nameEn,
      materialCategory: kind,
      amount: { ...limited.range, unit: "kg" },
      timing: buildTimingWindow(heat, kind, resolvedProfile.profile, calculatedAt, limited.range.midpoint, params),
      objective: `${element}_target_midpoint`,
      target: { element, value: desired, unit: "%" },
      effects: Object.fromEntries(Object.entries(effects).map(([key, pickup]) => [key, { direction: "increase", estimatedDelta: pickup }])),
      targetConflicts,
      confidence: confidenceStatus(resolvedProfile, finite(params.minKg ?? limit.minKg) && finite(params.maxKg ?? limit.maxKg)),
      assumptions: ["master_alloy_mass_balance", "literature_recovery_scenario", "finite_dissolution_time"],
      sourceIds: ["S50", "S51"],
    });
  }
  const usable = candidates.filter((candidate) => !candidate.conflict).sort((a, b) => a.targetConflicts.length - b.targetConflicts.length || a.amount.midpoint - b.amount.midpoint);
  if (usable.length) return usable[0];
  if (candidates.some((candidate) => candidate.conflict)) return unavailable(model, "site_limit_conflict", { conflicts: candidates.filter((candidate) => candidate.conflict).map((candidate) => ({ materialCode: candidate.material.code, ...candidate.conflict })) });
  return unavailable(model, "no_alloy_shortfall_or_stage_not_allowed");
}
