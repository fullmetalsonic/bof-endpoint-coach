export const ADDITION_FORMULA_VERSION = "BOF-ADD-REF 0.7.2";

export const ADDITION_COEFFICIENT_FIELDS = Object.freeze([
  { key: "fluxAmountMultiplier", labelKo: "Flux 양 보정", labelEn: "Flux amount correction", unit: "multiplier", min: 0.5, max: 1.5 },
  { key: "coolantAmountMultiplier", labelKo: "냉각재 양 보정", labelEn: "Coolant amount correction", unit: "multiplier", min: 0.5, max: 1.5 },
  { key: "alloyAmountMultiplier", labelKo: "합금·가탄재 양 보정", labelEn: "Alloy/carburizer amount correction", unit: "multiplier", min: 0.5, max: 1.5 },
  { key: "oxygenAmountMultiplier", labelKo: "산소량 보정", labelEn: "Oxygen amount correction", unit: "multiplier", min: 0.5, max: 1.5 },
  { key: "timingShiftMinutes", labelKo: "권장 시점 이동", labelEn: "Timing shift", unit: "min", min: -10, max: 10 },
  { key: "effectMultiplier", labelKo: "예상 효과 보정", labelEn: "Effect correction", unit: "multiplier", min: 0.5, max: 1.5 },
]);

export function additionCoefficientUnitLabel(field, locale) {
  if (field.unit === "multiplier") return locale === "ko" ? "배" : "multiplier";
  if (field.unit === "min") return locale === "ko" ? "분" : "min";
  return field.unit;
}

export const LITERATURE_ADDITION_VALUES = Object.freeze({
  fluxBasicityLow: 2.5,
  fluxBasicityBase: 3,
  fluxBasicityHigh: 3.5,
  scrapCoolingKjPerKg: 1423.0,
  oreScrapEquivalentLow: 2.8,
  oreScrapEquivalentBase: 3.4,
  oreScrapEquivalentHigh: 4,
  alloyRecoveryLow: 0.9,
  alloyRecoveryBase: 0.95,
  alloyRecoveryHigh: 1,
  carburizerRecoveryLow: 0.8,
  carburizerRecoveryBase: 0.9,
  carburizerRecoveryHigh: 1,
  nominalAlloyDissolutionKgPerSecond: 1.5,
  steelHeatCapacityKjPerKgC: 0.823,
});

export const DEFAULT_ADDITION_CORRECTIONS = Object.freeze({
  fluxAmountMultiplier: 1,
  coolantAmountMultiplier: 1,
  alloyAmountMultiplier: 1,
  oxygenAmountMultiplier: 1,
  timingShiftMinutes: 0,
  effectMultiplier: 1,
});

export function createLiteratureAdditionProfile() {
  return {
    id: "ADD-LIT-001",
    versionId: "ADD-LIT-001-V1",
    parentVersionId: null,
    nameKo: "공개 문헌 투입 시험 시나리오",
    nameEn: "Public-literature addition test scenario",
    formulaVersion: ADDITION_FORMULA_VERSION,
    status: "literature_test",
    sourceIds: ["S12", "S48", "S49", "S50", "S51", "S52", "S53", "S54", "S55", "S56"],
    createdAt: "2026-08-24T00:00:00.000Z",
    scope: { gradeCode: "*", equipmentProfileId: "*" },
    literatureValues: { ...LITERATURE_ADDITION_VALUES },
    overrideValues: {},
    corrections: { ...DEFAULT_ADDITION_CORRECTIONS },
    limits: {
      flux: { enabled: true, minKg: null, maxKg: null, allowedStages: ["G0", "G1", "G2", "G3", "G4"] },
      coolant: { enabled: true, minKg: null, maxKg: null, allowedStages: ["G1", "G2", "G3", "G4", "G5"] },
      alloy: { enabled: true, minKg: null, maxKg: null, allowedStages: ["G6", "G7"] },
      carburizer: { enabled: true, minKg: null, maxKg: null, allowedStages: ["G6", "G7"] },
      oxygen: { enabled: true, minNm3: null, maxNm3: null, allowedStages: ["G5", "G6"] },
    },
    materialOverrides: {},
    approval: null,
    versionHistory: [],
  };
}

