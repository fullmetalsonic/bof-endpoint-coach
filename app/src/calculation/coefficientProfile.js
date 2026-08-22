export const COEFFICIENT_FIELDS = [
  { key: "normalTemperatureC", labelKo: "산소 기준 온도", labelEn: "Oxygen reference temperature", unit: "°C", step: 0.1, sourceIds: ["S41", "S43"] },
  { key: "normalPressureKPa", labelKo: "산소 기준 압력", labelEn: "Oxygen reference pressure", unit: "kPa", step: 0.001, sourceIds: ["S41", "S43"] },
  { key: "oxygenPurityFraction", labelKo: "산소 순도", labelEn: "Oxygen purity", unit: "fraction", step: 0.001, sourceIds: ["S12"] },
  { key: "postCombustionRatioLow", labelKo: "후연소비 저 시나리오", labelEn: "Post-combustion ratio, low", unit: "fraction", step: 0.001, sourceIds: ["S12"] },
  { key: "postCombustionRatioBase", labelKo: "후연소비 기준 시나리오", labelEn: "Post-combustion ratio, base", unit: "fraction", step: 0.001, sourceIds: ["S12", "S44"] },
  { key: "postCombustionRatioHigh", labelKo: "후연소비 고 시나리오", labelEn: "Post-combustion ratio, high", unit: "fraction", step: 0.001, sourceIds: ["S12"] },
  { key: "heatLossFractionLow", labelKo: "열손실률 저 시나리오", labelEn: "Heat loss fraction, low", unit: "fraction", step: 0.001, sourceIds: ["S12", "S44"] },
  { key: "heatLossFractionBase", labelKo: "열손실률 기준 시나리오", labelEn: "Heat loss fraction, base", unit: "fraction", step: 0.001, sourceIds: ["S44"] },
  { key: "heatLossFractionHigh", labelKo: "열손실률 고 시나리오", labelEn: "Heat loss fraction, high", unit: "fraction", step: 0.001, sourceIds: ["S12", "S44"] },
  { key: "endpointSlagFeOFractionLow", labelKo: "종점 슬래그 FeO 저 시나리오", labelEn: "Endpoint slag FeO, low", unit: "fraction", step: 0.001, sourceIds: ["S15"] },
  { key: "endpointSlagFeOFractionBase", labelKo: "종점 슬래그 FeO 기준 시나리오", labelEn: "Endpoint slag FeO, base", unit: "fraction", step: 0.001, sourceIds: ["S15"] },
  { key: "endpointSlagFeOFractionHigh", labelKo: "종점 슬래그 FeO 고 시나리오", labelEn: "Endpoint slag FeO, high", unit: "fraction", step: 0.001, sourceIds: ["S15"] },
  { key: "defaultHotMetalSiPercent", labelKo: "미입력 용선 Si 참고값", labelEn: "Fallback hot-metal Si", unit: "%", step: 0.001, sourceIds: ["S12"] },
  { key: "defaultHotMetalMnPercent", labelKo: "미입력 용선 Mn 참고값", labelEn: "Fallback hot-metal Mn", unit: "%", step: 0.001, sourceIds: ["S12"] },
  { key: "defaultHotMetalPPercent", labelKo: "미입력 용선 P 참고값", labelEn: "Fallback hot-metal P", unit: "%", step: 0.001, sourceIds: ["S12"] },
  { key: "siliconOxidationFraction", labelKo: "Si 산화 가정", labelEn: "Silicon oxidation assumption", unit: "fraction", step: 0.001, sourceIds: ["S12"] },
  { key: "fluxToSlagFraction", labelKo: "플럭스 슬래그 이행 가정", labelEn: "Flux-to-slag assumption", unit: "fraction", step: 0.001, sourceIds: ["S12"] },
  { key: "slagTemperatureOffsetC", labelKo: "슬래그 온도 차", labelEn: "Slag temperature offset", unit: "°C", step: 1, sourceIds: ["S44"] },
  { key: "offGasTemperatureC", labelKo: "배가스 참고 온도", labelEn: "Reference off-gas temperature", unit: "°C", step: 1, sourceIds: ["S44"] },
];

const COEFFICIENT_FIELD_KEYS = new Set(COEFFICIENT_FIELDS.map((field) => field.key));

