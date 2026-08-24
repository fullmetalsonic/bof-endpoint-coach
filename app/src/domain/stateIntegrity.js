import { getStageAtTime, isKnownStage } from "./operationalValidation.js";
import { PROCESS_STAGES } from "./processStages.js";
import { findAnalysisResult, getAnalysisResults } from "./analysisRecords.js";
import { dissolvedOxygenValidationReason } from "./measurements/dissolvedOxygen.js";

const statuses = new Set(["in_progress", "tapped", "completed", "cancelled", "archived"]);
const chemistryKeys = new Set(["C", "P", "Mn", "Si", "S"]);
const recordStatuses = new Set(["active", "superseded", "voided"]);
const additionDecisions = new Set(["keep_operator_plan", "copy_coach_to_plan", "defer_until_sample", "dismiss_for_heat"]);

function uniqueNonBlank(values) {
  return values.every((value) => typeof value === "string" && value.trim()) && new Set(values).size === values.length;
}

function validDate(value) {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function validOptionalNumber(value, max = Infinity) {
  return value === null || value === undefined || value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= max);
}

function validStageHistory(heat) {
  if (!heat.stageHistory.length || !uniqueNonBlank(heat.stageHistory.map((entry) => entry.id))) return false;
  if (heat.stageHistory.some((entry) => !recordStatuses.has(entry.status ?? "active") || !validDate(entry.occurredAt))) return false;
  const activeEntries = heat.stageHistory.filter((entry) => (entry.status ?? "active") === "active").sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
  if (!activeEntries.length) return false;
  let previous = null;
  for (const entry of activeEntries) {
    if (!isKnownStage(entry.to) || (entry.from !== null && !isKnownStage(entry.from)) || !validDate(entry.occurredAt)) return false;
    if (new Date(entry.occurredAt) < new Date(heat.startedAt)) return false;
    if (!previous && entry.from !== null) return false;
    const nextStage = previous ? PROCESS_STAGES[PROCESS_STAGES.findIndex((stage) => stage.code === previous.to) + 1]?.code : null;
    if (previous && (entry.from !== previous.to || entry.to !== nextStage || new Date(entry.occurredAt) < new Date(previous.occurredAt))) return false;
    previous = entry;
  }
  return previous?.to === heat.stage;
}

function validStatusStage(heat) {
  if (heat.status === "tapped") return heat.stage === "G7";
  if (heat.status === "completed") return heat.stage === "G8";
  if (heat.status === "in_progress") return !["G7", "G8"].includes(heat.stage);
  return true;
}

function validCumulativeOxygenTimeline(heat) {
  const records = [
    ...(heat.stageHistory ?? []).filter((entry) => (entry.status ?? "active") === "active" && validOptionalNumber(entry.process?.cumulativeOxygenNm3)).map((entry) => ({ occurredAt: entry.occurredAt, value: entry.process?.cumulativeOxygenNm3 })),
    ...(heat.events ?? []).filter((event) => (event.status ?? "active") === "active" && event.type === "checkpoint" && validOptionalNumber(event.payload?.cumulativeOxygenNm3)).map((event) => ({ occurredAt: event.occurredAt, value: event.payload?.cumulativeOxygenNm3 })),
  ].filter((record) => record.value !== null && record.value !== undefined && record.value !== "")
    .sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
  return records.every((record, index) => index === 0 || Number(record.value) >= Number(records[index - 1].value));
}

function correctionTargetExists(heat, entry) {
  if (entry.targetKind === "event") return heat.events.some((event) => event.id === entry.targetId);
  if (entry.targetKind === "analysis") return Boolean(findAnalysisResult(heat, entry.targetId));
  if (entry.targetKind === "stage") return heat.stageHistory.some((stage) => stage.id === entry.targetId);
  return false;
}

