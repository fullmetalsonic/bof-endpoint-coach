import { calculateFluxRecommendation } from "./fluxModel.js";
import { calculateCoolantRecommendation } from "./coolantOreModel.js";
import { calculateAlloyRecommendation } from "./alloyModel.js";
import { calculateOxygenRecommendation } from "./oxygenModel.js";
import { resolveAdditionProfile, selectAdditionProfile } from "./additionProfile.js";
import { resolveHeatSettings } from "../../domain/referenceSnapshot.js";

const PRIORITY = Object.freeze({ coolant: 1, oxygen: 2, flux: 3, alloy: 4 });

export function calculateAdditionCoach(heat, settings, endpoint, calculatedAt = new Date().toISOString()) {
  const effectiveSettings = resolveHeatSettings(heat, settings);
  const rawProfile = selectAdditionProfile(effectiveSettings, heat);
  const resolvedProfile = resolveAdditionProfile(rawProfile);
  if (resolvedProfile.validationErrors.length) return {
    calculatedAt,
    available: false,
    reason: "addition_profile_invalid",
    validationErrors: resolvedProfile.validationErrors,
    profile: { id: rawProfile.id, versionId: rawProfile.versionId, formulaVersion: rawProfile.formulaVersion },
    recommendations: [],
    primary: null,
    alternative: null,
  };
  const context = { heat, settings: effectiveSettings, endpoint, resolvedProfile, calculatedAt };
  const results = [
    calculateFluxRecommendation(context),
    calculateCoolantRecommendation(context),
    calculateAlloyRecommendation(context),
    calculateOxygenRecommendation(context),
  ];
  const recommendations = results.filter((result) => result.available).map((result) => ({
    ...result,
    formulaVersion: rawProfile.formulaVersion,
    profileId: rawProfile.id,
    profileVersionId: rawProfile.versionId,
    coefficientSnapshot: structuredClone(resolvedProfile.corrections),
  })).sort((a, b) => (a.targetConflicts?.length ?? 0) - (b.targetConflicts?.length ?? 0) || PRIORITY[a.model] - PRIORITY[b.model]);
  return {
    calculatedAt,
    available: recommendations.length > 0,
    reason: recommendations.length ? null : "no_current_recommendation",
    profile: { id: rawProfile.id, versionId: rawProfile.versionId, formulaVersion: rawProfile.formulaVersion, status: rawProfile.status, sourceIds: rawProfile.sourceIds },
    modelResults: results,
    recommendations,
    primary: recommendations[0] ?? null,
    alternative: recommendations[1] ?? null,
    mode: resolvedProfile.fieldApproved ? "field_approved" : "literature_test",
  };
}