export const LITERATURE_VALUES = Object.freeze({
  normalTemperatureC: 0,
  normalPressureKPa: 101.325,
  oxygenPurityFraction: 1,
  postCombustionRatioLow: 0.1,
  postCombustionRatioBase: 0.15,
  postCombustionRatioHigh: 0.22,
  heatLossFractionLow: 0.013,
  heatLossFractionBase: 0.035,
  heatLossFractionHigh: 0.059,
  endpointSlagFeOFractionLow: 0.15,
  endpointSlagFeOFractionBase: 0.2,
  endpointSlagFeOFractionHigh: 0.25,
  defaultHotMetalSiPercent: 0.641,
  defaultHotMetalMnPercent: 0.043,
  defaultHotMetalPPercent: 0.176,
  siliconOxidationFraction: 1,
  fluxToSlagFraction: 1,
  slagTemperatureOffsetC: 100,
  offGasTemperatureC: 1600,
});

export function createLiteratureCoefficientProfile() {
  return {
    id: "COEF-LIT-001",
    nameKo: "공개 문헌 기본 시나리오",
    nameEn: "Public-literature base scenario",
    formulaVersion: "BOF-REF-CALC 0.2.0",
    basis: "literature_scenario",
    sourceIds: ["S12", "S15", "S41", "S43", "S44"],
    literatureValues: { ...LITERATURE_VALUES },
    overrideValues: {},
    overrideStatus: "none",
    approvedBy: "",
    approvalReason: "",
    approvedAt: null,
    modifiedAt: null,
  };
}

function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

export function normalizeCoefficientProfile(profile) {
  const base = createLiteratureCoefficientProfile();
  if (!profile?.literatureValues) {
    return {
      ...base,
      id: profile?.id ?? base.id,
      nameKo: base.nameKo,
      nameEn: base.nameEn,
      legacyProfileArchived: profile ? structuredClone(profile) : null,
    };
  }
  return {
    ...base,
    ...profile,
    literatureValues: { ...base.literatureValues, ...profile.literatureValues },
    overrideValues: Object.fromEntries(Object.entries(profile.overrideValues ?? {}).filter(([key, value]) => COEFFICIENT_FIELD_KEYS.has(key) && finite(value)).map(([key, value]) => [key, Number(value)])),
  };
}

export function resolveCoefficientProfile(profile) {
  const normalized = normalizeCoefficientProfile(profile);
  const effectiveValues = { ...normalized.literatureValues, ...normalized.overrideValues };
  const overrideFields = Object.keys(normalized.overrideValues);
  const status = normalized.overrideStatus === "site_approved" && overrideFields.length
    ? "site_approved"
    : overrideFields.length
      ? "user_modified"
      : "literature_reference";
  return {
    profile: normalized,
    effectiveValues,
    overrideFields,
    status,
    approved: status === "site_approved",
    sourceIds: normalized.sourceIds,
    validationErrors: coefficientValueErrors(effectiveValues),
  };
}

export function coefficientValueErrors(values) {
  const errors = [];
  if (COEFFICIENT_FIELDS.some((field) => !finite(values?.[field.key]))) errors.push("coefficient_value_missing_or_invalid");
  const fractionKeys = Object.keys(values ?? {}).filter((key) => key.includes("Fraction") || key.includes("Ratio") || key === "oxygenPurityFraction");
  if (fractionKeys.some((key) => Number(values[key]) < 0 || Number(values[key]) > 1)) errors.push("coefficient_fraction_out_of_range");
  if (!(Number(values?.normalPressureKPa) > 0) || !(Number(values?.normalTemperatureC) > -273.15)) errors.push("oxygen_reference_condition_invalid");
  for (const prefix of ["postCombustionRatio", "heatLossFraction", "endpointSlagFeOFraction"]) {
    if (!(Number(values?.[`${prefix}Low`]) <= Number(values?.[`${prefix}Base`]) && Number(values?.[`${prefix}Base`]) <= Number(values?.[`${prefix}High`]))) {
      errors.push(`${prefix}_scenario_order_invalid`);
    }
  }
  return errors;
}

export function coefficientBasisLabel(status, locale = "ko") {
  const labels = {
    literature_reference: { ko: "문헌 기본", en: "Literature base" },
    user_modified: { ko: "사용자 수정 · 미승인", en: "User modified · unapproved" },
    site_approved: { ko: "현장 승인값", en: "Site approved" },
    invalid: { ko: "계수 오류", en: "Invalid coefficients" },
  };
  return labels[status]?.[locale] ?? labels.literature_reference[locale];
}
