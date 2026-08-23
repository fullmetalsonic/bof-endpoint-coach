import { getActiveAnalysisResults } from "../../domain/analysisRecords.js";
import { buildChargeContext } from "./materialInputs.js";
import { oxygenProgress, trajectoryValue } from "./trajectoryModel.js";
import { resolveHeatSettings } from "../../domain/referenceSnapshot.js";

const ITEMS = Object.freeze([
  ["C", "carbon"], ["temperature", "temperature"], ["P", "phosphorus"],
  ["Mn", "manganese"], ["Si", "silicon"], ["S", "sulfur"],
]);

function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

export function calculateSampleResiduals(heat, settings, calculation) {
  const planned = Number(heat.initial?.plannedTotalOxygenNm3);
  if (!(planned > 0)) return [];
  const effectiveSettings = resolveHeatSettings(heat, settings);
  const charge = buildChargeContext(heat, effectiveSettings, calculation.effectiveValues ?? {});
  const initialValues = {
    C: charge.elements.C?.initialPercent,
    temperature: heat.initial?.hotMetalTemperatureC,
    P: charge.elements.P?.initialPercent,
    Mn: charge.elements.Mn?.initialPercent,
    Si: charge.elements.Si?.initialPercent,
    S: charge.elements.S?.initialPercent,
  };
  const rows = [];
  for (const sample of heat.samples ?? []) {
    if ((sample.status ?? "active") !== "active") continue;
    for (const analysis of getActiveAnalysisResults(sample)) {
      const oxygenNm3 = analysis.processSnapshot?.cumulativeOxygenNm3 ?? sample.processSnapshot?.cumulativeOxygenNm3;
      const progress = oxygenProgress(oxygenNm3, planned);
      for (const [key, predictionKey] of ITEMS) {
        const endpoint = calculation[predictionKey];
        const actual = analysis.values?.[key];
        const modeled = trajectoryValue(initialValues[key], endpoint?.rawValue ?? endpoint?.value, progress, key);
        if (![actual, modeled].every(finite)) continue;
        rows.push({
          id: `${sample.id}:${analysis.id}:${key}`,
          sampleId: sample.id,
          analysisId: analysis.id,
          sampledAt: sample.sampledAt,
          analyzedAt: analysis.occurredAt,
          oxygenNm3: Number(oxygenNm3),
          progress,
          element: key,
          actual: Number(actual),
          modeled: Number(modeled),
          residual: Number(actual) - Number(modeled),
          adopted: calculation.sample?.id === sample.id && sample.adoptedAnalysisId === analysis.id,
        });
      }
    }
  }
  return rows.sort((a, b) => new Date(a.analyzedAt) - new Date(b.analyzedAt));
}
