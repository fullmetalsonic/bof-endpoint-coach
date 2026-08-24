import { getNextStage, getStageDefinition, validateStageAdvance } from "./processStages.js";
import { getStageAtTime, validateHeatEventInput, validateNewHeatInput, validateStageTransitionInput } from "./operationalValidation.js";
import { getAnalysisResults, syncSampleAnalysisProjection } from "./analysisRecords.js";
import { normalizeDissolvedOxygenRecord } from "./measurements/dissolvedOxygen.js";
import { captureHeatReferenceSnapshot } from "./referenceSnapshot.js";

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function optionalNumber(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function operatorSnapshot(operatorProfile) {
  return { displayName: operatorProfile?.displayName?.trim() || "미입력" };
}

export function summarizeHeatEvent(type, form) {
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

export function createHeatFromForm(form, operatorProfile, recordedAt = new Date().toISOString(), settings = null) {
  const inputValidation = validateNewHeatInput(form, [], recordedAt);
  if (!inputValidation.ok) throw new Error(inputValidation.reason);
  const stage = getStageDefinition("G0");
  const expectedDuration = optionalNumber(form.expectedDurationMinutes);
  const expectedTapAt = expectedDuration === null ? null : new Date(new Date(form.startedAt).getTime() + expectedDuration * 60000).toISOString();
  const recordedBy = operatorSnapshot(operatorProfile);
  const initial = {
    hotMetalKg: optionalNumber(form.hotMetalKg), hotMetalC: optionalNumber(form.hotMetalC), hotMetalSi: optionalNumber(form.hotMetalSi),
    hotMetalMn: optionalNumber(form.hotMetalMn), hotMetalP: optionalNumber(form.hotMetalP), hotMetalS: optionalNumber(form.hotMetalS), hotMetalTemperatureC: optionalNumber(form.hotMetalTemperatureC),
    scrapKg: optionalNumber(form.scrapKg), scrapC: optionalNumber(form.scrapC), scrapSi: optionalNumber(form.scrapSi), scrapMn: optionalNumber(form.scrapMn), scrapP: optionalNumber(form.scrapP), scrapS: optionalNumber(form.scrapS), fluxKg: optionalNumber(form.fluxKg),
    plannedTotalOxygenNm3: optionalNumber(form.plannedTotalOxygenNm3),
    inputMetadata: form.inputMetadata ? structuredClone(form.inputMetadata) : undefined,
  };
  const process = {
    cumulativeOxygenNm3: optionalNumber(form.cumulativeOxygenNm3) ?? 0,
    lanceHeightM: optionalNumber(form.lanceHeightM),
    oxygenFlowNm3PerMinute: optionalNumber(form.oxygenFlowNm3PerMinute),
    remainingMinutes: expectedDuration,
    plannedValuesIncluded: false,
  };
  const selection = { gradeCode: form.gradeCode, equipmentProfileId: form.equipmentProfileId, coefficientProfileId: form.coefficientProfileId };
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
    initial,
    process,
    correctionBase: { ...selection, initial: structuredClone(initial), process: structuredClone(process), expectedTapAt, replayInitial: true, replayProcess: true, legacy: false },
    referenceSnapshot: settings ? captureHeatReferenceSnapshot(settings, selection, recordedAt) : null,
    predictionSnapshots: [],
    additionCoach: { hidden: false, operatorPlans: [], proposals: [], decisions: [] },
    correctionLog: [],
    actualEndpointAnalysisId: null,
    samples: [],
    events: [{ id: id("EV"), type: "heat_created", status: "active", occurredAt: form.startedAt, recordedAt, recordedBy, summaryKo: "차지 생성 및 초기값 입력", summaryEn: "Heat created with initial inputs" }],
    stageHistory: [{ id: id("STAGE"), from: null, to: "G0", status: "active", occurredAt: form.startedAt, recordedAt, recordedBy, note: "", process: structuredClone(process) }],
  };
}

export function updateHeatInputs(heat, form, operatorProfile, recordedAt = new Date().toISOString(), settings = null) {
  const inputValidation = validateNewHeatInput({ ...form, id: heat.id, startedAt: heat.startedAt }, [], recordedAt);
  if (!inputValidation.ok) throw new Error(inputValidation.reason);
  const expectedDuration = optionalNumber(form.expectedDurationMinutes);
  const expectedTapAt = expectedDuration === null ? heat.expectedTapAt ?? null : new Date(new Date(heat.startedAt).getTime() + expectedDuration * 60000).toISOString();
  const recordedBy = operatorSnapshot(operatorProfile);
  const event = {
    id: id("EV"),
    type: "initial_updated",
    status: "active",
    stage: heat.stage,
    occurredAt: recordedAt,
    recordedAt,
    recordedBy,
    summaryKo: "기초 입력값 확인·수정",
    summaryEn: "Initial inputs reviewed and updated",
    payload: {
      gradeCode: form.gradeCode,
      equipmentProfileId: form.equipmentProfileId,
      coefficientProfileId: form.coefficientProfileId,
      initial: {
        hotMetalKg: optionalNumber(form.hotMetalKg), hotMetalC: optionalNumber(form.hotMetalC), hotMetalSi: optionalNumber(form.hotMetalSi),
        hotMetalMn: optionalNumber(form.hotMetalMn), hotMetalP: optionalNumber(form.hotMetalP), hotMetalS: optionalNumber(form.hotMetalS), hotMetalTemperatureC: optionalNumber(form.hotMetalTemperatureC),
        scrapKg: optionalNumber(form.scrapKg), scrapC: optionalNumber(form.scrapC), scrapSi: optionalNumber(form.scrapSi), scrapMn: optionalNumber(form.scrapMn), scrapP: optionalNumber(form.scrapP), scrapS: optionalNumber(form.scrapS), fluxKg: optionalNumber(form.fluxKg),
        plannedTotalOxygenNm3: optionalNumber(form.plannedTotalOxygenNm3),
      },
      inputMetadata: form.inputMetadata ? structuredClone(form.inputMetadata) : undefined,
    },
  };
  const selection = { gradeCode: form.gradeCode, equipmentProfileId: form.equipmentProfileId, coefficientProfileId: form.coefficientProfileId };
  return {
    ...heat,
    gradeCode: form.gradeCode,
    equipmentProfileId: form.equipmentProfileId,
    coefficientProfileId: form.coefficientProfileId,
    expectedTapAt,
    initial: {
      ...heat.initial,
      ...event.payload.initial,
      inputMetadata: event.payload.inputMetadata,
    },
    process: heat.stage === "G0" && expectedDuration !== null ? { ...heat.process, remainingMinutes: expectedDuration } : heat.process,
    events: [...(heat.events ?? []), event],
    referenceSnapshot: settings ? captureHeatReferenceSnapshot(settings, selection, recordedAt) : heat.referenceSnapshot,
  };
}

export function advanceHeat(heat, form, operatorProfile, recordedAt = new Date().toISOString()) {
  const validation = validateStageAdvance(heat);
  if (!validation.ok) throw new Error(validation.reason);
  const inputValidation = validateStageTransitionInput(heat, form, recordedAt);
  if (!inputValidation.ok) throw new Error(inputValidation.reason);
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
    stageHistory: [...(heat.stageHistory ?? []), { id: id("STAGE"), from: heat.stage, to: nextStage.code, status: "active", occurredAt: form.occurredAt, recordedAt, recordedBy, note: form.note?.trim() || "", process: {
      cumulativeOxygenNm3: optionalNumber(form.cumulativeOxygenNm3) ?? heat.process?.cumulativeOxygenNm3 ?? 0,
      lanceHeightM: optionalNumber(form.lanceHeightM) ?? heat.process?.lanceHeightM ?? null,
      oxygenFlowNm3PerMinute: optionalNumber(form.oxygenFlowNm3PerMinute) ?? heat.process?.oxygenFlowNm3PerMinute ?? null,
    } }],
  };
}

