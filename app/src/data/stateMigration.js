import { normalizeCoefficientProfile } from "../calculation/coefficientProfile.js";
import { BACKUP_SCHEMA_VERSION } from "./demoState.js";
import { getStageDefinition } from "../domain/processStages.js";

export function normalizeCoachState(state) {
  if (!state?.settings) return state;
  const migratedProfileIds = (state.settings.coefficientProfiles ?? []).filter((profile) => !profile?.literatureValues).map((profile) => profile.id);
  const coefficientProfiles = (state.settings.coefficientProfiles ?? []).map(normalizeCoefficientProfile);
  return {
    ...state,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    operatorProfile: { displayName: state.operatorProfile?.displayName?.trim() ?? "" },
    onboardingCompleted: state.onboardingCompleted ?? true,
    currentHeatId: state.heats?.some((heat) => heat.id === state.currentHeatId) ? state.currentHeatId : state.heats?.[0]?.id ?? null,
    settings: {
      ...state.settings,
      coefficientProfiles,
    },
    heats: (state.heats ?? []).map((heat) => {
      const stage = getStageDefinition(heat.stage);
      const initialStageAt = heat.events?.find((event) => event.type === "charge" || event.type === "heat_created")?.occurredAt ?? heat.startedAt;
      return {
        ...heat,
        demo: heat.demo ?? heat.id?.startsWith("DEMO-") ?? false,
        stageLabelKo: stage.labelKo,
        stageLabelEn: stage.labelEn,
        stageHistory: heat.stageHistory?.length ? heat.stageHistory : [{ id: `STAGE-MIGRATE-${heat.id}`, from: null, to: heat.stage, occurredAt: initialStageAt, recordedAt: new Date().toISOString(), recordedBy: { displayName: "미입력" }, note: "기존 저장자료 마이그레이션" }],
      };
    }),
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
