import JSZip from "jszip";
import { encodeCsv, parseCsv } from "../storage/csv.js";
import { BACKUP_SCHEMA_VERSION } from "../data/demoState.js";
import { normalizeCoachState } from "../data/stateMigration.js";
import { validateSettings } from "../domain/settingsValidation.js";

const REQUIRED_FILES = ["heats.csv", "events.csv", "samples.csv", "analysis_results.csv", "analysis_values.csv", "reference_values.csv", "operation_log.csv"];

function json(value) {
  return JSON.stringify(value ?? null);
}

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildCsvFiles(state) {
  const heats = state.heats.map((heat) => ({
    heat_id: heat.id,
    grade_code: heat.gradeCode,
    equipment_profile_id: heat.equipmentProfileId,
    coefficient_profile_id: heat.coefficientProfileId,
    status: heat.status,
    stage: heat.stage,
    stage_label_ko: heat.stageLabelKo,
    stage_label_en: heat.stageLabelEn,
    started_at: heat.startedAt,
    expected_tap_at: heat.expectedTapAt,
    initial_json: json(heat.initial),
    process_json: json(heat.process),
  }));
  const events = state.heats.flatMap((heat) => heat.events.map((event) => ({ heat_id: heat.id, event_id: event.id, type: event.type, occurred_at: event.occurredAt, payload_json: json(event) })));
  const samples = state.heats.flatMap((heat) => heat.samples.map((sample) => ({ heat_id: heat.id, sample_id: sample.id, sampled_at: sample.sampledAt, stage: sample.stage, method: sample.method, adopted: sample.adopted ? "true" : "false", process_snapshot_json: json(sample.processSnapshot) })));
  const analysisResults = state.heats.flatMap((heat) => heat.samples.map((sample) => ({ heat_id: heat.id, analysis_id: `${sample.id}-A1`, sample_id: sample.id, method: sample.method, adopted: sample.adopted ? "true" : "false", recorded_at: sample.sampledAt })));
  const analysisValues = state.heats.flatMap((heat) => heat.samples.flatMap((sample) => Object.entries(sample.values ?? {}).map(([item, value]) => ({ heat_id: heat.id, analysis_id: `${sample.id}-A1`, item, value, unit: item === "temperature" ? "°C" : "%" }))));
  const referenceValues = [
    { scope: "application", key: "locale", value_json: json(state.locale) },
    { scope: "application", key: "currentHeatId", value_json: json(state.currentHeatId) },
    { scope: "settings", key: "all", value_json: json(state.settings) },
    { scope: "application", key: "schemaVersion", value_json: json(state.schemaVersion) },
  ];
  const operationLog = (state.operationLog ?? []).map((entry) => ({ log_id: entry.id, type: entry.type, at: entry.at, payload_json: json(entry) }));
  return {
    "heats.csv": encodeCsv(heats, ["heat_id", "grade_code", "equipment_profile_id", "coefficient_profile_id", "status", "stage", "stage_label_ko", "stage_label_en", "started_at", "expected_tap_at", "initial_json", "process_json"]),
    "events.csv": encodeCsv(events, ["heat_id", "event_id", "type", "occurred_at", "payload_json"]),
    "samples.csv": encodeCsv(samples, ["heat_id", "sample_id", "sampled_at", "stage", "method", "adopted", "process_snapshot_json"]),
    "analysis_results.csv": encodeCsv(analysisResults, ["heat_id", "analysis_id", "sample_id", "method", "adopted", "recorded_at"]),
    "analysis_values.csv": encodeCsv(analysisValues, ["heat_id", "analysis_id", "item", "value", "unit"]),
    "reference_values.csv": encodeCsv(referenceValues, ["scope", "key", "value_json"]),
    "operation_log.csv": encodeCsv(operationLog, ["log_id", "type", "at", "payload_json"]),
  };
}

