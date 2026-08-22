const MASS_TO_KG = {
  kg: 1,
  t: 1000,
  g: 0.001,
};

export function convertMassToKg(value, unit) {
  const numeric = Number(value);
  const factor = MASS_TO_KG[unit];
  if (!Number.isFinite(numeric) || numeric < 0 || !factor) return NaN;
  return numeric * factor;
}

export function isSupportedMassUnit(unit) {
  return Object.hasOwn(MASS_TO_KG, unit);
}

export const massUnits = Object.freeze(Object.keys(MASS_TO_KG));
