import { buildResidualLedger, residualGroups } from "./residualLedger.js";
import { buildStateCalibrationRecommendations } from "./stateRecommendations.js";
import { canonicalStringify, sha256Hex } from "../reports/canonicalJson.js";
import { endpointValidationComparison } from "../domain/predictionHistory.js";

function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function stableRow(row) {
  return {
    id: row.id,
    heatId: row.heatId,
    element: row.element,
    predicted: row.predicted,
    actual: row.actual,
    residual: row.residual,
    predictedAt: row.predictedAt,
    actualAt: row.actualAt,
    gradeCode: row.gradeCode,
    equipmentProfileId: row.equipmentProfileId,
    formulaVersion: row.formulaVersion,
    coefficientVersionId: row.coefficientVersionId,
    calibrationOffset: row.calibrationOffset,
    synthetic: row.synthetic,
    target: row.target ?? null,
  };
}

export function learningEligibility(state) {
  return (state.heats ?? []).map((heat) => {
    const reasons = [];
    const comparison = endpointValidationComparison(heat);
    if (heat.demo || heat.referenceSnapshot?.mode !== "manual_reference") reasons.push("synthetic_or_demo");
    if (heat.status === "cancelled") reasons.push("cancelled_heat");
    else if (heat.status === "in_progress") reasons.push("heat_not_completed");
    if (!comparison.prediction) reasons.push("endpoint_prediction_missing");
    if (!comparison.actual) reasons.push("confirmed_endpoint_missing");
    const usableElements = comparison.prediction && comparison.actual
      ? [["C", "carbon"], ["temperature", "temperature"], ["P", "phosphorus"], ["Mn", "manganese"], ["Si", "silicon"], ["S", "sulfur"]]
        .filter(([actualKey, predictionKey]) => comparison.prediction[predictionKey]?.available && finite(comparison.actual.values?.[actualKey]))
        .map(([actualKey]) => actualKey)
      : [];
    if (comparison.prediction && comparison.actual && !usableElements.length) reasons.push("comparable_values_missing");
    return {
      heatId: heat.id,
      eligible: reasons.length === 0,
      reasons,
      usableElements,
      gradeCode: heat.gradeCode,
      equipmentProfileId: heat.equipmentProfileId,
    };
  });
}

export function learningEligibilitySummary(state) {
  const rows = learningEligibility(state);
  const reasonCounts = {};
  rows.forEach((row) => row.reasons.forEach((reason) => { reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1; }));
  return {
    heatCount: rows.length,
    eligibleHeatCount: rows.filter((row) => row.eligible).length,
    excludedHeatCount: rows.filter((row) => !row.eligible).length,
    reasonCounts,
    rows,
  };
}

export async function buildTrainingRuns(state, previousRuns = state.trainingRuns ?? [], { createdAt = new Date().toISOString(), createdBy = state.operatorProfile?.displayName ?? "" } = {}) {
  const ledger = buildResidualLedger(state);
  const groups = residualGroups(ledger);
  const runs = structuredClone(previousRuns ?? []);
  const eligibility = learningEligibilitySummary(state);
  const currentProfiles = new Map((state.settings?.coefficientProfiles ?? []).map((profile) => [profile.versionId, profile]));
  const recommendations = buildStateCalibrationRecommendations(state, ledger);

  for (const recommendation of recommendations) {
    const group = groups.find((entry) => entry.groupKey === recommendation.groupKey && entry.element === recommendation.element);
    if (!group?.rows.length) continue;
    const rows = [...group.rows].sort((a, b) => String(a.id).localeCompare(String(b.id))).map(stableRow);
    const datasetSha256 = await sha256Hex(canonicalStringify(rows));
    const identity = {
      groupKey: recommendation.groupKey,
      element: recommendation.element,
      formulaVersion: group.rows[0].formulaVersion,
      coefficientVersionId: recommendation.coefficientVersionId,
      datasetSha256,
    };
    const runSha256 = await sha256Hex(canonicalStringify(identity));
    const duplicate = runs.find((run) => run.runSha256 === runSha256);
    if (duplicate) {
      duplicate.status = "current";
      continue;
    }
    for (const run of runs) {
      if (run.groupKey === identity.groupKey && run.element === identity.element && run.status === "current") {
        run.status = "stale";
        run.staleAt = createdAt;
        run.staleReason = "dataset_changed";
      }
    }
    const currentProfile = currentProfiles.get(recommendation.coefficientVersionId);
    runs.push({
      id: `TR-${runSha256.slice(0, 16).toUpperCase()}`,
      runSha256,
      datasetSha256,
      status: "current",
      createdAt,
      createdBy,
      groupKey: identity.groupKey,
      element: identity.element,
      unit: recommendation.unit,
      formulaVersion: identity.formulaVersion,
      modelId: currentProfile?.formulaVersion ?? identity.formulaVersion,
      coefficientVersionId: identity.coefficientVersionId,
      synthetic: recommendation.synthetic,
      stage: recommendation.stage,
      usedRowIds: rows.map((row) => row.id),
      usedHeatIds: [...new Set(rows.map((row) => row.heatId))],
      excludedHeats: eligibility.rows.filter((row) => !row.eligible).map((row) => ({ heatId: row.heatId, reasons: row.reasons })),
      dataPeriod: { from: group.rows[0].actualAt, to: group.rows.at(-1).actualAt },
      split: { trainingCount: recommendation.trainingCount, validationCount: recommendation.validationCount, holdoutPolicy: recommendation.validationCount ? "latest_20" : "none" },
      metrics: {
        trainingBaseline: recommendation.trainingBaseline,
        trainingCandidate: recommendation.trainingCandidate,
        validationBaseline: recommendation.validationBaseline,
        validationCandidate: recommendation.validationCandidate,
      },
      currentOffset: recommendation.currentOffset,
      recommendedDelta: recommendation.recommendedDelta,
      candidateOffset: recommendation.candidateOffset,
      eligibleForApproval: recommendation.eligibleForApproval,
      reason: recommendation.reason,
      review: { status: "not_reviewed", reviewedAt: null, reviewedBy: null, reason: "" },
    });
  }
  return runs.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}