function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

export function normalizeAdditionProfile(profile) {
  const base = createLiteratureAdditionProfile();
  if (!profile) return base;
  return {
    ...base,
    ...structuredClone(profile),
    scope: { ...base.scope, ...(profile.scope ?? {}) },
    literatureValues: { ...base.literatureValues, ...(profile.literatureValues ?? {}) },
    overrideValues: { ...(profile.overrideValues ?? {}) },
    corrections: { ...base.corrections, ...(profile.corrections ?? {}) },
    limits: Object.fromEntries(Object.entries(base.limits).map(([key, value]) => [key, { ...value, ...(profile.limits?.[key] ?? {}) }])),
    materialOverrides: structuredClone(profile.materialOverrides ?? {}),
    versionHistory: structuredClone(profile.versionHistory ?? []),
  };
}

export function resolveAdditionProfile(profile) {
  const normalized = normalizeAdditionProfile(profile);
  const values = { ...normalized.literatureValues, ...normalized.overrideValues };
  const errors = [];
  for (const field of ADDITION_COEFFICIENT_FIELDS) {
    const value = normalized.corrections[field.key];
    if (!finite(value) || Number(value) < field.min || Number(value) > field.max) errors.push(`addition_correction_invalid:${field.key}`);
  }
  if (!(Number(values.fluxBasicityLow) > 0 && Number(values.fluxBasicityLow) <= Number(values.fluxBasicityBase) && Number(values.fluxBasicityBase) <= Number(values.fluxBasicityHigh))) errors.push("addition_flux_basicity_invalid");
  for (const key of ["scrapCoolingKjPerKg", "nominalAlloyDissolutionKgPerSecond", "steelHeatCapacityKjPerKgC"]) {
    if (!finite(values[key]) || Number(values[key]) <= 0) errors.push(`addition_value_invalid:${key}`);
  }
  if (!(Number(values.oreScrapEquivalentLow) > 0 && Number(values.oreScrapEquivalentLow) <= Number(values.oreScrapEquivalentBase) && Number(values.oreScrapEquivalentBase) <= Number(values.oreScrapEquivalentHigh))) errors.push("addition_ore_equivalent_invalid");
  for (const key of ["alloyRecoveryLow", "alloyRecoveryBase", "alloyRecoveryHigh", "carburizerRecoveryLow", "carburizerRecoveryBase", "carburizerRecoveryHigh"]) {
    if (!finite(values[key]) || Number(values[key]) <= 0 || Number(values[key]) > 1) errors.push(`addition_recovery_invalid:${key}`);
  }
  for (const prefix of ["alloyRecovery", "carburizerRecovery"]) {
    if (!(Number(values[`${prefix}Low`]) <= Number(values[`${prefix}Base`]) && Number(values[`${prefix}Base`]) <= Number(values[`${prefix}High`]))) errors.push(`addition_recovery_order_invalid:${prefix}`);
  }
  for (const [kind, limit] of Object.entries(normalized.limits)) {
    const min = kind === "oxygen" ? limit.minNm3 : limit.minKg;
    const max = kind === "oxygen" ? limit.maxNm3 : limit.maxKg;
    if (min !== null && min !== undefined && (!finite(min) || Number(min) < 0)) errors.push(`addition_limit_invalid:${kind}:min`);
    if (max !== null && max !== undefined && (!finite(max) || Number(max) <= 0)) errors.push(`addition_limit_invalid:${kind}:max`);
    if (finite(min) && finite(max) && Number(min) > Number(max)) errors.push(`addition_limit_order_invalid:${kind}`);
    if (!Array.isArray(limit.allowedStages) || limit.allowedStages.some((stage) => !/^G[0-8]$/.test(stage))) errors.push(`addition_stage_limit_invalid:${kind}`);
  }
  for (const [materialCode, override] of Object.entries(normalized.materialOverrides ?? {})) {
    if (!materialCode.trim() || !override || typeof override !== "object" || Array.isArray(override)) {
      errors.push(`addition_material_override_invalid:${materialCode || "blank"}`);
      continue;
    }
    const cooling = override.coolingKjPerKg;
    if (cooling) {
      const ordered = [cooling.low, cooling.base, cooling.high];
      if (ordered.some((value) => !finite(value) || Number(value) <= 0) || !(Number(ordered[0]) <= Number(ordered[1]) && Number(ordered[1]) <= Number(ordered[2]))) errors.push(`addition_material_cooling_invalid:${materialCode}`);
    }
    const recovery = override.recovery;
    if (recovery) {
      const ordered = [recovery.low, recovery.base, recovery.high];
      if (ordered.some((value) => !finite(value) || Number(value) <= 0 || Number(value) > 1) || !(Number(ordered[0]) <= Number(ordered[1]) && Number(ordered[1]) <= Number(ordered[2]))) errors.push(`addition_material_recovery_invalid:${materialCode}`);
    }
    if (override.dissolutionKgPerSecond !== undefined && (!finite(override.dissolutionKgPerSecond) || Number(override.dissolutionKgPerSecond) <= 0)) errors.push(`addition_material_dissolution_invalid:${materialCode}`);
    for (const key of ["minKg", "maxKg"]) if (override[key] !== undefined && override[key] !== null && (!finite(override[key]) || Number(override[key]) < 0)) errors.push(`addition_material_limit_invalid:${materialCode}:${key}`);
    if (finite(override.minKg) && finite(override.maxKg) && Number(override.minKg) > Number(override.maxKg)) errors.push(`addition_material_limit_order_invalid:${materialCode}`);
  }
  return {
    profile: normalized,
    values,
    corrections: normalized.corrections,
    validationErrors: [...new Set(errors)],
    fieldApproved: normalized.status === "site_approved" && Boolean(normalized.approval?.approvedBy),
  };
}

