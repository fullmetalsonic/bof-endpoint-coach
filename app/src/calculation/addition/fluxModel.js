import { clampRange, confidenceStatus, finite, sortedRange, unavailable } from "./common.js";
import { materialModelParameters } from "./additionProfile.js";
import { buildTimingWindow } from "./timingModel.js";

function amountForBasicity(caoKg, silicaKg, material, targetBasicity) {
  const cao = Number(material.composition?.CaO ?? 0) / 100;
  const silica = Number(material.composition?.SiO2 ?? 0) / 100;
  const denominator = cao - targetBasicity * silica;
  if (!(denominator > 0)) return NaN;
  return (targetBasicity * silicaKg - caoKg) / denominator;
}

export function calculateFluxRecommendation({ heat, settings, endpoint, resolvedProfile, calculatedAt }) {
  const model = "flux";
  const limit = resolvedProfile.profile.limits.flux;
  if (!limit?.enabled) return unavailable(model, "model_disabled");
  if (!limit.allowedStages.includes(heat.stage)) return unavailable(model, "stage_not_allowed", { allowedStages: limit.allowedStages });
  const materials = (settings.materials ?? []).filter((material) => material.category === "flux" && Number(material.composition?.CaO ?? 0) > 0);
  if (!materials.length) return unavailable(model, "flux_material_missing");
  const scenarios = (endpoint?.scenarioResults ?? []).filter((scenario) => scenario.slag?.available);
  if (!scenarios.length) return unavailable(model, "slag_projection_unavailable");
  const values = resolvedProfile.values;
  const targetBasicities = [values.fluxBasicityLow, values.fluxBasicityBase, values.fluxBasicityHigh].filter(finite).map(Number);
  if (!targetBasicities.length) return unavailable(model, "basicity_target_missing");
  const candidates = materials.map((material) => {
    const rawAmounts = scenarios.flatMap((scenario) => targetBasicities.map((target) => amountForBasicity(Number(scenario.slag.oxidesKg?.CaO ?? 0), Number(scenario.slag.oxidesKg?.SiO2 ?? 0), material, target)));
    const multiplier = Number(resolvedProfile.corrections.fluxAmountMultiplier ?? 1) / Number(resolvedProfile.corrections.effectMultiplier ?? 1);
    const rawRange = sortedRange(rawAmounts.map((amount) => Math.max(0, amount * multiplier)));
    if (!rawRange || rawRange.high <= 0.5) return null;
    const limited = clampRange(rawRange, limit.minKg, limit.maxKg);
    if (limited.conflict) return { material, conflict: limited };
    const params = materialModelParameters(material, resolvedProfile);
    return {
      model,
      available: true,
      operationType: "material",
      materialCode: material.code,
      materialNameKo: material.nameKo,
      materialNameEn: material.nameEn,
      amount: { ...limited.range, unit: "kg" },
      timing: buildTimingWindow(heat, "flux", resolvedProfile.profile, calculatedAt, limited.range.midpoint, params),
      objective: "slag_basicity",
      target: { low: Math.min(...targetBasicities), high: Math.max(...targetBasicities), unit: "CaO/SiO2" },
      effects: { slagBasicity: { direction: "increase", targetLow: Math.min(...targetBasicities), targetHigh: Math.max(...targetBasicities) } },
      confidence: confidenceStatus(resolvedProfile, finite(limit.minKg) && finite(limit.maxKg)),
      assumptions: ["endpoint_slag_scenario", "complete_flux_incorporation", "cao_sio2_mass_balance"],
      sourceIds: ["S12", "S15", "S46", "S53"],
    };
  }).filter(Boolean);
  const usable = candidates.filter((candidate) => !candidate.conflict).sort((a, b) => a.amount.midpoint - b.amount.midpoint);
  if (usable.length) return usable[0];
  if (candidates.some((candidate) => candidate.conflict)) return unavailable(model, "site_limit_conflict", { conflicts: candidates.filter((candidate) => candidate.conflict).map((candidate) => ({ materialCode: candidate.material.code, ...candidate.conflict })) });
  return unavailable(model, "no_additional_flux_required", { currentBasicity: scenarios.find((scenario) => scenario.name === "base")?.slag?.basicity ?? null });
}
