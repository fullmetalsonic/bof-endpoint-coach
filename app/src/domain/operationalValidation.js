import { getActionAvailability, PROCESS_STAGES } from "./processStages.js";
import { dissolvedOxygenValidationReason, isDissolvedOxygenRecorded } from "./measurements/dissolvedOxygen.js";

const FUTURE_TOLERANCE_MS = 60_000;
const chemistryKeys = ["C", "P", "Mn", "Si", "S"];

export function hasNumericValue(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function timeValue(value) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function result(reason = null) {
  return reason ? { ok: false, reason } : { ok: true, reason: null };
}

function validateActualTime(heat, occurredAt, recordedAt) {
  const occurred = timeValue(occurredAt);
  const started = timeValue(heat?.startedAt);
  const recorded = timeValue(recordedAt) ?? Date.now();
  if (occurred === null) return "invalid_time";
  if (started !== null && occurred < started) return "time_before_heat_start";
  if (occurred > recorded + FUTURE_TOLERANCE_MS) return "future_time";
  return null;
}

function invalidOptionalNumber(value, { min = 0, max = Infinity, positive = false } = {}) {
  if (value === "" || value === null || value === undefined) return false;
  if (!hasNumericValue(value)) return true;
  const number = Number(value);
  return positive ? number <= 0 || number > max : number < min || number > max;
}

export function getStageAtTime(heat, occurredAt) {
  const occurred = timeValue(occurredAt);
  if (occurred === null) return heat?.stage ?? "G0";
  const transitions = [...(heat?.stageHistory ?? [])]
    .filter((entry) => (entry.status ?? "active") === "active" && timeValue(entry.occurredAt) !== null && timeValue(entry.occurredAt) <= occurred)
    .sort((a, b) => timeValue(a.occurredAt) - timeValue(b.occurredAt));
  return transitions.at(-1)?.to ?? "G0";
}

export function validateNewHeatInput(form, existingHeatIds = [], recordedAt = new Date().toISOString()) {
  const id = form.id?.trim();
  if (!id) return result("heat_id_required");
  if (existingHeatIds.includes(id)) return result("duplicate_heat_id");
  const timeReason = validateActualTime({ startedAt: form.startedAt }, form.startedAt, recordedAt);
  if (timeReason) return result(timeReason);
  for (const key of ["hotMetalKg", "scrapKg", "fluxKg", "plannedTotalOxygenNm3", "cumulativeOxygenNm3", "lanceHeightM", "oxygenFlowNm3PerMinute"]) {
    if (invalidOptionalNumber(form[key])) return result("nonnegative_number_required");
  }
  if (invalidOptionalNumber(form.expectedDurationMinutes, { positive: true })) return result("positive_duration_required");
  for (const key of ["hotMetalC", "hotMetalSi", "hotMetalMn", "hotMetalP", "hotMetalS", "scrapC", "scrapSi", "scrapMn", "scrapP", "scrapS"]) {
    if (invalidOptionalNumber(form[key], { max: 100 })) return result("chemistry_out_of_range");
  }
  if (invalidOptionalNumber(form.hotMetalTemperatureC, { max: 2500 })) return result("temperature_out_of_range");
  return result();
}

export function validateStageTransitionInput(heat, form, recordedAt = new Date().toISOString()) {
  const timeReason = validateActualTime(heat, form.occurredAt, recordedAt);
  if (timeReason) return result(timeReason);
  const occurred = timeValue(form.occurredAt);
  const lastTransition = [...(heat.stageHistory ?? [])].filter((entry) => (entry.status ?? "active") === "active").sort((a, b) => timeValue(b.occurredAt) - timeValue(a.occurredAt))[0];
  if (lastTransition && occurred < timeValue(lastTransition.occurredAt)) return result("stage_time_before_previous");
  for (const key of ["cumulativeOxygenNm3", "lanceHeightM", "oxygenFlowNm3PerMinute"]) {
    if (invalidOptionalNumber(form[key])) return result("nonnegative_number_required");
  }
  if (hasNumericValue(form.cumulativeOxygenNm3) && Number(form.cumulativeOxygenNm3) < Number(heat.process?.cumulativeOxygenNm3 ?? 0)) {
    return result("cumulative_oxygen_decrease");
  }
  return result();
}

export function validateHeatEventInput(heat, type, form, recordedAt = new Date().toISOString()) {
  if (!heat) return result("heat_required");
  if (!Object.hasOwn(getActionAvailability(heat), type) || !getActionAvailability(heat)[type]) return result("action_not_available");
  const timeReason = validateActualTime(heat, form.occurredAt, recordedAt);
  if (timeReason) return result(timeReason);
  const occurred = timeValue(form.occurredAt);
  const historicalStage = (heat.stageHistory?.length ?? 0) > 1 ? getStageAtTime(heat, form.occurredAt) : heat.stage;
  if (["material", "sample", "analysis"].includes(type) && !getActionAvailability({ ...heat, stage: historicalStage })[type]) {
    return result("action_not_available_at_time");
  }
  const lastTransition = [...(heat.stageHistory ?? [])].filter((entry) => (entry.status ?? "active") === "active").sort((a, b) => timeValue(b.occurredAt) - timeValue(a.occurredAt))[0];
  if (["checkpoint", "reblow", "tap"].includes(type) && lastTransition && occurred < timeValue(lastTransition.occurredAt)) {
    return result("event_time_before_current_stage");
  }
  if (type === "material" && (!hasNumericValue(form.amountKg) || Number(form.amountKg) <= 0)) return result("positive_amount_required");
  if (type === "sample") {
    const sampleId = form.sampleId?.trim();
    if (!sampleId) return result("sample_id_required");
    if ((heat.samples ?? []).some((sample) => (sample.status ?? "active") === "active" && sample.id === sampleId)) return result("duplicate_sample_id");
  }
  if (type === "analysis") {
    const sample = (heat.samples ?? []).find((item) => (item.status ?? "active") === "active" && item.id === form.sampleId);
    if (!sample) return result("sample_required");
    if (timeValue(form.occurredAt) < timeValue(sample.sampledAt)) return result("analysis_before_sample");
    const values = form.values ?? {};
    const dissolvedOxygenReason = dissolvedOxygenValidationReason(form.dissolvedOxygen);
    if (dissolvedOxygenReason) return result(dissolvedOxygenReason);
    if (![...chemistryKeys, "temperature"].some((key) => hasNumericValue(values[key])) && !isDissolvedOxygenRecorded(form.dissolvedOxygen)) return result("analysis_value_required");
    if (chemistryKeys.some((key) => invalidOptionalNumber(values[key], { max: 100 }))) return result("chemistry_out_of_range");
    if (invalidOptionalNumber(values.temperature, { max: 2500 })) return result("temperature_out_of_range");
    if (invalidOptionalNumber(form.cumulativeOxygenNm3)) return result("nonnegative_number_required");
  }
  if (type === "checkpoint") {
    if (!hasNumericValue(form.cumulativeOxygenNm3) || Number(form.cumulativeOxygenNm3) < 0) return result("nonnegative_number_required");
    if (Number(form.cumulativeOxygenNm3) < Number(heat.process?.cumulativeOxygenNm3 ?? 0)) return result("cumulative_oxygen_decrease");
    for (const key of ["lanceHeightM", "oxygenFlowNm3PerMinute", "remainingMinutes"]) {
      if (invalidOptionalNumber(form[key])) return result("nonnegative_number_required");
    }
  }
  if (type === "reblow") {
    if (!hasNumericValue(form.additionalOxygenNm3) || Number(form.additionalOxygenNm3) <= 0) return result("positive_oxygen_required");
    if (invalidOptionalNumber(form.durationMinutes, { positive: true })) return result("positive_duration_required");
  }
  return result();
}

export function validationMessage(reason, locale = "ko") {
  const messages = {
    heat_id_required: ["차지 번호를 입력하십시오.", "Enter a heat ID."],
    duplicate_heat_id: ["이미 존재하는 차지 번호입니다.", "This heat ID already exists."],
    invalid_time: ["유효한 실제 시각을 입력하십시오.", "Enter a valid actual time."],
    time_before_heat_start: ["차지 시작 이전 시각은 기록할 수 없습니다.", "The time cannot be before heat start."],
    future_time: ["현재보다 미래인 시각은 실제 기록으로 저장할 수 없습니다.", "A future time cannot be saved as an actual record."],
    stage_time_before_previous: ["이전 단계보다 빠른 시각으로 전환할 수 없습니다.", "A stage cannot precede the previous transition."],
    event_time_before_current_stage: ["현재 단계 시작 이전 시각입니다.", "The time is before the current stage began."],
    nonnegative_number_required: ["수치에는 0 이상의 유효한 값을 입력하십시오.", "Enter a valid non-negative value."],
    positive_duration_required: ["시간은 0보다 커야 합니다.", "Duration must be greater than zero."],
    positive_amount_required: ["투입량은 0보다 커야 합니다.", "The amount must be greater than zero."],
    positive_oxygen_required: ["추가 산소량은 0보다 커야 합니다.", "Additional oxygen must be greater than zero."],
    chemistry_out_of_range: ["성분값은 0~100% 범위여야 합니다.", "Chemistry must be between 0 and 100%."],
    temperature_out_of_range: ["온도값은 0~2500°C 범위여야 합니다.", "Temperature must be between 0 and 2500°C."],
    cumulative_oxygen_decrease: ["누적 산소량은 이전 기록보다 작아질 수 없습니다.", "Cumulative oxygen cannot decrease."],
    sample_id_required: ["샘플 ID를 입력하십시오.", "Enter a sample ID."],
    duplicate_sample_id: ["이미 존재하는 샘플 ID입니다.", "This sample ID already exists."],
    sample_required: ["분석 대상 샘플을 선택하십시오.", "Select a sample for analysis."],
    analysis_before_sample: ["분석 시각은 샘플 채취 시각보다 빠를 수 없습니다.", "Analysis time cannot precede sampling."],
    analysis_value_required: ["분석값을 하나 이상 입력하십시오.", "Enter at least one analysis value."],
    dissolved_oxygen_invalid: ["용존산소에는 0 이상의 유효한 ppm 값을 입력하거나 빈칸으로 두십시오.", "Enter a valid non-negative dissolved-oxygen value in ppm, or leave it blank."],
    dissolved_oxygen_status_invalid: ["용존산소 기록 상태를 확인하십시오.", "Check the dissolved-oxygen record status."],
    dissolved_oxygen_source_invalid: ["지원하는 용존산소 측정 출처를 선택하십시오.", "Select a supported dissolved-oxygen measurement source."],
    dissolved_oxygen_note_too_long: ["용존산소 메모는 200자 이하여야 합니다.", "The dissolved-oxygen note must be 200 characters or fewer."],
    action_not_available: ["현재 단계에서는 이 입력을 저장할 수 없습니다.", "This entry is not available at the current stage."],
    action_not_available_at_time: ["입력한 실제 시각의 공정 단계에서는 이 항목을 기록할 수 없습니다.", "This entry is not available at the stage corresponding to the entered time."],
    correction_reason_required: ["정정·취소 사유를 입력하십시오.", "Enter a correction or cancellation reason."],
    correction_target_missing: ["정정할 기록을 찾을 수 없습니다.", "The correction target could not be found."],
    correction_mode_invalid: ["지원하지 않는 정정 방식입니다.", "This correction mode is not supported."],
    record_not_correctable: ["이 기록은 수정할 수 없습니다.", "This record cannot be corrected."],
    sample_after_analysis: ["샘플 채취 시각은 해당 분석 시각보다 늦을 수 없습니다.", "Sample time cannot be later than its analysis."],
    cumulative_oxygen_sequence: ["누적 산소량이 앞뒤 기록의 순서를 벗어납니다.", "Cumulative oxygen must remain between the surrounding records."],
    tap_before_g6: ["출강 시각은 G6 출강 검토 시작보다 빠를 수 없습니다.", "Tap time cannot precede the start of G6 tap review."],
    tap_after_g8: ["출강 시각은 G8 후처리 완료보다 늦을 수 없습니다.", "Tap time cannot be later than G8 completion."],
    tap_before_pre_tap_record: ["출강 시각은 이미 기록된 G6 최종 입력보다 빠를 수 없습니다.", "Tap time cannot precede an existing final G6 record."],
    tap_after_post_tap_record: ["출강 시각은 이미 기록된 G7 후처리 입력보다 늦을 수 없습니다.", "Tap time cannot be later than an existing G7 post-tap record."],
    actual_endpoint_after_tap: ["종점 실제값은 출강 이후에만 지정할 수 있습니다.", "The actual endpoint result can only be set after tapping."],
  };
  return (messages[reason] ?? [reason, reason])[locale === "ko" ? 0 : 1];
}

export function isKnownStage(stage) {
  return PROCESS_STAGES.some((item) => item.code === stage);
}
