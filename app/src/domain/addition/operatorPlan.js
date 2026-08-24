import { finite } from "../../calculation/addition/common.js";

const timingModes = new Set(["now", "local_time", "elapsed", "oxygen"]);
const statuses = new Set(["active", "superseded", "voided"]);

function operatorSnapshot(operatorProfile) {
  return { displayName: operatorProfile?.displayName?.trim() || "미입력" };
}

export function validateOperatorPlanInput(heat, input, now = new Date().toISOString()) {
  if (!heat || !["material", "oxygen"].includes(input?.operationType)) return { ok: false, reason: "plan_operation_invalid" };
  if (!finite(input.amount) || Number(input.amount) <= 0) return { ok: false, reason: "plan_amount_invalid" };
  if (!timingModes.has(input.timingMode)) return { ok: false, reason: "plan_timing_mode_invalid" };
  if (input.operationType === "material" && !input.materialCode?.trim()) return { ok: false, reason: "plan_material_missing" };
  if (input.timingMode === "local_time") {
    const planned = new Date(input.plannedAt).getTime();
    const started = new Date(heat.startedAt).getTime();
    if (!Number.isFinite(planned) || planned < started) return { ok: false, reason: "plan_time_invalid" };
  }
  if (input.timingMode === "elapsed" && (!finite(input.elapsedMinutes) || Number(input.elapsedMinutes) < 0)) return { ok: false, reason: "plan_elapsed_invalid" };
  if (input.timingMode === "oxygen" && (!finite(input.cumulativeOxygenNm3) || Number(input.cumulativeOxygenNm3) < 0)) return { ok: false, reason: "plan_oxygen_invalid" };
  if (!Number.isFinite(new Date(now).getTime())) return { ok: false, reason: "plan_record_time_invalid" };
  return { ok: true };
}

export function createOperatorPlan(heat, input, operatorProfile, recordedAt = new Date().toISOString()) {
  const validation = validateOperatorPlanInput(heat, input, recordedAt);
  if (!validation.ok) throw new Error(validation.reason);
  return {
    id: `ADDPLAN-${crypto.randomUUID()}`,
    status: "active",
    createdAt: recordedAt,
    recordedAt,
    recordedBy: operatorSnapshot(operatorProfile),
    heatId: heat.id,
    stage: heat.stage,
    operationType: input.operationType,
    materialCode: input.operationType === "material" ? input.materialCode.trim() : null,
    amount: Number(input.amount),
    unit: input.operationType === "oxygen" ? "Nm³" : "kg",
    timingMode: input.timingMode,
    plannedAt: input.timingMode === "now" ? recordedAt : input.timingMode === "local_time" ? new Date(input.plannedAt).toISOString() : null,
    elapsedMinutes: input.timingMode === "elapsed" ? Number(input.elapsedMinutes) : null,
    cumulativeOxygenNm3: input.timingMode === "oxygen" ? Number(input.cumulativeOxygenNm3) : null,
    note: input.note?.trim() ?? "",
  };
}

export function addOperatorPlan(heat, input, operatorProfile, recordedAt = new Date().toISOString()) {
  const priorPlans = structuredClone(heat.additionCoach?.operatorPlans ?? []);
  const previous = [...priorPlans].reverse().find((item) => (item.status ?? "active") === "active") ?? null;
  const plan = { ...createOperatorPlan(heat, input, operatorProfile, recordedAt), correctionOf: previous?.id ?? null };
  const operatorPlans = priorPlans.map((item) => previous && item.id === previous.id ? { ...item, status: "superseded", supersededBy: plan.id } : item).concat(plan);
  return { ...heat, additionCoach: { hidden: Boolean(heat.additionCoach?.hidden), proposals: structuredClone(heat.additionCoach?.proposals ?? []), decisions: structuredClone(heat.additionCoach?.decisions ?? []), operatorPlans } };
}

export function reviseOperatorPlan(heat, planId, input, operatorProfile, recordedAt = new Date().toISOString()) {
  const original = heat.additionCoach?.operatorPlans?.find((plan) => plan.id === planId && (plan.status ?? "active") === "active");
  if (!original) throw new Error("active_plan_missing");
  const replacement = { ...createOperatorPlan(heat, input, operatorProfile, recordedAt), correctionOf: original.id };
  return { ...heat, additionCoach: { ...structuredClone(heat.additionCoach), operatorPlans: heat.additionCoach.operatorPlans.map((plan) => plan.id === original.id ? { ...plan, status: "superseded", supersededBy: replacement.id } : plan).concat(replacement) } };
}

export function voidOperatorPlan(heat, planId, reason, operatorProfile, recordedAt = new Date().toISOString()) {
  if (!reason?.trim()) throw new Error("plan_void_reason_required");
  const plans = heat.additionCoach?.operatorPlans ?? [];
  if (!plans.some((plan) => plan.id === planId && (plan.status ?? "active") === "active")) throw new Error("active_plan_missing");
  return { ...heat, additionCoach: { ...structuredClone(heat.additionCoach), operatorPlans: plans.map((plan) => plan.id === planId ? { ...plan, status: "voided", voidedAt: recordedAt, voidedBy: operatorSnapshot(operatorProfile), voidReason: reason.trim() } : plan) } };
}

export function recordAdditionDecision(heat, proposalId, decision, operatorProfile, recordedAt = new Date().toISOString()) {
  if (!heat.additionCoach?.proposals?.some((proposal) => proposal.id === proposalId)) throw new Error("proposal_missing");
  if (!["keep_operator_plan", "copy_coach_to_plan", "defer_until_sample", "dismiss_for_heat"].includes(decision)) throw new Error("decision_invalid");
  if ((heat.additionCoach.decisions ?? []).some((entry) => entry.proposalId === proposalId && entry.decision === decision)) return heat;
  const entry = { id: `ADDDEC-${crypto.randomUUID()}`, proposalId, decision, createdAt: recordedAt, recordedAt, recordedBy: operatorSnapshot(operatorProfile) };
  return { ...heat, additionCoach: { ...structuredClone(heat.additionCoach), hidden: decision === "dismiss_for_heat" ? true : Boolean(heat.additionCoach.hidden), decisions: [...(heat.additionCoach.decisions ?? []), entry] } };
}

export function validatePlanRecord(plan) {
  return Boolean(plan?.id && statuses.has(plan.status ?? "active") && Number.isFinite(new Date(plan.createdAt).getTime()) && finite(plan.amount) && Number(plan.amount) > 0);
}
