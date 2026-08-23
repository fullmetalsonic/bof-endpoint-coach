const RESULT_KEYS = { C: "carbon", temperature: "temperature", P: "phosphorus", Mn: "manganese", Si: "silicon", S: "sulfur" };

function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

export function predictionExplanation({ heat, row, calculation, trainingRuns = [] }) {
  const result = calculation?.[RESULT_KEYS[row.key]] ?? row.prediction;
  if (!result?.available) return {
    available: false,
    reason: result?.reason ?? "prediction_unavailable",
    warnings: [result?.reason ?? "prediction_unavailable"],
  };
  const raw = finite(result.rawValue) ? Number(result.rawValue) : Number(result.value) - Number(result.calibrationOffset ?? 0);
  const calibrationOffset = Number(result.calibrationOffset ?? 0);
  const sampleAdjustment = Number(result.value) - calibrationOffset - raw;
  const groupMode = heat.demo || calculation.referenceMode !== "manual_reference" ? "DEMO" : "FIELD";
  const groupKey = [heat.gradeCode, heat.equipmentProfileId, calculation.formulaVersion, calculation.coefficient?.versionId, groupMode].join("|");
  const currentRun = [...trainingRuns].reverse().find((run) => run.status === "current" && run.groupKey === groupKey && run.element === row.key);
  const sourceStage = calculation.basis?.status === "site_approved" && Math.abs(calibrationOffset) > 0
    ? "field_adjustment_applied"
    : currentRun && !currentRun.synthetic && !["ledger_only", "bias_direction"].includes(currentRun.stage)
      ? "field_candidate_available"
      : "literature_reference";
  const warnings = [];
  if (result.confidence === "low" || result.confidence === "very_low") warnings.push(`confidence_${result.confidence}`);
  if (calculation.assumedInputs?.length) warnings.push("assumed_inputs_used");
  if (!result.inputs?.sampleId) warnings.push("sample_anchor_not_used");
  if (calculation.referenceMode !== "manual_reference") warnings.push("demo_or_reference_profile");
  return {
    available: true,
    element: row.key,
    unit: row.target?.unit ?? (row.key === "temperature" ? "°C" : "%"),
    literatureBase: raw,
    sampleAdjustment,
    sampleId: result.inputs?.sampleId ?? null,
    sampleAt: calculation.sample?.sampledAt ?? null,
    calibrationOffset,
    coefficientVersionId: calculation.coefficient?.versionId ?? null,
    coefficientBasis: calculation.basis?.status ?? "unknown",
    finalValue: Number(result.value),
    range: { low: result.low, high: result.high },
    groupKey,
    currentRun: currentRun ? {
      id: currentRun.id,
      datasetSha256: currentRun.datasetSha256,
      heatCount: currentRun.usedHeatIds?.length ?? 0,
      stage: currentRun.stage,
      validationMae: currentRun.metrics?.validationCandidate?.mae ?? null,
    } : null,
    sourceStage,
    confidence: result.confidence ?? "unknown",
    sourceIds: result.sourceIds ?? [],
    assumptions: result.assumptions ?? [],
    warnings,
    equationVerified: Math.abs(raw + sampleAdjustment + calibrationOffset - Number(result.value)) < 1e-9,
  };
}

export function predictionExplanations(heat, rows, calculation, trainingRuns = []) {
  return Object.fromEntries(rows.map((row) => [row.key, predictionExplanation({ heat, row, calculation, trainingRuns })]));
}
