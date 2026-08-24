export const DISSOLVED_OXYGEN_STATUS = Object.freeze({
  recorded: "recorded",
  notRecorded: "not_recorded",
});

export const DISSOLVED_OXYGEN_SOURCES = Object.freeze([
  "oxygen_probe",
  "laboratory",
  "other",
]);

export const DISSOLVED_OXYGEN_NOTE_MAX_LENGTH = 200;

function blank(value) {
  return value === "" || value === null || value === undefined;
}

export function createDissolvedOxygenRecord({ valuePpm = "", source = "", note = "" } = {}) {
  if (blank(valuePpm)) {
    return {
      recordStatus: DISSOLVED_OXYGEN_STATUS.notRecorded,
      valuePpm: null,
      source: null,
      note: null,
    };
  }
  return {
    recordStatus: DISSOLVED_OXYGEN_STATUS.recorded,
    valuePpm: Number(valuePpm),
    source: blank(source) ? null : String(source),
    note: blank(note) ? null : String(note).trim() || null,
  };
}

export function normalizeDissolvedOxygenRecord(value) {
  if (!value) return createDissolvedOxygenRecord();
  if (value.recordStatus === DISSOLVED_OXYGEN_STATUS.recorded) return createDissolvedOxygenRecord(value);
  if (value.recordStatus === DISSOLVED_OXYGEN_STATUS.notRecorded && blank(value.valuePpm) && blank(value.source) && blank(value.note)) return createDissolvedOxygenRecord();
  return {
    recordStatus: value.recordStatus,
    valuePpm: blank(value.valuePpm) ? null : Number(value.valuePpm),
    source: blank(value.source) ? null : value.source,
    note: blank(value.note) ? null : String(value.note).trim(),
  };
}

export function dissolvedOxygenValidationReason(value) {
  if (!value) return null;
  if (value.recordStatus === DISSOLVED_OXYGEN_STATUS.notRecorded) {
    return blank(value.valuePpm) && blank(value.source) && blank(value.note) ? null : "dissolved_oxygen_status_invalid";
  }
  if (value.recordStatus !== DISSOLVED_OXYGEN_STATUS.recorded) return "dissolved_oxygen_status_invalid";
  if (!Number.isFinite(Number(value.valuePpm)) || Number(value.valuePpm) < 0) return "dissolved_oxygen_invalid";
  if (value.source !== null && value.source !== undefined && value.source !== "" && !DISSOLVED_OXYGEN_SOURCES.includes(value.source)) return "dissolved_oxygen_source_invalid";
  if (value.note !== null && value.note !== undefined && String(value.note).trim().length > DISSOLVED_OXYGEN_NOTE_MAX_LENGTH) return "dissolved_oxygen_note_too_long";
  return null;
}

export function isDissolvedOxygenRecorded(value) {
  return !dissolvedOxygenValidationReason(value) && value?.recordStatus === DISSOLVED_OXYGEN_STATUS.recorded;
}

export function dissolvedOxygenSourceLabel(source, locale = "ko") {
  const labels = {
    oxygen_probe: ["산소 프로브", "Oxygen probe"],
    laboratory: ["분석실", "Laboratory"],
    other: ["기타", "Other"],
  };
  return labels[source]?.[locale === "ko" ? 0 : 1] ?? (locale === "ko" ? "미상/미입력" : "Unknown / not entered");
}
