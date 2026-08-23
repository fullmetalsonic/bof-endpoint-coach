export const ELEMENT_KEYS = Object.freeze(["C", "temperature", "P", "Mn", "Si", "S"]);

export function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function unavailable(reason, extra = {}) {
  return { available: false, reason, ...extra };
}

export function available(value, extra = {}) {
  return finite(value) ? { available: true, value: Number(value), ...extra } : unavailable("non_finite_result", extra);
}

export function percentMass(massKg, totalKg) {
  return finite(massKg) && Number(totalKg) > 0 ? 100 * Number(massKg) / Number(totalKg) : NaN;
}

export function scenarioSuffix(name) {
  return name === "low" ? "Low" : name === "high" ? "High" : "Base";
}
