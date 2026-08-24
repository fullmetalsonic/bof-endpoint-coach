import { getActionAvailability } from "./processStages.js";
import { getStageAtTime } from "./operationalValidation.js";
import { dissolvedOxygenValidationReason, isDissolvedOxygenRecorded } from "./measurements/dissolvedOxygen.js";

const chemistryKeys = ["C", "P", "Mn", "Si", "S"];
const FUTURE_TOLERANCE_MS = 60_000;

function result(reason = null) {
  return reason ? { ok: false, reason } : { ok: true, reason: null };
}

function time(value) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function hasNumber(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function invalidNumber(value, { min = 0, max = Infinity, required = false, positive = false } = {}) {
  if (value === "" || value === null || value === undefined) return required;
  if (!hasNumber(value)) return true;
  const number = Number(value);
  return number < min || number > max || (positive && number <= 0);
}

function validateTime(heat, occurredAt, recordedAt) {
  const occurred = time(occurredAt);
  const started = time(heat?.startedAt);
  const recorded = time(recordedAt) ?? Date.now();
  if (occurred === null) return "invalid_time";
  if (started !== null && occurred < started) return "time_before_heat_start";
  if (occurred > recorded + FUTURE_TOLERANCE_MS) return "future_time";
  return null;
}

function active(record) {
  return (record?.status ?? "active") === "active";
}

function checkpointOxygenBounds(heat, targetId, occurredAt) {
  const occurred = time(occurredAt);
  const values = [
    ...(heat.events ?? [])
      .filter((event) => active(event) && event.id !== targetId && event.type === "checkpoint" && hasNumber(event.payload?.cumulativeOxygenNm3))
      .map((event) => ({ at: time(event.occurredAt), value: Number(event.payload.cumulativeOxygenNm3) })),
    ...(heat.stageHistory ?? [])
      .filter((entry) => active(entry) && hasNumber(entry.process?.cumulativeOxygenNm3))
      .map((entry) => ({ at: time(entry.occurredAt), value: Number(entry.process.cumulativeOxygenNm3) })),
  ].filter((entry) => entry.at !== null);
  const before = values.filter((entry) => entry.at <= occurred).map((entry) => entry.value);
  const after = values.filter((entry) => entry.at >= occurred).map((entry) => entry.value);
  return {
    minimum: before.length ? Math.max(...before) : Number(heat.correctionBase?.process?.cumulativeOxygenNm3 ?? 0),
    maximum: after.length ? Math.min(...after) : Infinity,
  };
}

export function validateCorrectionRequest(heat, target, mode, changes = {}, reason = "", recordedAt = new Date().toISOString()) {
  if (!reason?.trim()) return result("correction_reason_required");
  if (!target) return result("correction_target_missing");

  if (mode === "actual") {
    if (!["G7", "G8"].includes(heat.stage)) return result("actual_endpoint_after_tap");
    return result();
  }
  if (["void", "rollback", "adopt"].includes(mode)) return result();

  const occurredAt = changes.occurredAt;
  const timeReason = validateTime(heat, occurredAt, recordedAt);
  if (timeReason) return result(timeReason);

  if (mode === "tap") {
    const g6 = (heat.stageHistory ?? []).filter(active).find((entry) => entry.to === "G6");
    const g8 = (heat.stageHistory ?? []).filter(active).find((entry) => entry.to === "G8");
    if (g6 && time(occurredAt) < time(g6.occurredAt)) return result("tap_before_g6");
    if (g8 && time(occurredAt) > time(g8.occurredAt)) return result("tap_after_g8");
    const preTapTimes = (heat.events ?? []).filter((event) => active(event) && event.type !== "tap" && event.stage === "G6").map((event) => time(event.occurredAt)).filter((value) => value !== null);
    const postTapTimes = (heat.events ?? []).filter((event) => active(event) && event.type !== "tap" && ["G7", "G8"].includes(event.stage)).map((event) => time(event.occurredAt)).filter((value) => value !== null);
    if (preTapTimes.length && time(occurredAt) < Math.max(...preTapTimes)) return result("tap_before_pre_tap_record");
    if (postTapTimes.length && time(occurredAt) > Math.min(...postTapTimes)) return result("tap_after_post_tap_record");
    return result();
  }

  if (mode !== "correct") return result("correction_mode_invalid");
  const historicalStage = getStageAtTime(heat, occurredAt);
  const historicalStatus = historicalStage === "G7" ? "tapped" : "in_progress";
  if (!getActionAvailability({ ...heat, stage: historicalStage, status: historicalStatus })[target.type]) return result("action_not_available_at_time");
  if (target.kind === "analysis" || target.type === "analysis") {
    const sample = (heat.samples ?? []).find((item) => item.id === (target.sampleId ?? target.payload?.sampleId));
    if (!sample) return result("sample_required");
    if (time(occurredAt) < time(sample.sampledAt)) return result("analysis_before_sample");
    const values = changes.values ?? {};
    const dissolvedOxygenReason = dissolvedOxygenValidationReason(changes.dissolvedOxygen);
    if (dissolvedOxygenReason) return result(dissolvedOxygenReason);
    if (![...chemistryKeys, "temperature"].some((key) => hasNumber(values[key])) && !isDissolvedOxygenRecorded(changes.dissolvedOxygen)) return result("analysis_value_required");
    if (chemistryKeys.some((key) => invalidNumber(values[key], { max: 100 }))) return result("chemistry_out_of_range");
    if (invalidNumber(values.temperature, { max: 2500 })) return result("temperature_out_of_range");
    if (invalidNumber(changes.processSnapshot?.cumulativeOxygenNm3)) return result("nonnegative_number_required");
    return result();
  }

  if (target.type === "sample") {
    const sampleId = changes.sampleId?.trim();
    const originalId = target.payload?.sampleId;
    if (!sampleId) return result("sample_id_required");
    if ((heat.samples ?? []).some((sample) => active(sample) && sample.id !== originalId && sample.id === sampleId)) return result("duplicate_sample_id");
    const sample = (heat.samples ?? []).find((item) => item.id === originalId);
    const earliestAnalysis = (sample?.analysisResults ?? []).filter(active).map((analysis) => time(analysis.occurredAt)).filter((value) => value !== null).sort((a, b) => a - b)[0];
    if (earliestAnalysis !== undefined && time(occurredAt) > earliestAnalysis) return result("sample_after_analysis");
    return result();
  }
  if (target.type === "material") {
    if (invalidNumber(changes.amountKg, { required: true, positive: true })) return result("positive_amount_required");
    return result();
  }
  if (target.type === "checkpoint") {
    if (invalidNumber(changes.cumulativeOxygenNm3, { required: true })) return result("nonnegative_number_required");
    for (const key of ["lanceHeightM", "oxygenFlowNm3PerMinute", "remainingMinutes"]) if (invalidNumber(changes[key])) return result("nonnegative_number_required");
    const bounds = checkpointOxygenBounds(heat, target.id, occurredAt);
    if (Number(changes.cumulativeOxygenNm3) < bounds.minimum || Number(changes.cumulativeOxygenNm3) > bounds.maximum) return result("cumulative_oxygen_sequence");
    return result();
  }
  if (target.type === "reblow") {
    if (invalidNumber(changes.additionalOxygenNm3, { required: true, positive: true })) return result("positive_oxygen_required");
    if (invalidNumber(changes.durationMinutes, { positive: true })) return result("positive_duration_required");
    return result();
  }
  return result("record_not_correctable");
}

export function assertCorrectionRequest(heat, target, mode, changes, reason, recordedAt) {
  const validation = validateCorrectionRequest(heat, target, mode, changes, reason, recordedAt);
  if (!validation.ok) throw new Error(validation.reason);
}
