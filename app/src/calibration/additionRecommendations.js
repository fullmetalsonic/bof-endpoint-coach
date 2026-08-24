import { ADDITION_COEFFICIENT_FIELDS } from "../calculation/addition/additionProfile.js";
import { additionEvidenceGroups } from "./additionEvidence.js";
import { learningStage } from "./recommendation.js";

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
}

function trimmedMean(values, fraction = 0.1) {
  if (!values.length) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const trim = Math.floor(sorted.length * fraction);
  return mean(trim && sorted.length - trim * 2 > 0 ? sorted.slice(trim, -trim) : sorted);
}

function metrics(rows, value) {
  const errors = rows.map((row) => Number(row.inferredCorrection) - Number(value));
  return { count: rows.length, bias: mean(errors), mae: mean(errors.map(Math.abs)) };
}

function currentProfiles(settings) {
  return new Map((settings.additionModelProfiles ?? []).map((profile) => [profile.versionId, profile]));
}

export function buildAdditionCorrectionRecommendations(state, evidenceRows) {
  const profiles = currentProfiles(state.settings);
  return additionEvidenceGroups(evidenceRows).map((group) => {
    const count = group.rows.length;
    const stage = learningStage(count, group.synthetic);
    const validationCount = stage === "validation_ready" ? 20 : 0;
    const trainingRows = validationCount ? group.rows.slice(0, -validationCount) : group.rows;
    const validationRows = validationCount ? group.rows.slice(-validationCount) : [];
    const latestRow = group.rows.at(-1);
    const currentProfile = profiles.get(group.profileVersionId);
    const versionCurrent = Boolean(currentProfile);
    const currentValue = Number(versionCurrent ? currentProfile.corrections?.[group.correctionKey] ?? 1 : latestRow.currentCorrection);
    const field = ADDITION_COEFFICIENT_FIELDS.find((item) => item.key === group.correctionKey);
    const rawCandidate = trimmedMean(trainingRows.map((row) => Number(row.inferredCorrection)));
    const candidateValue = Math.max(field?.min ?? -Infinity, Math.min(field?.max ?? Infinity, rawCandidate));
    const trainingBaseline = metrics(trainingRows, currentValue);
    const trainingCandidate = metrics(trainingRows, candidateValue);
    const validationBaseline = metrics(validationRows, currentValue);
    const validationCandidate = metrics(validationRows, candidateValue);
    const dates = new Set(group.rows.map((row) => row.occurredAt.slice(0, 10))).size;
    const operators = new Set(group.rows.map((row) => row.recordedBy).filter((name) => name && name !== "미입력")).size;
    const timingCorrection = group.correctionKey === "timingShiftMinutes";
    const operatingBands = new Set(group.rows.map((row) => {
      if (timingCorrection) return row.operatingBand;
      const ratio = Number(row.actualAmount) / Number(row.recommendedAmount);
      return ratio < 0.9 ? "low" : ratio > 1.1 ? "high" : "middle";
    }).filter(Boolean)).size;
    const distributionReady = dates >= 10 && operators >= 3 && operatingBands >= 3;
    const validationImproved = validationRows.length === 20 && validationCandidate.mae < validationBaseline.mae && Math.abs(validationCandidate.bias) <= Math.abs(validationBaseline.bias);
    return {
      id: `${group.key}:${count}:${candidateValue.toFixed(6)}`,
      groupKey: group.groupKey,
      profileVersionId: group.profileVersionId,
      versionCurrent,
      model: group.model,
      materialCode: group.materialCode,
      correctionKey: group.correctionKey,
      unit: field?.unit ?? "multiplier",
      synthetic: group.synthetic,
      stage,
      count,
      trainingCount: trainingRows.length,
      validationCount: validationRows.length,
      distinctDates: dates,
      distinctOperators: operators,
      distinctAmountBands: timingCorrection ? null : operatingBands,
      distinctTimingBands: timingCorrection ? operatingBands : null,
      distinctOperatingBands: operatingBands,
      bandKind: timingCorrection ? "timing" : "amount",
      currentValue,
      candidateValue,
      recommendedDelta: candidateValue - currentValue,
      trainingBaseline,
      trainingCandidate,
      validationBaseline,
      validationCandidate,
      eligibleForApproval: versionCurrent && !group.synthetic && stage === "validation_ready" && distributionReady && validationImproved,
      reason: group.synthetic ? "synthetic_rows_not_field_eligible"
        : !versionCurrent ? "historical_addition_profile_version"
          : stage !== "validation_ready" ? stage
            : !distributionReady ? "operating_distribution_insufficient"
              : validationImproved ? "validation_improved" : "validation_not_improved",
      usedRowIds: group.rows.map((row) => row.id),
      usedHeatIds: [...new Set(group.rows.map((row) => row.heatId))],
    };
  });
}
