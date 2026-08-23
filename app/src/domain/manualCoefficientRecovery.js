import { coefficientBaseFingerprint, verifyCoreRecoveryPayload } from "../calibration/recoveryCardCodec.js";
import { RECOVERY_CARD_FIELDS, finiteRecoveryNumber, recoveryOffsetErrors } from "../calibration/recoveryCardFields.js";

function detailValue(row, key) {
  return row?.[key] === "" || row?.[key] === null || row?.[key] === undefined ? null : Number(row[key]);
}
export function validateRecoveryLearningDetails(rows = []) {
  const errors = [];
  const values = [];
  for (const field of RECOVERY_CARD_FIELDS) {
    const row = rows.find((item) => item.element === field.key) ?? {};
    const raw = [row.currentOffset, row.recommendedDelta, row.candidateOffset];
    const entered = raw.some((value) => value !== "" && value !== null && value !== undefined);
    if (!entered) continue;
    if (!raw.every(finiteRecoveryNumber)) {
      errors.push({ code: "detail_incomplete", field: field.key });
      continue;
    }
    const currentOffset = detailValue(row, "currentOffset");
    const recommendedDelta = detailValue(row, "recommendedDelta");
    const candidateOffset = detailValue(row, "candidateOffset");
    const tolerance = 10 ** -(field.decimals + 1);
    if (Math.abs(currentOffset + recommendedDelta - candidateOffset) > tolerance) {
      errors.push({ code: "detail_equation_mismatch", field: field.key });
      continue;
    }
    if (recoveryOffsetErrors({
      C: field.key === "C" ? candidateOffset : 0,
      temperature: field.key === "temperature" ? candidateOffset : 0,
      P: field.key === "P" ? candidateOffset : 0,
      Mn: field.key === "Mn" ? candidateOffset : 0,
      Si: field.key === "Si" ? candidateOffset : 0,
      S: field.key === "S" ? candidateOffset : 0,
    }).some((error) => error.field === field.key)) {
      errors.push({ code: "detail_out_of_range", field: field.key });
      continue;
    }
    values.push({ element: field.key, unit: field.unit, currentOffset, recommendedDelta, candidateOffset });
  }
  return { errors, values };
}

export async function validateManualCoefficientRecovery({ targetProfile, coreInput, detailRows = [], operatorName = "", reason = "" }) {
  const errors = [];
  let verified = null;
  try {
    verified = await verifyCoreRecoveryPayload(coreInput);
  } catch (error) {
    errors.push({ code: error?.message ?? "recovery_core_invalid" });
  }
  if (recoveryOffsetErrors(coreInput.offsets).length) errors.push({ code: "recovery_offsets_invalid" });
  if (!targetProfile) errors.push({ code: "target_profile_missing" });
  if (targetProfile && verified) {
    const currentFingerprint = await coefficientBaseFingerprint(targetProfile);
    if (verified.profileId !== targetProfile.id) errors.push({ code: "profile_id_mismatch" });
    if (verified.formulaVersion !== targetProfile.formulaVersion) errors.push({ code: "formula_version_mismatch" });
    if (verified.baseFingerprint !== currentFingerprint) errors.push({ code: "base_fingerprint_mismatch" });
  }
  if (!String(operatorName ?? "").trim()) errors.push({ code: "operator_missing" });
  if (String(reason ?? "").trim().length < 3) errors.push({ code: "reason_too_short" });
  const details = validateRecoveryLearningDetails(detailRows);
  errors.push(...details.errors);
  if (errors.length || !verified || !targetProfile) return { valid: false, errors, verified, details: details.values, comparison: [] };
  return {
    valid: true,
    errors: [],
    verified,
    details: details.values,
    comparison: RECOVERY_CARD_FIELDS.map((field) => ({
      ...field,
      current: Number(targetProfile.calibrationOffsets?.[field.key] ?? 0),
      recovered: Number(verified.offsets[field.key]),
      delta: Number(verified.offsets[field.key]) - Number(targetProfile.calibrationOffsets?.[field.key] ?? 0),
    })),
  };
}

export function buildManualRecoveryProfile(targetProfile, validation, { operatorName, reason, enteredAt = new Date().toISOString() }) {
  if (!validation?.valid) throw new Error("manual_recovery_not_validated");
  return {
    ...structuredClone(targetProfile),
    calibrationOffsets: structuredClone(validation.verified.offsets),
    manualRecoverySource: {
      cardVersion: validation.verified.cardVersion,
      enteredAt,
      enteredBy: String(operatorName).trim(),
      reason: String(reason).trim(),
      sourceProfileId: validation.verified.profileId,
      sourceCoefficientVersionId: validation.verified.coefficientVersionId,
      formulaVersion: validation.verified.formulaVersion,
      baseFingerprint: validation.verified.baseFingerprint,
      coreCheckCode: validation.verified.checkCode,
      coreOffsets: structuredClone(validation.verified.offsets),
      referenceLearningValues: structuredClone(validation.details),
      evidenceRestored: false,
    },
    modifiedAt: enteredAt,
  };
}
