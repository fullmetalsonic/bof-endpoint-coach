function normalizeCanonical(value, inArray = false) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("json_non_finite_number");
    return value;
  }
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") return inArray ? null : undefined;
  if (Array.isArray(value)) return value.map((item) => normalizeCanonical(item, true));
  if (typeof value?.toJSON === "function") return normalizeCanonical(value.toJSON(), inArray);
  const result = {};
  for (const key of Object.keys(value).sort()) {
    const normalized = normalizeCanonical(value[key], false);
    if (normalized !== undefined) result[key] = normalized;
  }
  return result;
}

export function canonicalStringify(value) {
  return JSON.stringify(normalizeCanonical(value));
}

export async function sha256Hex(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

