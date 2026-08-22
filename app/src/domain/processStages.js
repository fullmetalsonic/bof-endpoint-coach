export const PROCESS_STAGES = [
  { code: "G0", labelKo: "장입", labelEn: "Charge" },
  { code: "G1", labelKo: "송풍 시작", labelEn: "Blow start" },
  { code: "G2", labelKo: "용해 초기", labelEn: "Early blow" },
  { code: "G3", labelKo: "용해 중기", labelEn: "Mid blow" },
  { code: "G4", labelKo: "용해 후기", labelEn: "Late blow" },
  { code: "G5", labelKo: "정련", labelEn: "Refining" },
  { code: "G6", labelKo: "출강 검토", labelEn: "Tap review" },
  { code: "G7", labelKo: "출강", labelEn: "Tapping" },
  { code: "G8", labelKo: "후처리", labelEn: "Post-treatment" },
];

export const ACTIVE_HEAT_STATUSES = ["in_progress", "tapped"];

export function getStageDefinition(code) {
  return PROCESS_STAGES.find((stage) => stage.code === code) ?? PROCESS_STAGES[0];
}

export function getNextStage(code) {
  const index = PROCESS_STAGES.findIndex((stage) => stage.code === code);
  return index >= 0 && index < PROCESS_STAGES.length - 1 ? PROCESS_STAGES[index + 1] : null;
}

export function isActiveHeat(heat) {
  return Boolean(heat && ACTIVE_HEAT_STATUSES.includes(heat.status));
}

export function hasEndpointReviewSample(heat) {
  const valid = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  return (heat?.samples ?? []).some((sample) => (sample.status ?? "active") === "active" && sample.adopted && valid(sample.values?.C) && valid(sample.values?.temperature));
}

export function validateStageAdvance(heat) {
  if (!heat) return { ok: false, reason: "heat_required" };
  if (!isActiveHeat(heat)) return { ok: false, reason: "inactive_heat" };
  if (heat.stage === "G6") return { ok: false, reason: "tap_event_required" };
  if (heat.stage === "G8") return { ok: false, reason: "already_last_stage" };
  if (heat.stage === "G5" && !hasEndpointReviewSample(heat)) return { ok: false, reason: "endpoint_sample_required" };
  return { ok: true };
}

export function getActionAvailability(heat) {
  if (!isActiveHeat(heat)) return Object.fromEntries(["material", "sample", "analysis", "checkpoint", "reblow", "tap"].map((key) => [key, false]));
  const index = PROCESS_STAGES.findIndex((stage) => stage.code === heat.stage);
  return {
    material: (index >= 0 && index <= 5) || index === 7,
    sample: (index >= 2 && index <= 6) || index === 7,
    analysis: ((index >= 2 && index <= 6) || index === 7) && (heat.samples ?? []).some((sample) => (sample.status ?? "active") === "active"),
    checkpoint: index >= 1 && index <= 6,
    reblow: index >= 5 && index <= 6,
    tap: heat.stage === "G6",
  };
}
