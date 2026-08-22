import { COEFFICIENT_FIELDS } from "../calculation/coefficientProfile.js";

const coefficientFieldKeys = new Set(COEFFICIENT_FIELDS.map((field) => field.key));

function duplicates(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value || seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

export function validateSettings(settings, locale = "ko") {
  const errors = [];
  if (duplicates(settings.gradeProfiles.map((item) => item.code.trim())).length) {
    errors.push(locale === "ko" ? "강종 코드는 비어 있거나 중복될 수 없습니다." : "Grade codes cannot be blank or duplicated.");
  }
  if (duplicates(settings.materials.map((item) => item.code.trim())).length) {
    errors.push(locale === "ko" ? "재료 코드는 비어 있거나 중복될 수 없습니다." : "Material codes cannot be blank or duplicated.");
  }
  if (duplicates(settings.coefficientProfiles.map((item) => item.id.trim())).length) {
    errors.push(locale === "ko" ? "계수 프로필 ID는 비어 있거나 중복될 수 없습니다." : "Coefficient profile IDs cannot be blank or duplicated.");
  }
  settings.gradeProfiles.forEach((grade) => {
    Object.entries(grade.targets).forEach(([key, target]) => {
      if (target.min !== null && target.min !== undefined && target.max !== null && target.max !== undefined && Number(target.min) > Number(target.max)) {
        errors.push(locale === "ko" ? `${grade.code}의 ${key} 최소값이 최대값보다 큽니다.` : `${grade.code} ${key} minimum is greater than its maximum.`);
      }
    });
  });
  settings.coefficientProfiles.forEach((profile) => {
    const values = { ...(profile.literatureValues ?? {}), ...(profile.overrideValues ?? {}) };
    if (Object.values(profile.literatureValues ?? {}).some((value) => !finite(value)) || Object.values(profile.overrideValues ?? {}).some((value) => !finite(value))) {
      errors.push(locale === "ko" ? `${profile.id} 계수에는 유효한 숫자만 입력할 수 있습니다.` : `${profile.id} coefficients must contain valid numbers.`);
    }
    if (Object.keys(profile.overrideValues ?? {}).some((key) => !coefficientFieldKeys.has(key))) {
      errors.push(locale === "ko" ? `${profile.id}에 정의되지 않은 수정 계수가 있습니다.` : `${profile.id} contains an unknown override coefficient.`);
    }
    if (!(Number(values.normalPressureKPa) > 0) || !(Number(values.normalTemperatureC) > -273.15)) {
      errors.push(locale === "ko" ? `${profile.id} 산소 기준 온도·압력을 확인하십시오.` : `Check ${profile.id} oxygen reference temperature and pressure.`);
    }
    const fractionKeys = Object.keys(values).filter((key) => key.includes("Fraction") || key.includes("Ratio") || key === "oxygenPurityFraction");
    if (fractionKeys.some((key) => Number(values[key]) < 0 || Number(values[key]) > 1)) {
      errors.push(locale === "ko" ? `${profile.id} 비율 계수는 0~1 범위여야 합니다.` : `${profile.id} fractional coefficients must be between 0 and 1.`);
    }
    for (const prefix of ["postCombustionRatio", "heatLossFraction", "endpointSlagFeOFraction"]) {
      if (!(Number(values[`${prefix}Low`]) <= Number(values[`${prefix}Base`]) && Number(values[`${prefix}Base`]) <= Number(values[`${prefix}High`]))) {
        errors.push(locale === "ko" ? `${profile.id} ${prefix} 값은 저 ≤ 기준 ≤ 고 순서여야 합니다.` : `${profile.id} ${prefix} must satisfy low ≤ base ≤ high.`);
      }
    }
    if (profile.overrideStatus === "site_approved" && (!profile.approvedBy?.trim() || !profile.approvalReason?.trim() || !profile.approvedAt)) {
      errors.push(locale === "ko" ? `${profile.id} 현장 승인에는 승인자와 승인 근거가 필요합니다.` : `${profile.id} site approval requires an approver and approval basis.`);
    }
  });
  return errors;
}
