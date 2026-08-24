export function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

export function unavailable(model, reason, extra = {}) {
  return { model, available: false, reason, confidence: "unavailable", ...extra };
}

export function sortedRange(values) {
  const numbers = values.filter(finite).map(Number).filter((value) => value >= 0).sort((a, b) => a - b);
  return numbers.length ? { low: numbers[0], high: numbers.at(-1), midpoint: (numbers[0] + numbers.at(-1)) / 2 } : null;
}

export function clampRange(range, minimum, maximum) {
  if (!range) return { range: null, conflict: false };
  const low = finite(minimum) ? Math.max(range.low, Number(minimum)) : range.low;
  const high = finite(maximum) ? Math.min(range.high, Number(maximum)) : range.high;
  if (low > high) return { range: null, conflict: true, requested: range, limits: { minimum: finite(minimum) ? Number(minimum) : null, maximum: finite(maximum) ? Number(maximum) : null } };
  return { range: { low, high, midpoint: (low + high) / 2 }, conflict: false };
}

export function confidenceStatus(resolvedProfile, hasFieldLimits = false) {
  if (resolvedProfile.fieldApproved && hasFieldLimits) return "field_approved";
  return "literature_test";
}

export function activeMaterialEvents(heat) {
  return (heat.events ?? []).filter((event) => event.type === "material" && (event.status ?? "active") === "active");
}

export function latestActualAnalysis(heat) {
  return (heat.samples ?? [])
    .filter((sample) => (sample.status ?? "active") === "active" && sample.adopted)
    .sort((a, b) => new Date(a.sampledAt) - new Date(b.sampledAt))
    .at(-1) ?? null;
}

export function targetMidpoint(target) {
  if (!target) return NaN;
  if (finite(target.min) && finite(target.max)) return (Number(target.min) + Number(target.max)) / 2;
  if (finite(target.min)) return Number(target.min);
  if (finite(target.max)) return Number(target.max);
  return NaN;
}
