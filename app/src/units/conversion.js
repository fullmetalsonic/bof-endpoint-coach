const MASS_TO_KG = {
  kg: 1,
  t: 1000,
  g: 0.001,
};

const CONCENTRATION_TO_PERCENT = {
  "%": 1,
  "wt%": 1,
  ppm: 0.0001,
};

export function convertMassToKg(value, unit) {
  const numeric = Number(value);
  const factor = MASS_TO_KG[unit];
  if (!Number.isFinite(numeric) || numeric < 0 || !factor) return NaN;
  return numeric * factor;
}

export function convertMassFromKg(value, unit) {
  const numeric = Number(value);
  const factor = MASS_TO_KG[unit];
  if (!Number.isFinite(numeric) || numeric < 0 || !factor) return NaN;
  return numeric / factor;
}

export function isSupportedMassUnit(unit) {
  return Object.hasOwn(MASS_TO_KG, unit);
}

export const massUnits = Object.freeze(Object.keys(MASS_TO_KG));

export function convertConcentrationToPercent(value, unit) {
  const numeric = Number(value);
  const factor = CONCENTRATION_TO_PERCENT[unit];
  if (!Number.isFinite(numeric) || numeric < 0 || !factor) return NaN;
  return numeric * factor;
}

export function convertConcentrationFromPercent(value, unit) {
  const numeric = Number(value);
  const factor = CONCENTRATION_TO_PERCENT[unit];
  if (!Number.isFinite(numeric) || numeric < 0 || !factor) return NaN;
  return numeric / factor;
}

export function isSupportedConcentrationUnit(unit) {
  return Object.hasOwn(CONCENTRATION_TO_PERCENT, unit);
}

export const concentrationUnits = Object.freeze(Object.keys(CONCENTRATION_TO_PERCENT));
