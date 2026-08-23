export const RECOVERY_CARD_FIELDS = Object.freeze([
  { key: "C", labelKo: "C", labelEn: "C", unit: "%p", decimals: 5, step: 0.00001, maxAbs: 100 },
  { key: "temperature", labelKo: "온도", labelEn: "Temperature", unit: "°C", decimals: 1, step: 0.1, maxAbs: 500 },
  { key: "P", labelKo: "P", labelEn: "P", unit: "%p", decimals: 5, step: 0.00001, maxAbs: 100 },
  { key: "Mn", labelKo: "Mn", labelEn: "Mn", unit: "%p", decimals: 5, step: 0.00001, maxAbs: 100 },
  { key: "Si", labelKo: "Si", labelEn: "Si", unit: "%p", decimals: 5, step: 0.00001, maxAbs: 100 },
  { key: "S", labelKo: "S", labelEn: "S", unit: "%p", decimals: 5, step: 0.00001, maxAbs: 100 },
]);

export const RECOVERY_CARD_FIELD_KEYS = Object.freeze(RECOVERY_CARD_FIELDS.map((field) => field.key));

export function finiteRecoveryNumber(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}
export function normalizeRecoveryOffsets(offsets = {}) {
  return Object.fromEntries(RECOVERY_CARD_FIELDS.map((field) => [field.key, Number(offsets[field.key] ?? 0)]));
}

export function recoveryOffsetErrors(offsets = {}) {
  const errors = [];
  for (const field of RECOVERY_CARD_FIELDS) {
    const value = offsets[field.key];
    if (!finiteRecoveryNumber(value)) errors.push({ code: "offset_invalid", field: field.key });
    else if (Math.abs(Number(value)) > field.maxAbs) errors.push({ code: "offset_out_of_range", field: field.key });
  }
  return errors;
}

export function formatRecoveryValue(value, key, { signed = false } = {}) {
  const field = RECOVERY_CARD_FIELDS.find((item) => item.key === key);
  if (!field || !finiteRecoveryNumber(value)) return "–";
  const number = Number(value);
  const rendered = number.toFixed(field.decimals);
  return signed && number >= 0 ? `+${rendered}` : rendered;
}
