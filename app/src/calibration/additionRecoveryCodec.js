import { ADDITION_COEFFICIENT_FIELDS, resolveAdditionProfile } from "../calculation/addition/additionProfile.js";
import { canonicalStringify, sha256Hex } from "../reports/canonicalJson.js";

export const ADDITION_RECOVERY_FORMAT = "BOFARC1";
const FIELD_CODES = Object.freeze({ fluxAmountMultiplier: "FLUX", coolantAmountMultiplier: "COOL", alloyAmountMultiplier: "ALLOY", oxygenAmountMultiplier: "OXY", timingShiftMinutes: "TIME", effectMultiplier: "EFFECT" });
const CODE_FIELDS = Object.freeze(Object.fromEntries(Object.entries(FIELD_CODES).map(([key, value]) => [value, key])));
const REQUIRED_CODES = Object.freeze(["PROFILE", "ADDVER", "FORMULA", "BASE", ...Object.values(FIELD_CODES), "CHECK"]);

function requiredText(value, name) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`addition_recovery_${name}_missing`);
  return result;
}

export function normalizeAdditionCorrections(corrections = {}) {
  return Object.fromEntries(ADDITION_COEFFICIENT_FIELDS.map((field) => [field.key, Number(corrections[field.key])]));
}

export function additionCorrectionErrors(corrections = {}) {
  const values = normalizeAdditionCorrections(corrections);
  return ADDITION_COEFFICIENT_FIELDS.filter((field) => !Number.isFinite(values[field.key]) || values[field.key] < field.min || values[field.key] > field.max).map((field) => field.key);
}

function corePayload(input) {
  const payload = {
    cardVersion: ADDITION_RECOVERY_FORMAT,
    profileId: requiredText(input.profileId, "profile"),
    profileVersionId: requiredText(input.profileVersionId, "version"),
    formulaVersion: requiredText(input.formulaVersion, "formula"),
    baseFingerprint: requiredText(input.baseFingerprint, "base").toUpperCase(),
    corrections: normalizeAdditionCorrections(input.corrections),
  };
  if (additionCorrectionErrors(payload.corrections).length) throw new Error("addition_recovery_values_invalid");
  return payload;
}

export async function additionBaseFingerprint(profile) {
  const resolved = resolveAdditionProfile(profile);
  const digest = await sha256Hex(canonicalStringify({ profileId: profile.id, formulaVersion: profile.formulaVersion, literatureValues: resolved.values }));
  return digest.slice(0, 12).toUpperCase();
}

export async function additionRecoveryCheckCode(input) {
  const digest = await sha256Hex(canonicalStringify(corePayload(input)));
  return digest.slice(0, 8).toUpperCase();
}

export async function encodeAdditionRecoveryString(input) {
  const payload = corePayload(input);
  const check = await additionRecoveryCheckCode(payload);
  return [
    ADDITION_RECOVERY_FORMAT,
    `PROFILE=${encodeURIComponent(payload.profileId)}`,
    `ADDVER=${encodeURIComponent(payload.profileVersionId)}`,
    `FORMULA=${encodeURIComponent(payload.formulaVersion)}`,
    `BASE=${payload.baseFingerprint}`,
    ...Object.entries(FIELD_CODES).map(([field, code]) => `${code}=${Number(payload.corrections[field]).toFixed(field === "timingShiftMinutes" ? 2 : 4)}`),
    `CHECK=${check}`,
  ].join("|");
}

export function parseAdditionRecoveryString(text) {
  const parts = String(text ?? "").trim().split("|");
  if (parts.shift()?.toUpperCase() !== ADDITION_RECOVERY_FORMAT) throw new Error("addition_recovery_format_invalid");
  const values = new Map();
  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator <= 0) throw new Error("addition_recovery_segment_invalid");
    const key = part.slice(0, separator).trim().toUpperCase();
    if (!REQUIRED_CODES.includes(key) || values.has(key)) throw new Error("addition_recovery_key_invalid");
    try { values.set(key, decodeURIComponent(part.slice(separator + 1).trim())); } catch { throw new Error("addition_recovery_encoding_invalid"); }
  }
  for (const key of REQUIRED_CODES) if (!values.get(key)?.trim()) throw new Error(`addition_recovery_missing:${key}`);
  return {
    ...corePayload({
      profileId: values.get("PROFILE"), profileVersionId: values.get("ADDVER"), formulaVersion: values.get("FORMULA"), baseFingerprint: values.get("BASE"),
      corrections: Object.fromEntries(Object.entries(CODE_FIELDS).map(([code, field]) => [field, values.get(code)])),
    }),
    checkCode: values.get("CHECK").toUpperCase(),
  };
}

export async function verifyAdditionRecoveryPayload(input) {
  const payload = corePayload(input);
  const checkCode = requiredText(input.checkCode, "check").toUpperCase();
  if (await additionRecoveryCheckCode(payload) !== checkCode) throw new Error("addition_recovery_check_mismatch");
  return { ...payload, checkCode };
}
