import { residualGroups } from "./residualLedger.js";

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
}

function median(values) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function trimmedMean(values, trimFraction = 0.1) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * trimFraction);
  const kept = trim > 0 && sorted.length - trim * 2 > 0 ? sorted.slice(trim, sorted.length - trim) : sorted;
  return mean(kept);
}

function metrics(rows, offset = 0) {
  const errors = rows.map((row) => row.actual - (row.predicted + offset));
  return {
    count: rows.length,
    bias: mean(errors),
    mae: mean(errors.map(Math.abs)),
    medianError: median(errors),
  };
}

export function learningStage(count, synthetic = false) {
  if (synthetic) return "synthetic_only";
  if (count < 10) return "ledger_only";
  if (count < 30) return "bias_direction";
  if (count < 50) return "provisional_candidate";
  if (count < 70) return "validation_set_pending";
  return "validation_ready";
}

export function buildCalibrationRecommendations(rows, currentOffsets = {}, currentVersionId = null) {
  return residualGroups(rows).map((group) => {
    const count = group.rows.length;
    const stage = learningStage(count, group.synthetic);
    const validationCount = stage === "validation_ready" ? 20 : 0;
    const trainingRows = validationCount ? group.rows.slice(0, -validationCount) : group.rows;
    const validationRows = validationCount ? group.rows.slice(-validationCount) : [];
    const residuals = trainingRows.map((row) => row.residual);
    const delta = trimmedMean(residuals);
    const versionCurrent = !currentVersionId || group.coefficientVersionId === currentVersionId;
    const groupOffset = group.rows.at(-1)?.calibrationOffset;
    const currentOffset = Number(versionCurrent ? currentOffsets[group.element] ?? 0 : groupOffset ?? 0);
    const candidateOffset = currentOffset + delta;
    const trainingBaseline = metrics(trainingRows);
    const trainingCandidate = metrics(trainingRows, delta);
    const validationBaseline = metrics(validationRows);
    const validationCandidate = metrics(validationRows, delta);
    const validationImproved = validationRows.length === 20
      && validationCandidate.mae < validationBaseline.mae
      && Math.abs(validationCandidate.bias) <= Math.abs(validationBaseline.bias);
    return {
      id: `${group.key}:${count}:${candidateOffset.toFixed(8)}`,
      groupKey: group.groupKey,
      coefficientVersionId: group.coefficientVersionId,
      versionCurrent,
      element: group.element,
      unit: group.unit,
      synthetic: group.synthetic,
      stage,
      count,
      trainingCount: trainingRows.length,
      validationCount: validationRows.length,
      currentOffset,
      recommendedDelta: delta,
      candidateOffset,
      medianResidual: median(residuals),
      trainingBaseline,
      trainingCandidate,
      validationBaseline,
      validationCandidate,
      eligibleForApproval: versionCurrent && !group.synthetic && stage === "validation_ready" && validationImproved,
      reason: group.synthetic
        ? "synthetic_rows_not_field_eligible"
        : !versionCurrent
          ? "historical_coefficient_version"
        : stage !== "validation_ready"
          ? stage
          : validationImproved ? "validation_improved" : "validation_not_improved",
    };
  });
}
