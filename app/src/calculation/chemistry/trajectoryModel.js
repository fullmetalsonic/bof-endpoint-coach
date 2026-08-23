import { clamp, finite } from "./common.js";

const CURVE_POWER = Object.freeze({ C: 1, temperature: 1, Si: 0.35, P: 0.9, Mn: 0.75, S: 1.4 });

export function oxygenProgress(oxygenNm3, plannedOxygenNm3) {
  if (!finite(oxygenNm3) || !(Number(plannedOxygenNm3) > 0)) return NaN;
  return clamp(Number(oxygenNm3) / Number(plannedOxygenNm3), 0, 1);
}

export function trajectoryValue(initialValue, endpointValue, progress, element) {
  if (![initialValue, endpointValue, progress].every(finite)) return NaN;
  const response = clamp(Number(progress), 0, 1) ** (CURVE_POWER[element] ?? 1);
  return Number(initialValue) + (Number(endpointValue) - Number(initialValue)) * response;
}

export function anchorChemistryPrediction(prediction, actualSampleValue, initialValue, progress) {
  if (!prediction?.available || !finite(actualSampleValue) || !finite(initialValue) || !finite(progress)) return prediction;
  const modeledAtSample = trajectoryValue(initialValue, prediction.value, progress, prediction.element);
  if (!finite(modeledAtSample)) return prediction;
  return {
    ...prediction,
    value: Math.max(0, Number(actualSampleValue) + Number(prediction.value) - modeledAtSample),
    anchored: true,
    rawLiteratureValue: Number(prediction.value),
    modeledAtSample,
    sampleResidual: Number(actualSampleValue) - modeledAtSample,
  };
}
