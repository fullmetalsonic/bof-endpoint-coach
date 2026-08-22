function duplicates(values) {
  const seen = new Set();
  return values.filter((value) => {
    if (!value || seen.has(value)) return true;
    seen.add(value);
    return false;
  });
}

export function validateSettings(settings, locale = "ko") {
  const errors = [];
  if (duplicates(settings.gradeProfiles.map((item) => item.code.trim())).length) {
    errors.push(locale === "ko" ? "강종 코드는 비어 있거나 중복될 수 없습니다." : "Grade codes cannot be blank or duplicated.");
  }
  if (duplicates(settings.materials.map((item) => item.code.trim())).length) {
    errors.push(locale === "ko" ? "재료 코드는 비어 있거나 중복될 수 없습니다." : "Material codes cannot be blank or duplicated.");
  }
  settings.gradeProfiles.forEach((grade) => {
    Object.entries(grade.targets).forEach(([key, target]) => {
      if (target.min !== null && target.min !== undefined && target.max !== null && target.max !== undefined && Number(target.min) > Number(target.max)) {
        errors.push(locale === "ko" ? `${grade.code}의 ${key} 최소값이 최대값보다 큽니다.` : `${grade.code} ${key} minimum is greater than its maximum.`);
      }
    });
  });
  return errors;
}
