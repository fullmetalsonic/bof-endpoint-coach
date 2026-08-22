import { calculateEndpoint } from "../calculation/endpoint.js";
import { findAnalysisResult } from "./analysisRecords.js";

function predictionValue(result) {
  return result?.available ? {
    available: true,
    value: Number(result.value),
    low: Number(result.low),
    high: Number(result.high),
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
    sampleId: calculation.sample?.id ?? null,
    formulaVersion: calculation.formulaVersion ?? null,
    coefficientId: calculation.coefficient?.id ?? null,
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
  const difference = (item) => prediction?.[item]?.available && Number.isFinite(Number(actual?.values?.[item === "temperature" ? "temperature" : "C"]))
    ? Number(actual.values[item === "temperature" ? "temperature" : "C"]) - Number(prediction[item].value)
    : null;
  return {
    prediction,
    actual,
    sampleId: actualMatch?.sample?.id ?? null,
    carbonError: difference("carbon"),
    temperatureError: difference("temperature"),
  };
}