export function selectAdditionProfile(settings, heat) {
  const profiles = (settings?.additionModelProfiles ?? []).map(normalizeAdditionProfile);
  return profiles
    .filter((profile) => ["*", heat.gradeCode].includes(profile.scope?.gradeCode) && ["*", heat.equipmentProfileId].includes(profile.scope?.equipmentProfileId))
    .sort((a, b) => Number(b.scope.gradeCode === heat.gradeCode) + Number(b.scope.equipmentProfileId === heat.equipmentProfileId) - Number(a.scope.gradeCode === heat.gradeCode) - Number(a.scope.equipmentProfileId === heat.equipmentProfileId))[0]
    ?? profiles[0]
    ?? createLiteratureAdditionProfile();
}

export function materialModelParameters(material, resolvedProfile) {
  const category = material?.category ?? "other";
  const values = resolvedProfile.values;
  const configured = resolvedProfile.profile.materialOverrides?.[material?.code] ?? {};
  const generic = category === "coolant" ? {
    coolingKjPerKg: {
      low: Number(values.scrapCoolingKjPerKg) * Number(values.oreScrapEquivalentLow),
      base: Number(values.scrapCoolingKjPerKg) * Number(values.oreScrapEquivalentBase),
      high: Number(values.scrapCoolingKjPerKg) * Number(values.oreScrapEquivalentHigh),
    },
  } : ["alloy", "carburizer"].includes(category) ? {
    primaryElement: category === "carburizer" ? "C" : null,
    recovery: {
      low: Number(values[category === "carburizer" ? "carburizerRecoveryLow" : "alloyRecoveryLow"]),
      base: Number(values[category === "carburizer" ? "carburizerRecoveryBase" : "alloyRecoveryBase"]),
      high: Number(values[category === "carburizer" ? "carburizerRecoveryHigh" : "alloyRecoveryHigh"]),
    },
    dissolutionKgPerSecond: Number(values.nominalAlloyDissolutionKgPerSecond),
  } : {};
  return {
    ...generic,
    ...structuredClone(configured),
    coolingKjPerKg: { ...(generic.coolingKjPerKg ?? {}), ...(configured.coolingKjPerKg ?? {}) },
    recovery: { ...(generic.recovery ?? {}), ...(configured.recovery ?? {}) },
  };
}
