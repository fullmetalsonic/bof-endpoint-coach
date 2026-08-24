import { getStageDefinition } from "./processStages.js";
import { getStageAtTime } from "./operationalValidation.js";
import { findAnalysisResult, getAnalysisResults, normalizeSampleAnalyses, syncSampleAnalysisProjection } from "./analysisRecords.js";
import { summarizeHeatEvent } from "./heatOperations.js";
import { assertCorrectionRequest } from "./correctionValidation.js";
import { normalizeDissolvedOxygenRecord } from "./measurements/dissolvedOxygen.js";

const correctableEventTypes = new Set(["material", "sample", "checkpoint", "reblow"]);

function id(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function operatorSnapshot(operatorProfile) {
  return { displayName: operatorProfile?.displayName?.trim() || "미입력" };
}

function isActive(record) {
  return (record?.status ?? "active") === "active";
}

function time(value) {
  return new Date(value).getTime();
}

function optionalNumber(value) {
  return value === "" || value === null || value === undefined ? null : Number(value);
}

function correctionEntry(type, target, reason, operatorProfile, recordedAt, extra = {}) {
  return {
    id: id("CORR"),
    type,
    targetKind: target.kind,
    targetId: target.id,
    reason: reason.trim(),
    recordedAt,
    recordedBy: operatorSnapshot(operatorProfile),
    ...extra,
  };
}

function activeStageHistory(heat) {
  return (heat.stageHistory ?? []).filter(isActive).sort((a, b) => time(a.occurredAt) - time(b.occurredAt));
}

function projectInitial(heat) {
  if (heat.correctionBase?.replayInitial === false) {
    return { initial: structuredClone(heat.initial ?? {}), gradeCode: heat.gradeCode, equipmentProfileId: heat.equipmentProfileId, coefficientProfileId: heat.coefficientProfileId };
  }
  const base = structuredClone(heat.correctionBase?.initial ?? heat.initial ?? {});
  let initial = base;
  let gradeCode = heat.correctionBase?.gradeCode ?? heat.gradeCode;
  let equipmentProfileId = heat.correctionBase?.equipmentProfileId ?? heat.equipmentProfileId;
  let coefficientProfileId = heat.correctionBase?.coefficientProfileId ?? heat.coefficientProfileId;
  const events = (heat.events ?? []).filter(isActive).sort((a, b) => time(a.occurredAt) - time(b.occurredAt));
  for (const event of events) {
    if (event.type === "initial_updated" && event.payload?.initial) {
      initial = { ...initial, ...structuredClone(event.payload.initial), inputMetadata: structuredClone(event.payload.inputMetadata) };
      gradeCode = event.payload.gradeCode ?? gradeCode;
      equipmentProfileId = event.payload.equipmentProfileId ?? equipmentProfileId;
      coefficientProfileId = event.payload.coefficientProfileId ?? coefficientProfileId;
    }
    if (event.type === "material" && event.payload?.materialCategory === "flux" && !["G7", "G8"].includes(event.stage)) {
      initial.fluxKg = Number(initial.fluxKg ?? 0) + Number(event.payload.amountKg ?? 0);
    }
  }
  return { initial, gradeCode, equipmentProfileId, coefficientProfileId };
}

function projectProcess(heat) {
  if (heat.correctionBase?.replayProcess === false) return structuredClone(heat.process ?? {});
  const process = structuredClone(heat.correctionBase?.process ?? heat.process ?? {});
  const records = [
    ...(heat.events ?? []).filter((event) => isActive(event) && ["checkpoint", "reblow"].includes(event.type)).map((event) => ({ ...event, recordType: "event" })),
    ...activeStageHistory(heat).filter((entry) => entry.process).map((entry) => ({ ...entry, recordType: "stage" })),
  ].sort((a, b) => time(a.occurredAt) - time(b.occurredAt));
  for (const record of records) {
    if (record.recordType === "stage") {
      const values = record.process ?? {};
      if (optionalNumber(values.cumulativeOxygenNm3) !== null) process.cumulativeOxygenNm3 = Number(values.cumulativeOxygenNm3);
      if (optionalNumber(values.lanceHeightM) !== null) process.lanceHeightM = Number(values.lanceHeightM);
      if (optionalNumber(values.oxygenFlowNm3PerMinute) !== null) process.oxygenFlowNm3PerMinute = Number(values.oxygenFlowNm3PerMinute);
    } else if (record.type === "checkpoint" && record.payload) {
      process.cumulativeOxygenNm3 = Number(record.payload.cumulativeOxygenNm3);
      process.lanceHeightM = optionalNumber(record.payload.lanceHeightM);
      process.oxygenFlowNm3PerMinute = optionalNumber(record.payload.oxygenFlowNm3PerMinute);
      process.remainingMinutes = optionalNumber(record.payload.remainingMinutes);
      process.plannedValuesIncluded = false;
    } else if (record.type === "reblow" && record.payload) {
      process.cumulativeOxygenNm3 = Number(process.cumulativeOxygenNm3 ?? 0) + Number(record.payload.additionalOxygenNm3);
      process.remainingMinutes = optionalNumber(record.payload.durationMinutes);
    }
  }
  return process;
}

export function projectCorrectedHeat(heat) {
  const stages = activeStageHistory(heat);
  const currentStage = stages.at(-1)?.to ?? "G0";
  const stageDefinition = getStageDefinition(currentStage);
  const initialProjection = projectInitial(heat);
  const samples = (heat.samples ?? []).map(normalizeSampleAnalyses);
  let status = heat.status;
  if (!["cancelled", "archived"].includes(status)) status = currentStage === "G8" ? "completed" : currentStage === "G7" ? "tapped" : "in_progress";
  const tappedStage = stages.find((entry) => entry.to === "G7");
  const completedStage = stages.find((entry) => entry.to === "G8");
  return {
    ...heat,
    ...initialProjection,
    process: projectProcess(heat),
    samples,
    stage: currentStage,
    stageLabelKo: stageDefinition.labelKo,
    stageLabelEn: stageDefinition.labelEn,
    status,
    tappedAt: tappedStage?.occurredAt,
    completedAt: completedStage?.occurredAt,
  };
}

export function timelineRecords(heat) {
  const eventRecords = (heat.events ?? []).filter((event) => event.type !== "analysis").map((event) => ({
    kind: "event",
    id: event.id,
    type: event.type,
    stage: event.stage ?? getStageAtTime(heat, event.occurredAt),
    occurredAt: event.occurredAt,
    recordedAt: event.recordedAt,
    recordedBy: event.recordedBy,
    status: event.status ?? "active",
    summaryKo: event.summaryKo,
    summaryEn: event.summaryEn,
    payload: event.payload,
    correctable: correctableEventTypes.has(event.type) && isActive(event) && (!heat.correctionBase?.legacy || event.type === "sample"),
    voidable: correctableEventTypes.has(event.type) && isActive(event) && (!heat.correctionBase?.legacy || event.type === "sample"),
  }));
  const analysisRecords = (heat.samples ?? []).flatMap((sample) => getAnalysisResults(sample).map((analysis) => ({
    kind: "analysis",
    id: analysis.id,
    type: "analysis",
    sampleId: sample.id,
    stage: sample.stage,
    occurredAt: analysis.occurredAt,
    recordedAt: analysis.recordedAt,
    recordedBy: analysis.recordedBy,
    status: analysis.status ?? "active",
    summaryKo: `샘플 ${sample.id} 분석 결과`,
    summaryEn: `Analysis result for ${sample.id}`,
    payload: analysis,
    dissolvedOxygen: structuredClone(analysis.dissolvedOxygen),
    adopted: sample.adoptedAnalysisId === analysis.id && sample.adopted,
    actual: heat.actualEndpointAnalysisId === analysis.id,
    correctable: isActive(analysis),
    voidable: isActive(analysis),
  })));
  const stages = (heat.stageHistory ?? []).map((entry) => ({
    kind: "stage",
    id: entry.id,
    type: "stage",
    stage: entry.to,
    occurredAt: entry.occurredAt,
    recordedAt: entry.recordedAt,
    recordedBy: entry.recordedBy,
    status: entry.status ?? "active",
    summaryKo: entry.from ? `${entry.from} → ${entry.to} 단계 전환` : `${entry.to} 시작`,
    summaryEn: entry.from ? `${entry.from} → ${entry.to} transition` : `${entry.to} started`,
    payload: entry,
  }));
  return [...eventRecords, ...analysisRecords, ...stages].sort((a, b) => time(b.occurredAt) - time(a.occurredAt));
}

export function correctionImpact(heat, target, action = "correct") {
  const targetTime = time(target.occurredAt);
  const laterEvents = (heat.events ?? []).filter((event) => isActive(event) && event.id !== target.id && time(event.occurredAt) >= targetTime).length;
  const laterSamples = (heat.samples ?? []).filter((sample) => (sample.status ?? "active") === "active" && time(sample.sampledAt) >= targetTime).length;
  const laterStages = activeStageHistory(heat).filter((entry) => entry.id !== target.id && time(entry.occurredAt) >= targetTime).length;
  const predictionSnapshots = (heat.predictionSnapshots ?? []).filter((snapshot) => time(snapshot.calculatedAt) >= targetTime).length;
  return {
    action,
    laterEvents,
    laterSamples,
    laterStages,
    predictionSnapshots,
    total: laterEvents + laterSamples + laterStages + predictionSnapshots,
  };
}

function appendCorrection(heat, entry) {
  return { ...heat, correctionLog: [...(heat.correctionLog ?? []), entry] };
}

export function correctEventRecord(heat, eventId, changes, reason, operatorProfile, recordedAt = new Date().toISOString()) {
  const target = (heat.events ?? []).find((event) => event.id === eventId);
  if (!target || !isActive(target) || !correctableEventTypes.has(target.type)) throw new Error("record_not_correctable");
  if (heat.correctionBase?.legacy && target.type !== "sample") throw new Error("legacy_record_not_correctable");
  const occurredAt = changes.occurredAt ?? target.occurredAt;
  const payload = { ...structuredClone(target.payload ?? {}), ...structuredClone(changes), occurredAt };
  assertCorrectionRequest(heat, { ...target, kind: "event" }, "correct", payload, reason, recordedAt);
  if (target.type === "sample") {
    const oldSampleId = target.payload?.sampleId;
    const nextSampleId = payload.sampleId?.trim();
    if (!nextSampleId) throw new Error("sample_id_required");
    if ((heat.samples ?? []).some((sample) => sample.id !== oldSampleId && sample.id === nextSampleId)) throw new Error("duplicate_sample_id");
  }
  const replacementId = id("EV");
  const replacement = {
    ...target,
    id: replacementId,
    status: "active",
    correctionOf: target.id,
    occurredAt,
    recordedAt,
    recordedBy: operatorSnapshot(operatorProfile),
    payload,
    stage: getStageAtTime(heat, occurredAt),
    ...summarizeHeatEvent(target.type, payload),
  };
  let samples = heat.samples ?? [];
  if (target.type === "sample") {
    const oldSampleId = target.payload.sampleId;
    samples = samples.map((sample) => sample.id !== oldSampleId ? sample : {
      ...sample,
      id: payload.sampleId.trim(),
      sampledAt: occurredAt,
      stage: getStageAtTime(heat, occurredAt),
      analysisResults: getAnalysisResults(sample).map((analysis) => ({ ...analysis, sampleId: payload.sampleId.trim() })),
    });
  }
  const events = heat.events.map((event) => {
    if (event.id === target.id) return { ...event, status: "superseded", supersededBy: replacementId };
    if (target.type === "sample" && event.type === "analysis" && event.payload?.sampleId === target.payload?.sampleId) return { ...event, payload: { ...event.payload, sampleId: payload.sampleId.trim() } };
    return event;
  }).concat(replacement);
  const entry = correctionEntry("record_corrected", { kind: "event", id: target.id }, reason, operatorProfile, recordedAt, { replacementId });
  return projectCorrectedHeat(appendCorrection({ ...heat, events, samples }, entry));
}

export function invalidateEventRecord(heat, eventId, reason, operatorProfile, recordedAt = new Date().toISOString()) {
  const target = (heat.events ?? []).find((event) => event.id === eventId);
  if (!target || !isActive(target) || !correctableEventTypes.has(target.type)) throw new Error("record_not_voidable");
  if (heat.correctionBase?.legacy && target.type !== "sample") throw new Error("legacy_record_not_correctable");
  assertCorrectionRequest(heat, { ...target, kind: "event" }, "void", {}, reason, recordedAt);
  let samples = heat.samples ?? [];
  let actualEndpointAnalysisId = heat.actualEndpointAnalysisId;
  if (target.type === "sample") {
    const sampleId = target.payload?.sampleId;
    const invalidated = samples.find((sample) => sample.id === sampleId);
    const invalidatedIds = new Set(getAnalysisResults(invalidated).map((analysis) => analysis.id));
    if (invalidatedIds.has(actualEndpointAnalysisId)) actualEndpointAnalysisId = null;
    samples = samples.map((sample) => sample.id === sampleId ? {
      ...sample,
      status: "voided",
      adopted: false,
      adoptedAnalysisId: null,
      analysisResults: getAnalysisResults(sample).map((analysis) => ({ ...analysis, status: "voided" })),
    } : sample);
  }
  const events = heat.events.map((event) => {
    if (event.id === target.id) return { ...event, status: "voided", voidedAt: recordedAt, voidedBy: operatorSnapshot(operatorProfile), voidReason: reason.trim() };
    if (target.type === "sample" && event.type === "analysis" && event.payload?.sampleId === target.payload?.sampleId) return { ...event, status: "voided", voidedAt: recordedAt, voidedBy: operatorSnapshot(operatorProfile), voidReason: reason.trim() };
    return event;
  });
  const entry = correctionEntry("record_voided", { kind: "event", id: target.id }, reason, operatorProfile, recordedAt);
  return projectCorrectedHeat(appendCorrection({ ...heat, events, samples, actualEndpointAnalysisId }, entry));
}

export function correctAnalysisRecord(heat, analysisId, changes, reason, operatorProfile, recordedAt = new Date().toISOString()) {
  const match = findAnalysisResult(heat, analysisId);
  if (!match || !isActive(match.analysis)) throw new Error("analysis_not_correctable");
  const candidate = {
    ...structuredClone(changes),
    occurredAt: changes.occurredAt ?? match.analysis.occurredAt,
    values: { ...structuredClone(match.analysis.values ?? {}), ...structuredClone(changes.values ?? {}) },
    processSnapshot: { ...structuredClone(match.analysis.processSnapshot ?? {}), ...structuredClone(changes.processSnapshot ?? {}) },
    dissolvedOxygen: normalizeDissolvedOxygenRecord(changes.dissolvedOxygen ?? match.analysis.dissolvedOxygen),
  };
  assertCorrectionRequest(heat, { kind: "analysis", type: "analysis", id: analysisId, sampleId: match.sample.id, occurredAt: match.analysis.occurredAt, payload: match.analysis }, "correct", candidate, reason, recordedAt);
  const replacementId = id("AN");
  const replacement = {
    ...structuredClone(match.analysis),
    ...structuredClone(changes),
    id: replacementId,
    sampleId: match.sample.id,
    status: "active",
    correctionOf: analysisId,
    occurredAt: candidate.occurredAt,
    recordedAt,
    recordedBy: operatorSnapshot(operatorProfile),
    values: candidate.values,
    processSnapshot: candidate.processSnapshot,
    dissolvedOxygen: candidate.dissolvedOxygen,
  };
  const wasAdopted = match.sample.adopted && match.sample.adoptedAnalysisId === analysisId;
  const samples = heat.samples.map((sample) => sample.id !== match.sample.id ? sample : syncSampleAnalysisProjection({
    ...sample,
    analysisResults: getAnalysisResults(sample).map((analysis) => analysis.id === analysisId ? { ...analysis, status: "superseded", supersededBy: replacementId } : analysis).concat(replacement),
  }, wasAdopted ? replacementId : sample.adoptedAnalysisId));
  const originalEvent = (heat.events ?? []).find((event) => event.analysisId === analysisId);
  const replacementEventId = originalEvent ? id("EV") : null;
  const events = (heat.events ?? []).map((event) => event.analysisId === analysisId ? { ...event, status: "superseded", supersededBy: replacementEventId } : event);
  if (originalEvent) events.push({
    ...originalEvent,
    id: replacementEventId,
    analysisId: replacementId,
    status: "active",
    correctionOf: originalEvent.id,
    occurredAt: replacement.occurredAt,
    recordedAt,
    recordedBy: operatorSnapshot(operatorProfile),
    payload: { ...structuredClone(originalEvent.payload ?? {}), sampleId: match.sample.id, method: replacement.method, values: structuredClone(replacement.values), dissolvedOxygen: structuredClone(replacement.dissolvedOxygen), cumulativeOxygenNm3: replacement.processSnapshot?.cumulativeOxygenNm3, occurredAt: replacement.occurredAt },
    ...summarizeHeatEvent("analysis", { sampleId: match.sample.id }),
  });
  const entry = correctionEntry("analysis_corrected", { kind: "analysis", id: analysisId }, reason, operatorProfile, recordedAt, { replacementId });
  return projectCorrectedHeat(appendCorrection({ ...heat, samples, events, actualEndpointAnalysisId: heat.actualEndpointAnalysisId === analysisId ? replacementId : heat.actualEndpointAnalysisId }, entry));
}

export function invalidateAnalysisRecord(heat, analysisId, reason, operatorProfile, recordedAt = new Date().toISOString()) {
  const match = findAnalysisResult(heat, analysisId);
  if (!match || !isActive(match.analysis)) throw new Error("analysis_not_voidable");
  assertCorrectionRequest(heat, { kind: "analysis", type: "analysis", id: analysisId, sampleId: match.sample.id, occurredAt: match.analysis.occurredAt, payload: match.analysis }, "void", {}, reason, recordedAt);
  const samples = heat.samples.map((sample) => {
    if (sample.id !== match.sample.id) return sample;
    const results = getAnalysisResults(sample).map((analysis) => analysis.id === analysisId ? { ...analysis, status: "voided", voidedAt: recordedAt, voidedBy: operatorSnapshot(operatorProfile), voidReason: reason.trim() } : analysis);
    const fallback = results.filter(isActive).at(-1)?.id ?? null;
    return syncSampleAnalysisProjection({ ...sample, analysisResults: results }, sample.adoptedAnalysisId === analysisId ? fallback : sample.adoptedAnalysisId);
  });
  const events = (heat.events ?? []).map((event) => event.analysisId === analysisId ? { ...event, status: "voided", voidedAt: recordedAt, voidReason: reason.trim() } : event);
  const entry = correctionEntry("analysis_voided", { kind: "analysis", id: analysisId }, reason, operatorProfile, recordedAt);
  return projectCorrectedHeat(appendCorrection({ ...heat, samples, events, actualEndpointAnalysisId: heat.actualEndpointAnalysisId === analysisId ? null : heat.actualEndpointAnalysisId }, entry));
}

export function adoptAnalysisRecord(heat, analysisId, reason, operatorProfile, recordedAt = new Date().toISOString()) {
  const match = findAnalysisResult(heat, analysisId);
  if (!match || !isActive(match.analysis)) throw new Error("analysis_not_adoptable");
  assertCorrectionRequest(heat, { kind: "analysis", type: "analysis", id: analysisId, sampleId: match.sample.id, occurredAt: match.analysis.occurredAt, payload: match.analysis }, "adopt", {}, reason, recordedAt);
  const samples = heat.samples.map((sample) => sample.id === match.sample.id
    ? syncSampleAnalysisProjection({ ...sample, adopted: true }, analysisId)
    : syncSampleAnalysisProjection({ ...sample, adopted: false }, null));
  const entry = correctionEntry("analysis_adopted", { kind: "analysis", id: analysisId }, reason, operatorProfile, recordedAt);
  return projectCorrectedHeat(appendCorrection({ ...heat, samples }, entry));
}

export function setActualEndpointAnalysis(heat, analysisId, reason, operatorProfile, recordedAt = new Date().toISOString()) {
  const match = findAnalysisResult(heat, analysisId);
  if (!match || !isActive(match.analysis)) throw new Error("analysis_not_available");
  assertCorrectionRequest(heat, { kind: "analysis", type: "analysis", id: analysisId, sampleId: match.sample.id, occurredAt: match.analysis.occurredAt, payload: match.analysis }, "actual", {}, reason, recordedAt);
  const entry = correctionEntry("actual_endpoint_selected", { kind: "analysis", id: analysisId }, reason, operatorProfile, recordedAt);
  return appendCorrection({ ...heat, actualEndpointAnalysisId: analysisId }, entry);
}

export function canRollbackLastStage(heat) {
  return !["G0", "G7", "G8"].includes(heat.stage) && ["in_progress"].includes(heat.status);
}

export function rollbackLastStage(heat, reason, operatorProfile, recordedAt = new Date().toISOString()) {
  if (!canRollbackLastStage(heat)) throw new Error("stage_rollback_not_available");
  const stages = activeStageHistory(heat);
  const target = stages.at(-1);
  if (!target?.from) throw new Error("stage_rollback_not_available");
  assertCorrectionRequest(heat, { ...target, kind: "stage", type: "stage" }, "rollback", {}, reason, recordedAt);
  const invalidatedAnalysisIds = new Set();
  const samples = (heat.samples ?? []).map((sample) => {
    if ((sample.status ?? "active") !== "active" || sample.stage !== target.to) return sample;
    getAnalysisResults(sample).forEach((analysis) => invalidatedAnalysisIds.add(analysis.id));
    return {
      ...sample,
      status: "voided",
      adopted: false,
      adoptedAnalysisId: null,
      analysisResults: getAnalysisResults(sample).map((analysis) => ({ ...analysis, status: "voided", voidedAt: recordedAt, voidReason: reason.trim() })),
    };
  });
  const events = (heat.events ?? []).map((event) => isActive(event) && event.stage === target.to
    ? { ...event, status: "voided", voidedAt: recordedAt, voidReason: reason.trim() }
    : event);
  const stageHistory = (heat.stageHistory ?? []).map((entry) => entry.id === target.id
    ? { ...entry, status: "voided", voidedAt: recordedAt, voidReason: reason.trim(), voidedBy: operatorSnapshot(operatorProfile) }
    : entry);
  const entry = correctionEntry("stage_rolled_back", { kind: "stage", id: target.id }, reason, operatorProfile, recordedAt, { from: target.to, to: target.from });
  const actualEndpointAnalysisId = invalidatedAnalysisIds.has(heat.actualEndpointAnalysisId) ? null : heat.actualEndpointAnalysisId;
  return projectCorrectedHeat(appendCorrection({ ...heat, events, samples, stageHistory, actualEndpointAnalysisId }, entry));
}

export function correctTapRecord(heat, occurredAt, reason, operatorProfile, recordedAt = new Date().toISOString()) {
  const tap = [...(heat.events ?? [])].reverse().find((event) => event.type === "tap" && isActive(event));
  const tapStage = [...activeStageHistory(heat)].reverse().find((entry) => entry.from === "G6" && entry.to === "G7");
  if (!tap || !tapStage) throw new Error("tap_record_missing");
  assertCorrectionRequest(heat, { ...tap, kind: "event" }, "tap", { occurredAt }, reason, recordedAt);
  const previous = activeStageHistory(heat).find((entry) => entry.to === "G6");
  const completion = activeStageHistory(heat).find((entry) => entry.to === "G8");
  if (previous && time(occurredAt) < time(previous.occurredAt)) throw new Error("tap_before_g6");
  if (completion && time(occurredAt) > time(completion.occurredAt)) throw new Error("tap_after_g8");
  const replacementEventId = id("EV");
  const replacementStageId = id("STAGE");
  const replacementEvent = {
    ...tap,
    id: replacementEventId,
    status: "active",
    correctionOf: tap.id,
    occurredAt,
    recordedAt,
    recordedBy: operatorSnapshot(operatorProfile),
    payload: { ...tap.payload, occurredAt },
  };
  const replacementStage = {
    ...tapStage,
    id: replacementStageId,
    status: "active",
    correctionOf: tapStage.id,
    occurredAt,
    recordedAt,
    recordedBy: operatorSnapshot(operatorProfile),
  };
  const events = heat.events.map((event) => event.id === tap.id ? { ...event, status: "superseded", supersededBy: replacementEventId } : event).concat(replacementEvent);
  const stageHistory = heat.stageHistory.map((entry) => entry.id === tapStage.id ? { ...entry, status: "superseded", supersededBy: replacementStageId } : entry).concat(replacementStage);
  const correction = correctionEntry("tap_corrected", { kind: "event", id: tap.id }, reason, operatorProfile, recordedAt, { replacementId: replacementEventId });
  return projectCorrectedHeat(appendCorrection({ ...heat, events, stageHistory }, correction));
}

export function latestActiveTapEvent(heat) {
  return [...(heat.events ?? [])].reverse().find((event) => event.type === "tap" && isActive(event)) ?? null;
}
