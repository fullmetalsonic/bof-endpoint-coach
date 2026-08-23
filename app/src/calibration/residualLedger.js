import { endpointValidationComparison } from "../domain/predictionHistory.js";

export const CALIBRATION_ELEMENTS = Object.freeze([
  { key: "C", predictionKey: "carbon", unit: "%" },
  { key: "temperature", predictionKey: "temperature", unit: "°C" },
  { key: "P", predictionKey: "phosphorus", unit: "%" },
  { key: "Mn", predictionKey: "manganese", unit: "%" },
  { key: "Si", predictionKey: "silicon", unit: "%" },
  { key: "S", predictionKey: "sulfur", unit: "%" },
]);

function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function groupKey(row) {
  return [
    row.gradeCode,
    row.equipmentProfileId,
    row.formulaVersion,
    row.coefficientVersionId,
    row.synthetic ? "DEMO" : "FIELD",
  ].join("|");
}

export function buildResidualLedger(state) {
  const rows = [];
  for (const heat of state.heats ?? []) {
    if (["cancelled", "in_progress"].includes(heat.status)) continue;
    const comparison = endpointValidationComparison(heat);
    if (!comparison.actual || !comparison.prediction) continue;
    for (const element of CALIBRATION_ELEMENTS) {
      const predicted = comparison.prediction[element.predictionKey];
      const actualValue = comparison.actual.values?.[element.key];
      if (!predicted?.available || !finite(predicted.value) || !finite(actualValue)) continue;
      const row = {
        id: `${heat.id}:${comparison.prediction.id}:${element.key}`,
        heatId: heat.id,
        element: element.key,
        unit: element.unit,
        predicted: Number(predicted.value),
        actual: Number(actualValue),
        residual: Number(actualValue) - Number(predicted.value),
        predictedAt: comparison.prediction.calculatedAt,
        actualAt: comparison.actual.occurredAt,
        gradeCode: heat.gradeCode,
        equipmentProfileId: heat.equipmentProfileId,
        formulaVersion: comparison.prediction.formulaVersion ?? "unknown",
        coefficientId: comparison.prediction.coefficientId ?? heat.coefficientProfileId,
        coefficientVersionId: comparison.prediction.coefficientVersionId ?? "legacy",
        calibrationOffset: Number(predicted.calibrationOffset ?? comparison.prediction.calibrationOffsets?.[element.key] ?? 0),
        referenceMode: heat.referenceSnapshot?.mode ?? (heat.demo ? "demo_snapshot" : "manual_reference"),
        synthetic: Boolean(heat.demo || heat.referenceSnapshot?.mode !== "manual_reference"),
        target: structuredClone(heat.referenceSnapshot?.gradeProfile?.targets?.[element.key] ?? null),
      };
      row.groupKey = groupKey(row);
      rows.push(row);
    }
  }
  return rows.sort((a, b) => new Date(a.actualAt) - new Date(b.actualAt));
}

export function residualGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = `${row.groupKey}|${row.element}`;
    if (!groups.has(key)) groups.set(key, {
      key,
      groupKey: row.groupKey,
      element: row.element,
      unit: row.unit,
      coefficientVersionId: row.coefficientVersionId,
      rows: [],
      synthetic: false,
    });
    const group = groups.get(key);
    group.rows.push(row);
    group.synthetic ||= row.synthetic;
  }
  return [...groups.values()];
}