export function validateOperationalState(state) {
  if (!state || !state.settings || !Array.isArray(state.heats) || !Array.isArray(state.settings.gradeProfiles) || !Array.isArray(state.settings.materials) || !Array.isArray(state.settings.equipmentProfiles) || !Array.isArray(state.settings.coefficientProfiles) || !Array.isArray(state.settings.additionModelProfiles)) return "state_shape_invalid";
  if (!Array.isArray(state.operationLog) || (state.currentHeatId !== null && !state.heats.some((heat) => heat.id === state.currentHeatId))) return "state_reference_integrity_failed";
  if (!uniqueNonBlank(state.heats.map((heat) => heat.id))) return "heat_id_integrity_failed";
  for (const heat of state.heats) {
    if (!statuses.has(heat.status) || !isKnownStage(heat.stage) || !validDate(heat.startedAt) || !validStatusStage(heat)) return "heat_state_integrity_failed";
    if (!Array.isArray(heat.events) || !Array.isArray(heat.samples) || !Array.isArray(heat.stageHistory) || !validStageHistory(heat)) return "heat_state_integrity_failed";
    if (!uniqueNonBlank(heat.events.map((event) => event.id)) || !uniqueNonBlank(heat.samples.map((sample) => sample.id))) return "record_id_integrity_failed";
    if (heat.events.some((event) => !recordStatuses.has(event.status ?? "active") || !validDate(event.occurredAt) || new Date(event.occurredAt) < new Date(heat.startedAt)) || heat.samples.some((sample) => !recordStatuses.has(sample.status ?? "active") || !validDate(sample.sampledAt) || new Date(sample.sampledAt) < new Date(heat.startedAt) || (sample.analyzedAt && !validDate(sample.analyzedAt)))) return "record_time_integrity_failed";
    if (heat.events.some((event) => (event.status ?? "active") === "active" && event.type !== "tap" && event.stage && (!isKnownStage(event.stage) || getStageAtTime(heat, event.occurredAt) !== event.stage))) return "event_stage_integrity_failed";
    const activeSamples = heat.samples.filter((sample) => (sample.status ?? "active") === "active");
    if (activeSamples.filter((sample) => sample.adopted).length > 1 || activeSamples.some((sample) => !isKnownStage(sample.stage) || getStageAtTime(heat, sample.sampledAt) !== sample.stage)) return "sample_state_integrity_failed";
    const initial = heat.initial ?? {};
    for (const [key, value] of Object.entries(initial)) {
      if (key === "inputMetadata") continue;
      const max = ["hotMetalC", "hotMetalSi", "hotMetalMn", "hotMetalP", "scrapC"].includes(key) ? 100 : Infinity;
      if (!validOptionalNumber(value, max)) return "heat_value_integrity_failed";
    }
    if (Object.values(heat.process ?? {}).some((value) => typeof value !== "boolean" && !validOptionalNumber(value))) return "heat_value_integrity_failed";
    if (!validCumulativeOxygenTimeline(heat)) return "cumulative_oxygen_integrity_failed";
    for (const sample of heat.samples) {
      const analyses = getAnalysisResults(sample);
      if (analyses.length && !uniqueNonBlank(analyses.map((analysis) => analysis.id))) return "record_id_integrity_failed";
      if (analyses.some((analysis) => !recordStatuses.has(analysis.status ?? "active") || !validDate(analysis.occurredAt) || new Date(analysis.occurredAt) < new Date(sample.sampledAt))) return "analysis_time_integrity_failed";
      for (const analysis of analyses) for (const [key, value] of Object.entries(analysis.values ?? {})) {
        if (!validOptionalNumber(value, chemistryKeys.has(key) ? 100 : key === "temperature" ? 2500 : Infinity)) return "analysis_value_integrity_failed";
      }
      if (analyses.some((analysis) => dissolvedOxygenValidationReason(analysis.dissolvedOxygen))) return "analysis_value_integrity_failed";
      if (sample.adopted && !analyses.some((analysis) => analysis.id === sample.adoptedAnalysisId && (analysis.status ?? "active") === "active")) return "sample_state_integrity_failed";
      if (!validOptionalNumber(sample.processSnapshot?.cumulativeOxygenNm3) || !validOptionalNumber(sample.analysisProcessSnapshot?.cumulativeOxygenNm3)) return "analysis_value_integrity_failed";
    }
    for (const event of heat.events.filter((item) => item.analysisId)) {
      const match = findAnalysisResult(heat, event.analysisId);
      if (!match || (event.status ?? "active") !== (match.analysis.status ?? "active") || event.payload?.sampleId !== match.sample.id) return "state_reference_integrity_failed";
    }
    if (heat.actualEndpointAnalysisId) {
      const match = findAnalysisResult(heat, heat.actualEndpointAnalysisId);
      if (!match || (match.analysis.status ?? "active") !== "active" || (match.sample.status ?? "active") !== "active" || !["G7", "G8"].includes(heat.stage)) return "state_reference_integrity_failed";
    }
    if (heat.predictionSnapshots && (!Array.isArray(heat.predictionSnapshots) || !uniqueNonBlank(heat.predictionSnapshots.map((item) => item.id)) || heat.predictionSnapshots.some((item) => !validDate(item.calculatedAt) || !isKnownStage(item.stage)))) return "prediction_snapshot_integrity_failed";
    const coach = heat.additionCoach ?? { operatorPlans: [], proposals: [], decisions: [] };
    if (![coach.operatorPlans, coach.proposals, coach.decisions].every(Array.isArray)) return "addition_coach_integrity_failed";
    if (!uniqueNonBlank([...coach.operatorPlans, ...coach.proposals, ...coach.decisions].map((item) => item.id))) return "addition_coach_integrity_failed";
    if ([...coach.operatorPlans, ...coach.proposals, ...coach.decisions].some((item) => !validDate(item.createdAt ?? item.recordedAt ?? item.calculatedAt))) return "addition_coach_integrity_failed";
    if (coach.operatorPlans.some((plan) => !recordStatuses.has(plan.status ?? "active") || plan.heatId !== heat.id || !isKnownStage(plan.stage) || !["material", "oxygen"].includes(plan.operationType) || !validOptionalNumber(plan.amount) || Number(plan.amount) <= 0 || (plan.operationType === "material" && !plan.materialCode?.trim()))) return "addition_coach_integrity_failed";
    const proposalIds = new Set(coach.proposals.map((proposal) => proposal.id));
    if (coach.proposals.some((proposal) => !recordStatuses.has(proposal.status ?? "active") || proposal.heatId !== heat.id || !isKnownStage(proposal.stage) || !proposal.result || !Array.isArray(proposal.result.recommendations ?? []) || (proposal.result.recommendations ?? []).some((recommendation) => !recommendation.model || !recommendation.operationType || !validOptionalNumber(recommendation.amount?.midpoint) || Number(recommendation.amount?.midpoint) <= 0))) return "addition_coach_integrity_failed";
    if (coach.decisions.some((decision) => !proposalIds.has(decision.proposalId) || !additionDecisions.has(decision.decision))) return "addition_coach_integrity_failed";
    if (heat.correctionLog && (!Array.isArray(heat.correctionLog) || !uniqueNonBlank(heat.correctionLog.map((item) => item.id)) || heat.correctionLog.some((item) => !validDate(item.recordedAt) || !item.reason?.trim() || !correctionTargetExists(heat, item)))) return "correction_log_integrity_failed";
  }
  return null;
}