export function applyHeatEvent(heat, type, form, operatorProfile, recordedAt = new Date().toISOString()) {
  const validation = validateHeatEventInput(heat, type, form, recordedAt);
  if (!validation.ok) throw new Error(validation.reason);
  const recordedBy = operatorSnapshot(operatorProfile);
  const summary = summarizeHeatEvent(type, form);
  const eventStage = getStageAtTime(heat, form.occurredAt);
  const analysisId = type === "analysis" ? id("AN") : null;
  const eventPayload = type === "analysis" ? { ...form, dissolvedOxygen: normalizeDissolvedOxygenRecord(form.dissolvedOxygen) } : form;
  const event = { id: id("EV"), type, status: "active", stage: eventStage, occurredAt: form.occurredAt, recordedAt, recordedBy, ...summary, payload: eventPayload, ...(analysisId ? { analysisId } : {}) };
  let next = { ...heat, events: [...(heat.events ?? []), event] };
  if (type === "checkpoint") next.process = { ...heat.process, cumulativeOxygenNm3: Number(form.cumulativeOxygenNm3), lanceHeightM: optionalNumber(form.lanceHeightM), oxygenFlowNm3PerMinute: optionalNumber(form.oxygenFlowNm3PerMinute), remainingMinutes: optionalNumber(form.remainingMinutes), plannedValuesIncluded: false };
  if (type === "reblow") next.process = { ...heat.process, cumulativeOxygenNm3: Number(heat.process?.cumulativeOxygenNm3 ?? 0) + Number(form.additionalOxygenNm3), remainingMinutes: optionalNumber(form.durationMinutes) };
  if (type === "material" && form.materialCategory === "flux" && !["G7", "G8"].includes(eventStage)) next.initial = { ...heat.initial, fluxKg: Number(heat.initial?.fluxKg ?? 0) + Number(form.amountKg) };
  if (type === "sample") {
    const sampleId = form.sampleId.trim();
    next.samples = [...(heat.samples ?? []), { id: sampleId, status: "active", sampledAt: form.occurredAt, recordedAt, recordedBy, stage: eventStage, method: "Pending", adopted: false, adoptedAnalysisId: null, analysisResults: [], values: {}, processSnapshot: { cumulativeOxygenNm3: Number(heat.process?.cumulativeOxygenNm3 ?? 0), oxygenFlowNm3PerMinute: optionalNumber(heat.process?.oxygenFlowNm3PerMinute), lanceHeightM: optionalNumber(heat.process?.lanceHeightM) } }];
  }
  if (type === "analysis") {
    const sampleId = form.sampleId;
    if (!sampleId || !(heat.samples ?? []).some((sample) => sample.id === sampleId)) throw new Error("sample_required");
    const values = Object.fromEntries(Object.entries(form.values ?? {}).filter(([, value]) => value !== "").map(([key, value]) => [key, Number(value)]));
    const adoptsForPrediction = Object.keys(values).length > 0;
    const analysis = { id: analysisId, sampleId, status: "active", occurredAt: form.occurredAt, recordedAt, recordedBy, method: form.method || "OES", values, originalValues: structuredClone(form.originalValues ?? {}), dissolvedOxygen: normalizeDissolvedOxygenRecord(form.dissolvedOxygen), processSnapshot: { cumulativeOxygenNm3: optionalNumber(form.cumulativeOxygenNm3) } };
    next.samples = heat.samples.map((sample) => sample.id === sampleId
      ? syncSampleAnalysisProjection({ ...sample, analysisResults: [...getAnalysisResults(sample), analysis] }, adoptsForPrediction ? analysisId : sample.adoptedAnalysisId)
      : adoptsForPrediction ? syncSampleAnalysisProjection({ ...sample, adopted: false }, null) : syncSampleAnalysisProjection(sample));
  }
  if (type === "tap") {
    const stage = getStageDefinition("G7");
    next = {
      ...next, status: "tapped", stage: stage.code, stageLabelKo: stage.labelKo, stageLabelEn: stage.labelEn, tappedAt: form.occurredAt,
      stageHistory: [...(heat.stageHistory ?? []), { id: id("STAGE"), from: "G6", to: "G7", status: "active", occurredAt: form.occurredAt, recordedAt, recordedBy, note: form.note?.trim() || "", process: structuredClone(heat.process) }],
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
  const substantiveEvents = (heat.events ?? []).filter((event) => !["heat_created", "charge", "initial_updated"].includes(event.type));
  return Boolean(heat?.demo || (heat?.stage === "G0" && substantiveEvents.length === 0));
}