export async function createBackupBlob(state) {
  const zip = new JSZip();
  const files = buildCsvFiles(state);
  const manifestRows = [];
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
    manifestRows.push({ file_name: name, sha256: await sha256(content), row_count: Math.max(0, content.split("\n").length - 1), schema_version: state.schemaVersion });
  }
  zip.file("manifest.csv", encodeCsv(manifestRows, ["file_name", "sha256", "row_count", "schema_version"]));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export async function restoreBackup(file) {
  const zip = await JSZip.loadAsync(file);
  for (const required of [...REQUIRED_FILES, "manifest.csv"]) {
    if (!zip.file(required)) throw new Error(`missing_file:${required}`);
  }
  const manifest = parseCsv(await zip.file("manifest.csv").async("text"));
  if (manifest.some((entry) => entry.schema_version !== BACKUP_SCHEMA_VERSION)) throw new Error("unsupported_schema_version");
  for (const entry of manifest) {
    const content = await zip.file(entry.file_name).async("text");
    if (await sha256(content) !== entry.sha256) throw new Error(`hash_mismatch:${entry.file_name}`);
  }
  const heatsRows = parseCsv(await zip.file("heats.csv").async("text"));
  const eventRows = parseCsv(await zip.file("events.csv").async("text"));
  const sampleRows = parseCsv(await zip.file("samples.csv").async("text"));
  const analysisValueRows = parseCsv(await zip.file("analysis_values.csv").async("text"));
  const referenceRows = parseCsv(await zip.file("reference_values.csv").async("text"));
  const operationRows = parseCsv(await zip.file("operation_log.csv").async("text"));
  const ref = Object.fromEntries(referenceRows.map((row) => [`${row.scope}:${row.key}`, JSON.parse(row.value_json)]));
  const heats = heatsRows.map((row) => {
    const samples = sampleRows.filter((sample) => sample.heat_id === row.heat_id).map((sample) => {
      const values = Object.fromEntries(analysisValueRows.filter((value) => value.heat_id === row.heat_id && value.analysis_id === `${sample.sample_id}-A1`).map((value) => [value.item, Number(value.value)]));
      return { id: sample.sample_id, sampledAt: sample.sampled_at, stage: sample.stage, method: sample.method, adopted: sample.adopted === "true", values, processSnapshot: sample.process_snapshot_json ? JSON.parse(sample.process_snapshot_json) : null };
    });
    const events = eventRows.filter((event) => event.heat_id === row.heat_id).map((event) => JSON.parse(event.payload_json));
    return {
      id: row.heat_id,
      gradeCode: row.grade_code,
      equipmentProfileId: row.equipment_profile_id,
      coefficientProfileId: row.coefficient_profile_id,
      status: row.status,
      stage: row.stage,
      stageLabelKo: row.stage_label_ko,
      stageLabelEn: row.stage_label_en,
      startedAt: row.started_at,
      expectedTapAt: row.expected_tap_at,
      initial: JSON.parse(row.initial_json),
      process: JSON.parse(row.process_json),
      samples,
      events,
    };
  });
  const restored = {
    schemaVersion: ref["application:schemaVersion"],
    locale: ref["application:locale"],
    currentHeatId: ref["application:currentHeatId"],
    settings: ref["settings:all"],
    heats,
    operationLog: operationRows.map((row) => JSON.parse(row.payload_json)),
    lastSavedAt: null,
  };
  if (restored.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new Error("unsupported_schema_version");
  const gradeCodes = new Set(restored.settings.gradeProfiles.map((item) => item.code));
  const equipmentIds = new Set(restored.settings.equipmentProfiles.map((item) => item.id));
  const coefficientIds = new Set(restored.settings.coefficientProfiles.map((item) => item.id));
  const heatIds = new Set(restored.heats.map((heat) => heat.id));
  const invalidReference = restored.heats.some((heat) => !gradeCodes.has(heat.gradeCode) || !equipmentIds.has(heat.equipmentProfileId) || !coefficientIds.has(heat.coefficientProfileId));
  if (invalidReference || !heatIds.has(restored.currentHeatId)) throw new Error("reference_integrity_failed");
  const normalized = normalizeCoachState(restored);
  if (validateSettings(normalized.settings, "en").length) throw new Error("settings_integrity_failed");
  return normalized;
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
