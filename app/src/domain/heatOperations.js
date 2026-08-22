import { getNextStage, getStageDefinition, validateStageAdvance } from "./processStages.js";

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function optionalNumber(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function operatorSnapshot(operatorProfile) {
  return { displayName: operatorProfile?.displayName?.trim() || "미입력" };
}

function eventSummary(type, form) {
  if (type === "material") {
    const amount = optionalNumber(form.amountKg);
    return { summaryKo: `${form.materialName || form.materialCode || "자재"} ${amount?.toLocaleString() ?? "-"} kg 투입`, summaryEn: `${form.materialName || form.materialCode || "Material"} ${amount?.toLocaleString() ?? "-"} kg added` };
  }
  if (type === "sample") return { summaryKo: `샘플 ${form.sampleId} 채취`, summaryEn: `Sample ${form.sampleId} collected` };
  if (type === "analysis") return { summaryKo: `샘플 ${form.sampleId} 분석 입력`, summaryEn: `Analysis entered for ${form.sampleId}` };
  if (type === "checkpoint") return { summaryKo: `체크포인트 산소 ${Number(form.cumulativeOxygenNm3).toLocaleString()} Nm³`, summaryEn: `Checkpoint oxygen ${Number(form.cumulativeOxygenNm3).toLocaleString()} Nm³` };
  if (type === "reblow") return { summaryKo: `재송풍 ${Number(form.additionalOxygenNm3).toLocaleString()} Nm³`, summaryEn: `Reblow ${Number(form.additionalOxygenNm3).toLocaleString()} Nm³` };
  if (type === "tap") return { summaryKo: "출강 기록", summaryEn: "Tap recorded" };
  return { summaryKo: type, summaryEn: type };
}

export function createHeatFromForm(form, operatorProfile, recordedAt = new Date().toISOString()) {
  const stage = getStageDefinition("G0");
  const expectedDuration = optionalNumber(form.expectedDurationMinutes);
  const expectedTapAt = expectedDuration === null ? null : new Date(new Date(form.startedAt).getTime() + expectedDuration * 60000).toISOString();
  const recordedBy = operatorSnapshot(operatorProfile);
  return {
    id: form.id.trim(),
    gradeCode: form.gradeCode,
    equipmentProfileId: form.equipmentProfileId,
    coefficientProfileId: form.coefficientProfileId,
    demo: false,
    status: "in_progress",
    stage: stage.code,
    stageLabelKo: stage.labelKo,
    stageLabelEn: stage.labelEn,
    startedAt: form.startedAt,
    expectedTapAt,
    initial: {
      hotMetalKg: optionalNumber(form.hotMetalKg), hotMetalC: optionalNumber(form.hotMetalC), hotMetalSi: optionalNumber(form.hotMetalSi),
      hotMetalMn: optionalNumber(form.hotMetalMn), hotMetalP: optionalNumber(form.hotMetalP), hotMetalTemperatureC: optionalNumber(form.hotMetalTemperatureC),
      scrapKg: optionalNumber(form.scrapKg), scrapC: optionalNumber(form.scrapC), fluxKg: optionalNumber(form.fluxKg),
      plannedTotalOxygenNm3: optionalNumber(form.plannedTotalOxygenNm3),
    },
    process: {
      cumulativeOxygenNm3: optionalNumber(form.cumulativeOxygenNm3) ?? 0,
      lanceHeightM: optionalNumber(form.lanceHeightM),
      oxygenFlowNm3PerMinute: optionalNumber(form.oxygenFlowNm3PerMinute),
      remainingMinutes: expectedDuration,
      plannedValuesIncluded: false,
    },
    samples: [],
    events: [{ id: id("EV"), type: "heat_created", occurredAt: form.startedAt, recordedAt, recordedBy, summaryKo: "차지 생성 및 초기값 입력", summaryEn: "Heat created with initial inputs" }],
    stageHistory: [{ id: id("STAGE"), from: null, to: "G0", occurredAt: form.startedAt, recordedAt, recordedBy, note: "" }],
  };
}

export function advanceHeat(heat, form, operatorProfile, recordedAt = new Date().toISOString()) {
  const validation = validateStageAdvance(heat);
  if (!validation.ok) throw new Error(validation.reason);
  const nextStage = getNextStage(heat.stage);
  const recordedBy = operatorSnapshot(operatorProfile);
  return {
    ...heat,
    stage: nextStage.code,
    stageLabelKo: nextStage.labelKo,
    stageLabelEn: nextStage.labelEn,
    status: nextStage.code === "G8" ? "completed" : heat.status,
    completedAt: nextStage.code === "G8" ? form.occurredAt : heat.completedAt,
    process: {
      ...heat.process,
      cumulativeOxygenNm3: optionalNumber(form.cumulativeOxygenNm3) ?? heat.process?.cumulativeOxygenNm3 ?? 0,
      lanceHeightM: optionalNumber(form.lanceHeightM) ?? heat.process?.lanceHeightM ?? null,
      oxygenFlowNm3PerMinute: optionalNumber(form.oxygenFlowNm3PerMinute) ?? heat.process?.oxygenFlowNm3PerMinute ?? null,
    },
    stageHistory: [...(heat.stageHistory ?? []), { id: id("STAGE"), from: heat.stage, to: nextStage.code, occurredAt: form.occurredAt, recordedAt, recordedBy, note: form.note?.trim() || "" }],
  };
}

export function applyHeatEvent(heat, type, form, operatorProfile, recordedAt = new Date().toISOString()) {
  if (!heat) throw new Error("heat_required");
  if (type === "tap" && heat.stage !== "G6") throw new Error("tap_requires_g6");
  const recordedBy = operatorSnapshot(operatorProfile);
  const summary = eventSummary(type, form);
  const event = { id: id("EV"), type, occurredAt: form.occurredAt, recordedAt, recordedBy, ...summary, payload: form };
  let next = { ...heat, events: [...(heat.events ?? []), event] };
  if (type === "checkpoint") next.process = { ...heat.process, cumulativeOxygenNm3: Number(form.cumulativeOxygenNm3), lanceHeightM: optionalNumber(form.lanceHeightM), oxygenFlowNm3PerMinute: optionalNumber(form.oxygenFlowNm3PerMinute), remainingMinutes: optionalNumber(form.remainingMinutes), plannedValuesIncluded: false };
  if (type === "reblow") next.process = { ...heat.process, cumulativeOxygenNm3: Number(heat.process?.cumulativeOxygenNm3 ?? 0) + Number(form.additionalOxygenNm3), remainingMinutes: optionalNumber(form.durationMinutes) };
  if (type === "material" && form.materialCategory === "flux") next.initial = { ...heat.initial, fluxKg: Number(heat.initial?.fluxKg ?? 0) + Number(form.amountKg) };
  if (type === "sample") {
    if ((heat.samples ?? []).some((sample) => sample.id === form.sampleId)) throw new Error("duplicate_sample_id");
    next.samples = [...(heat.samples ?? []), { id: form.sampleId, sampledAt: form.occurredAt, stage: heat.stage, method: "Pending", adopted: false, values: {}, processSnapshot: { cumulativeOxygenNm3: Number(heat.process?.cumulativeOxygenNm3 ?? 0), oxygenFlowNm3PerMinute: optionalNumber(heat.process?.oxygenFlowNm3PerMinute), lanceHeightM: optionalNumber(heat.process?.lanceHeightM) } }];
  }
  if (type === "analysis") {
    const sampleId = form.sampleId;
    if (!sampleId || !(heat.samples ?? []).some((sample) => sample.id === sampleId)) throw new Error("sample_required");
    const values = Object.fromEntries(Object.entries(form.values ?? {}).filter(([, value]) => value !== "").map(([key, value]) => [key, Number(value)]));
    next.samples = heat.samples.map((sample) => ({ ...sample, adopted: sample.id === sampleId, ...(sample.id === sampleId ? { method: form.method || "OES", values, analyzedAt: form.occurredAt, analysisProcessSnapshot: { cumulativeOxygenNm3: optionalNumber(form.cumulativeOxygenNm3) } } : {}) }));
  }
  if (type === "tap") {
    const stage = getStageDefinition("G7");
    next = {
      ...next, status: "tapped", stage: stage.code, stageLabelKo: stage.labelKo, stageLabelEn: stage.labelEn, tappedAt: form.occurredAt,
      stageHistory: [...(heat.stageHistory ?? []), { id: id("STAGE"), from: "G6", to: "G7", occurredAt: form.occurredAt, recordedAt, recordedBy, note: form.note?.trim() || "" }],
    };
  }
  return next;
}

export function cancelHeat(heat, reason, operatorProfile, occurredAt = new Date().toISOString()) {
  if (!["in_progress", "tapped"].includes(heat.status)) throw new Error("inactive_heat");
  return { ...heat, status: "cancelled", cancelledAt: occurredAt, cancellationReason: reason.trim(), lifecycleRecordedBy: operatorSnapshot(operatorProfile) };
}

export function archiveHeat(heat, operatorProfile, occurredAt = new Date().toISOString()) {
  if (!["completed", "cancelled"].includes(heat.status)) throw new Error("archive_requires_closed_heat");
  return { ...heat, status: "archived", archivedAt: occurredAt, lifecycleRecordedBy: operatorSnapshot(operatorProfile) };
}

export function canDeleteHeat(heat) {
  const substantiveEvents = (heat.events ?? []).filter((event) => event.type !== "heat_created" && event.type !== "charge");
  return Boolean(heat?.demo || (heat?.stage === "G0" && substantiveEvents.length === 0));
}
