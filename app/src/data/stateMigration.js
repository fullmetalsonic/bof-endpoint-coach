import { normalizeCoefficientProfile } from "../calculation/coefficientProfile.js";
import { BACKUP_SCHEMA_VERSION } from "./demoState.js";
import { getStageDefinition } from "../domain/processStages.js";
import { normalizeSampleAnalyses } from "../domain/analysisRecords.js";
import { captureHeatReferenceSnapshot } from "../domain/referenceSnapshot.js";

export function normalizeCoachState(state) {
  if (!state?.settings) return state;
  const migratedProfileIds = (state.settings.coefficientProfiles ?? []).filter((profile) => !profile?.literatureValues).map((profile) => profile.id);
  const coefficientProfiles = (state.settings.coefficientProfiles ?? []).map(normalizeCoefficientProfile);
  const normalizedSettings = { ...state.settings, coefficientProfiles, revisionHistory: state.settings.revisionHistory ?? [], lastRevision: state.settings.lastRevision ?? null };
  return {
    ...state,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    operatorProfile: { displayName: state.operatorProfile?.displayName?.trim() ?? "" },
    onboardingCompleted: state.onboardingCompleted ?? true,
    currentHeatId: state.heats?.some((heat) => heat.id === state.currentHeatId) ? state.currentHeatId : state.heats?.[0]?.id ?? null,
    settings: normalizedSettings,
    modelRegistry: state.modelRegistry ?? [{ id: "BOF-REF-CALC 0.3.0", type: "literature_hybrid", status: "reference", source: "public_literature", createdAt: "2026-08-23T00:00:00.000Z" }],
    trainingRuns: state.trainingRuns ?? [],
    restoreMetadata: state.restoreMetadata ?? null,
    heats: (state.heats ?? []).map((heat) => {
      const stage = getStageDefinition(heat.stage);
      const initialStageAt = heat.events?.find((event) => event.type === "charge" || event.type === "heat_created")?.occurredAt ?? heat.startedAt;
      const selection = { gradeCode: heat.gradeCode, equipmentProfileId: heat.equipmentProfileId, coefficientProfileId: heat.coefficientProfileId };
      return {
        ...heat,
        demo: heat.demo ?? heat.id?.startsWith("DEMO-") ?? false,
        stageLabelKo: stage.labelKo,
        stageLabelEn: stage.labelEn,
        events: (heat.events ?? []).map((event) => ({ ...event, status: event.status ?? "active" })),
        samples: (heat.samples ?? []).map(normalizeSampleAnalyses),
        stageHistory: (heat.stageHistory?.length ? heat.stageHistory : [{ id: `STAGE-MIGRATE-${heat.id}`, from: null, to: heat.stage, occurredAt: initialStageAt, recordedAt: new Date().toISOString(), recordedBy: { displayName: "미입력" }, note: "기존 저장자료 마이그레이션" }]).map((entry) => ({ ...entry, status: entry.status ?? "active" })),
        correctionBase: heat.correctionBase ?? {
          ...selection,
          initial: structuredClone(heat.initial ?? {}),
          process: structuredClone(heat.process ?? {}),
          expectedTapAt: heat.expectedTapAt ?? null,
          replayInitial: false,
          replayProcess: false,
          legacy: true,
        },
        referenceSnapshot: heat.referenceSnapshot ?? captureHeatReferenceSnapshot(normalizedSettings, selection, heat.startedAt),
        predictionSnapshots: heat.predictionSnapshots ?? [],
        correctionLog: heat.correctionLog ?? [],
        actualEndpointAnalysisId: heat.actualEndpointAnalysisId ?? null,
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
