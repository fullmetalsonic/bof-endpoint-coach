import { finite } from "./common.js";

function shiftedIso(at, minutes) {
  const time = new Date(at).getTime();
  return Number.isFinite(time) ? new Date(time + minutes * 60000).toISOString() : null;
}

export function buildTimingWindow(heat, kind, profile, calculatedAt = new Date().toISOString(), amountKg = null, materialParameters = {}) {
  const limit = profile.limits?.[kind];
  const shift = Number(profile.corrections?.timingShiftMinutes ?? 0);
  const allowedStages = limit?.allowedStages ?? [];
  const currentAllowed = allowedStages.includes(heat.stage);
  const currentOxygen = finite(heat.process?.cumulativeOxygenNm3) ? Number(heat.process.cumulativeOxygenNm3) : null;
  const flow = finite(heat.process?.oxygenFlowNm3PerMinute) ? Number(heat.process.oxygenFlowNm3PerMinute) : null;
  const remaining = finite(heat.process?.remainingMinutes) ? Number(heat.process.remainingMinutes) : null;
  let durationMinutes = kind === "flux" ? 3 : kind === "coolant" ? 2 : kind === "oxygen" ? Math.max(0.5, Math.min(5, remaining ?? 2)) : null;
  if (["alloy", "carburizer"].includes(kind) && finite(amountKg) && finite(materialParameters.dissolutionKgPerSecond) && Number(materialParameters.dissolutionKgPerSecond) > 0) {
    durationMinutes = Number(amountKg) / Number(materialParameters.dissolutionKgPerSecond) / 60;
  }
  const startAt = shiftedIso(calculatedAt, shift);
  const endAt = finite(durationMinutes) ? shiftedIso(calculatedAt, shift + Number(durationMinutes)) : null;
  const oxygenStart = currentOxygen !== null && flow !== null ? Math.max(0, currentOxygen + shift * flow) : null;
  const oxygenEnd = oxygenStart !== null && flow !== null && finite(durationMinutes) ? Math.max(oxygenStart, oxygenStart + Number(durationMinutes) * flow) : null;
  return {
    available: currentAllowed,
    currentAllowed,
    allowedStages,
    stage: heat.stage,
    startAt,
    endAt,
    durationMinutes: finite(durationMinutes) ? Number(durationMinutes) : null,
    oxygenStartNm3: oxygenStart,
    oxygenEndNm3: oxygenEnd,
    estimatedFromFlow: oxygenStart !== null,
    reason: currentAllowed ? null : "stage_not_allowed",
  };
}
