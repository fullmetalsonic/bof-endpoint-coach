import { COEFFICIENT_FIELDS, resolveCoefficientProfile } from "../calculation/coefficientProfile.js";
import { canonicalStringify, sha256Hex } from "../reports/canonicalJson.js";
import { formatRecoveryValue, normalizeRecoveryOffsets, recoveryOffsetErrors } from "./recoveryCardFields.js";

export const RECOVERY_CARD_FORMAT = "BOFRC1";
const CORE_KEYS = Object.freeze(["PROFILE", "COEFVER", "FORMULA", "BASE", "C", "TEMP", "P", "MN", "SI", "S", "CHECK"]);

function requiredText(value, name) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`recovery_${name}_missing`);
  return text;
}

function normalizedCorePayload(input) {
  return {
    cardVersion: RECOVERY_CARD_FORMAT,
    profileId: requiredText(input.profileId, "profile_id"),
    coefficientVersionId: requiredText(input.coefficientVersionId, "coefficient_version"),
    formulaVersion: requiredText(input.formulaVersion, "formula_version"),
    baseFingerprint: requiredText(input.baseFingerprint, "base_fingerprint").toUpperCase(),
    offsets: normalizeRecoveryOffsets(input.offsets),
  };
}

export async function coefficientBaseFingerprint(profile) {
  const resolved = resolveCoefficientProfile(profile);
  const values = Object.fromEntries(COEFFICIENT_FIELDS.map((field) => [field.key, Number(resolved.effectiveValues[field.key])]));
  const digest = await sha256Hex(canonicalStringify({
    profileId: profile.id,
    formulaVersion: profile.formulaVersion,
    effectiveValues: values,
  }));
  return digest.slice(0, 12).toUpperCase();
}

export async function coreRecoveryCheckCode(input) {
  if (recoveryOffsetErrors(input.offsets).length) throw new Error("recovery_offsets_invalid");
  const payload = normalizedCorePayload(input);
  const digest = await sha256Hex(canonicalStringify(payload));
  return digest.slice(0, 8).toUpperCase();
}

function encoded(value) {
  return encodeURIComponent(String(value));
}

export async function encodeCoreRecoveryString(input) {
  const payload = normalizedCorePayload(input);
  const checkCode = await coreRecoveryCheckCode(payload);
  return [
    RECOVERY_CARD_FORMAT,
    `PROFILE=${encoded(payload.profileId)}`,
    `COEFVER=${encoded(payload.coefficientVersionId)}`,
    `FORMULA=${encoded(payload.formulaVersion)}`,
    `BASE=${payload.baseFingerprint}`,
    `C=${formatRecoveryValue(payload.offsets.C, "C", { signed: true })}`,
    `TEMP=${formatRecoveryValue(payload.offsets.temperature, "temperature", { signed: true })}`,
    `P=${formatRecoveryValue(payload.offsets.P, "P", { signed: true })}`,
    `MN=${formatRecoveryValue(payload.offsets.Mn, "Mn", { signed: true })}`,
    `SI=${formatRecoveryValue(payload.offsets.Si, "Si", { signed: true })}`,
    `S=${formatRecoveryValue(payload.offsets.S, "S", { signed: true })}`,
    `CHECK=${checkCode}`,
  ].join("|");
}

function decodeValue(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new Error("recovery_string_encoding_invalid");
  }
}

export function parseCoreRecoveryString(text) {
  const parts = String(text ?? "").trim().split("|");
  if (parts.shift()?.toUpperCase() !== RECOVERY_CARD_FORMAT) throw new Error("recovery_string_format_invalid");
  const values = new Map();
  for (const part of parts) {
    const separator = part.indexOf("=");
    if (separator <= 0) throw new Error("recovery_string_segment_invalid");
    const key = part.slice(0, separator).trim().toUpperCase();
    if (!CORE_KEYS.includes(key)) throw new Error(`recovery_string_unknown_key:${key}`);
    if (values.has(key)) throw new Error(`recovery_string_duplicate_key:${key}`);
    values.set(key, decodeValue(part.slice(separator + 1).trim()));
  }
  for (const key of CORE_KEYS) if (!values.has(key) || !String(values.get(key)).trim()) throw new Error(`recovery_string_missing_key:${key}`);
  const payload = normalizedCorePayload({
    profileId: values.get("PROFILE"),
    coefficientVersionId: values.get("COEFVER"),
    formulaVersion: values.get("FORMULA"),
    baseFingerprint: values.get("BASE"),
    offsets: {
      C: values.get("C"), temperature: values.get("TEMP"), P: values.get("P"),
      Mn: values.get("MN"), Si: values.get("SI"), S: values.get("S"),
    },
  });
  if (recoveryOffsetErrors(payload.offsets).length) throw new Error("recovery_offsets_invalid");
  return { ...payload, checkCode: values.get("CHECK").toUpperCase() };
}

export async function verifyCoreRecoveryPayload(input) {
  if (recoveryOffsetErrors(input.offsets).length) throw new Error("recovery_offsets_invalid");
  const payload = normalizedCorePayload(input);
  const checkCode = requiredText(input.checkCode, "check_code").toUpperCase();
  const expected = await coreRecoveryCheckCode(payload);
  if (checkCode !== expected) throw new Error("recovery_check_code_mismatch");
  return { ...payload, checkCode };
}
