import { calculateEndpoint } from "../calculation/endpoint.js";
import { findAnalysisResult } from "./analysisRecords.js";

function predictionValue(result) {
  const optionalNumber = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
  return result?.available ? {
    available: true,
    value: Number(result.value),
    low: optionalNumber(result.low),
    high: optionalNumber(result.high),
    rawValue: optionalNumber(result.rawValue),
    calibrationOffset: Number(result.calibrationOffset ?? 0),
    mode: result.mode ?? null,
    confidence: result.confidence ?? null,
    sourceIds: structuredClone(result.sourceIds ?? []),
  } : { available: false, reason: result?.reason ?? "unavailable" };
}

export function capturePredictionSnapshot(heat, settings, trigger, calculatedAt = new Date().toISOString()) {
  const calculation = calculateEndpoint(heat, settings, calculatedAt);
  const snapshot = {
    id: `PRED-${crypto.randomUUID()}`,
    calculatedAt,
    triggerType: trigger.type,
    triggerId: trigger.id ?? null,
    stage: heat.stage,
    carbon: predictionValue(calculation.carbon),
    temperature: predictionValue(calculation.temperature),
    phosphorus: predictionValue(calculation.phosphorus),
    manganese: predictionValue(calculation.manganese),
    silicon: predictionValue(calculation.silicon),
    sulfur: predictionValue(calculation.sulfur),
    sampleId: calculation.sample?.id ?? null,
    formulaVersion: calculation.formulaVersion ?? null,
    coefficientId: calculation.coefficient?.id ?? null,
    coefficientVersionId: calculation.coefficient?.versionId ?? null,
    calibrationOffsets: structuredClone(calculation.coefficient?.calibrationOffsets ?? {}),
    settingsVersion: heat.referenceSnapshot?.settingsVersion ?? settings.version ?? null,
    basisStatus: calculation.basis?.status ?? null,
  };
  return { ...heat, predictionSnapshots: [...(heat.predictionSnapshots ?? []), snapshot] };
}

export function endpointValidationComparison(heat) {
  const actualMatch = heat.actualEndpointAnalysisId ? findAnalysisResult(heat, heat.actualEndpointAnalysisId) : null;
  const actual = actualMatch?.analysis?.status === "active" ? actualMatch.analysis : null;
  const snapshots = heat.predictionSnapshots ?? [];
  const prediction = [...snapshots].reverse().find((item) => ["tap", "tap_correction"].includes(item.triggerType)) ?? snapshots.at(-1) ?? null;
  const sampleKeys = { carbon: "C", temperature: "temperature", phosphorus: "P", manganese: "Mn", silicon: "Si", sulfur: "S" };
  const difference = (item) => prediction?.[item]?.available && Number.isFinite(Number(actual?.values?.[sampleKeys[item]]))
    ? Number(actual.values[sampleKeys[item]]) - Number(prediction[item].value)
    : null;
  const errors = Object.fromEntries(Object.keys(sampleKeys).map((item) => [sampleKeys[item], difference(item)]));
  return {
    prediction,
    actual,
    sampleId: actualMatch?.sample?.id ?? null,
    carbonError: difference("carbon"),
    temperatureError: difference("temperature"),
    phosphorusError: difference("phosphorus"),
    manganeseError: difference("manganese"),
    siliconError: difference("silicon"),
    sulfurError: difference("sulfur"),
    errors,
  };
}
