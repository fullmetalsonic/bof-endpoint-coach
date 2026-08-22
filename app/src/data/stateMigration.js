import { normalizeCoefficientProfile } from "../calculation/coefficientProfile.js";

export function normalizeCoachState(state) {
  if (!state?.settings) return state;
  const migratedProfileIds = (state.settings.coefficientProfiles ?? []).filter((profile) => !profile?.literatureValues).map((profile) => profile.id);
  const coefficientProfiles = (state.settings.coefficientProfiles ?? []).map(normalizeCoefficientProfile);
  return {
    ...state,
    settings: {
      ...state.settings,
      coefficientProfiles,
    },
    operationLog: migratedProfileIds.length
      ? [...(state.operationLog ?? []), {
        id: `LOG-MIGRATE-${Date.now()}`,
        type: "legacy_coefficient_profile_archived",
        at: new Date().toISOString(),
        profileIds: migratedProfileIds,
        formulaVersion: "BOF-REF-CALC 0.2.0",
      }]
      : state.operationLog,
  };
}
