import JSZip from "jszip";
import { encodeCsv, parseCsv } from "../storage/csv.js";
import { BACKUP_SCHEMA_VERSION, SUPPORTED_BACKUP_SCHEMA_VERSIONS } from "../data/demoState.js";
import { normalizeCoachState } from "../data/stateMigration.js";
import { validateSettings } from "../domain/settingsValidation.js";
import { validateOperationalState } from "../domain/stateIntegrity.js";
import { getAnalysisResults, normalizeSampleAnalyses } from "../domain/analysisRecords.js";
import { buildResidualLedger } from "../calibration/residualLedger.js";

const BASE_REQUIRED_FILES = ["heats.csv", "events.csv", "samples.csv", "analysis_results.csv", "analysis_values.csv", "reference_values.csv", "operation_log.csv"];
const V040_REQUIRED_FILES = [...BASE_REQUIRED_FILES, "coefficient_versions.csv", "calibration_residuals.csv"];

function requiredFilesForSchema(schemaVersion) {
  return schemaVersion === "0.4.0" ? V040_REQUIRED_FILES : BASE_REQUIRED_FILES;
}

function csvRowCount(content) {
  return Math.max(0, content.split("\n").length - 1);
}

function validateManifest(manifest) {
  const names = manifest.map((entry) => entry.file_name);
  if (manifest.some((entry) => !SUPPORTED_BACKUP_SCHEMA_VERSIONS.includes(entry.schema_version))) throw new Error("unsupported_schema_version");
  const schemas = [...new Set(manifest.map((entry) => entry.schema_version))];
  if (schemas.length !== 1) throw new Error("manifest_schema_mismatch");
  const required = requiredFilesForSchema(schemas[0]);
  if (manifest.length !== required.length || new Set(names).size !== names.length || required.some((name) => !names.includes(name))) throw new Error("manifest_file_set_invalid");
  if (manifest.some((entry) => !/^[a-f0-9]{64}$/i.test(entry.sha256) || !/^\d+$/.test(entry.row_count))) throw new Error("manifest_entry_invalid");
  return schemas[0];
}

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
    demo: heat.demo ? "true" : "false",
    initial_json: json(heat.initial),
    process_json: json(heat.process),
    stage_history_json: json(heat.stageHistory ?? []),
    correction_base_json: json(heat.correctionBase ?? null),
    reference_snapshot_json: json(heat.referenceSnapshot ?? null),
    prediction_snapshots_json: json(heat.predictionSnapshots ?? []),
    correction_log_json: json(heat.correctionLog ?? []),
    actual_endpoint_analysis_id: heat.actualEndpointAnalysisId ?? "",
    lifecycle_json: json({ tappedAt: heat.tappedAt ?? null, completedAt: heat.completedAt ?? null, cancelledAt: heat.cancelledAt ?? null, cancellationReason: heat.cancellationReason ?? null, archivedAt: heat.archivedAt ?? null, lifecycleRecordedBy: heat.lifecycleRecordedBy ?? null }),
  }));
  const events = state.heats.flatMap((heat) => heat.events.map((event) => ({ heat_id: heat.id, event_id: event.id, type: event.type, occurred_at: event.occurredAt, payload_json: json(event) })));
  const samples = state.heats.flatMap((heat) => heat.samples.map((sample) => ({ heat_id: heat.id, sample_id: sample.id, status: sample.status ?? "active", sampled_at: sample.sampledAt, recorded_at: sample.recordedAt ?? sample.sampledAt, recorded_by_json: json(sample.recordedBy ?? null), stage: sample.stage, adopted: sample.adopted ? "true" : "false", adopted_analysis_id: sample.adoptedAnalysisId ?? "", process_snapshot_json: json(sample.processSnapshot) })));
  const analysisResults = state.heats.flatMap((heat) => heat.samples.flatMap((sample) => getAnalysisResults(sample).map((analysis) => ({ heat_id: heat.id, analysis_id: analysis.id, sample_id: sample.id, status: analysis.status ?? "active", method: analysis.method, occurred_at: analysis.occurredAt, recorded_at: analysis.recordedAt ?? analysis.occurredAt, recorded_by_json: json(analysis.recordedBy ?? null), correction_of: analysis.correctionOf ?? "", process_snapshot_json: json(analysis.processSnapshot) }))));
  const analysisValues = state.heats.flatMap((heat) => heat.samples.flatMap((sample) => getAnalysisResults(sample).flatMap((analysis) => Object.entries(analysis.values ?? {}).map(([item, value]) => ({ heat_id: heat.id, analysis_id: analysis.id, item, value, unit: item === "temperature" ? "°C" : "%" })))));
  const referenceValues = [
    { scope: "application", key: "locale", value_json: json(state.locale) },
    { scope: "application", key: "currentHeatId", value_json: json(state.currentHeatId) },
    { scope: "settings", key: "all", value_json: json(state.settings) },
    { scope: "application", key: "schemaVersion", value_json: json(state.schemaVersion) },
    { scope: "application", key: "operatorProfile", value_json: json(state.operatorProfile ?? { displayName: "" }) },
    { scope: "application", key: "onboardingCompleted", value_json: json(state.onboardingCompleted ?? true) },
  ];
  const operationLog = (state.operationLog ?? []).map((entry) => ({ log_id: entry.id, type: entry.type, at: entry.at, payload_json: json(entry) }));
  const coefficientVersions = (state.settings.coefficientProfiles ?? []).flatMap((profile) => [
    { coefficient_id: profile.id, version_id: profile.versionId ?? "legacy", parent_version_id: profile.parentVersionId ?? "", created_at: profile.createdAt ?? "", status: "current", profile_json: json(Object.fromEntries(Object.entries(profile).filter(([key]) => key !== "versionHistory"))) },
    ...(profile.versionHistory ?? []).map((version) => ({ coefficient_id: profile.id, version_id: version.versionId, parent_version_id: version.profile?.parentVersionId ?? "", created_at: version.profile?.createdAt ?? "", status: "archived", archived_at: version.archivedAt, archived_by: version.archivedBy, change_reason: version.changeReason, profile_json: json(version.profile) })),
  ]);
  const residuals = buildResidualLedger(state).map((row) => ({
    residual_id: row.id, heat_id: row.heatId, element: row.element, unit: row.unit, predicted: row.predicted, actual: row.actual, residual: row.residual, predicted_at: row.predictedAt, actual_at: row.actualAt, grade_code: row.gradeCode, equipment_profile_id: row.equipmentProfileId, formula_version: row.formulaVersion, coefficient_id: row.coefficientId, coefficient_version_id: row.coefficientVersionId, reference_mode: row.referenceMode, synthetic: row.synthetic ? "true" : "false",
  }));
  return {
    "heats.csv": encodeCsv(heats, ["heat_id", "grade_code", "equipment_profile_id", "coefficient_profile_id", "status", "stage", "stage_label_ko", "stage_label_en", "started_at", "expected_tap_at", "demo", "initial_json", "process_json", "stage_history_json", "correction_base_json", "reference_snapshot_json", "prediction_snapshots_json", "correction_log_json", "actual_endpoint_analysis_id", "lifecycle_json"]),
    "events.csv": encodeCsv(events, ["heat_id", "event_id", "type", "occurred_at", "payload_json"]),
    "samples.csv": encodeCsv(samples, ["heat_id", "sample_id", "status", "sampled_at", "recorded_at", "recorded_by_json", "stage", "adopted", "adopted_analysis_id", "process_snapshot_json"]),
    "analysis_results.csv": encodeCsv(analysisResults, ["heat_id", "analysis_id", "sample_id", "status", "method", "occurred_at", "recorded_at", "recorded_by_json", "correction_of", "process_snapshot_json"]),
    "analysis_values.csv": encodeCsv(analysisValues, ["heat_id", "analysis_id", "item", "value", "unit"]),
    "reference_values.csv": encodeCsv(referenceValues, ["scope", "key", "value_json"]),
    "operation_log.csv": encodeCsv(operationLog, ["log_id", "type", "at", "payload_json"]),
    "coefficient_versions.csv": encodeCsv(coefficientVersions, ["coefficient_id", "version_id", "parent_version_id", "created_at", "status", "archived_at", "archived_by", "change_reason", "profile_json"]),
    "calibration_residuals.csv": encodeCsv(residuals, ["residual_id", "heat_id", "element", "unit", "predicted", "actual", "residual", "predicted_at", "actual_at", "grade_code", "equipment_profile_id", "formula_version", "coefficient_id", "coefficient_version_id", "reference_mode", "synthetic"]),
  };
}

export async function createBackupBlob(state) {
  const zip = new JSZip();
  const files = buildCsvFiles(state);
  const manifestRows = [];
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
    manifestRows.push({ file_name: name, sha256: await sha256(content), row_count: csvRowCount(content), schema_version: state.schemaVersion });
  }
  zip.file("manifest.csv", encodeCsv(manifestRows, ["file_name", "sha256", "row_count", "schema_version"]));
  return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}

export async function restoreBackup(file) {
  const zip = await JSZip.loadAsync(file);
  if (!zip.file("manifest.csv")) throw new Error("missing_file:manifest.csv");
  const manifest = parseCsv(await zip.file("manifest.csv").async("text"));
  const schemaVersion = validateManifest(manifest);
  for (const required of requiredFilesForSchema(schemaVersion)) if (!zip.file(required)) throw new Error(`missing_file:${required}`);
  for (const entry of manifest) {
    const fileEntry = zip.file(entry.file_name);
    if (!fileEntry) throw new Error(`missing_file:${entry.file_name}`);
    const content = await fileEntry.async("text");
    if (await sha256(content) !== entry.sha256) throw new Error(`hash_mismatch:${entry.file_name}`);
    if (csvRowCount(content) !== Number(entry.row_count)) throw new Error(`row_count_mismatch:${entry.file_name}`);
  }
  const heatsRows = parseCsv(await zip.file("heats.csv").async("text"));
  const eventRows = parseCsv(await zip.file("events.csv").async("text"));
  const sampleRows = parseCsv(await zip.file("samples.csv").async("text"));
  const analysisResultRows = parseCsv(await zip.file("analysis_results.csv").async("text"));
  const analysisValueRows = parseCsv(await zip.file("analysis_values.csv").async("text"));
  const referenceRows = parseCsv(await zip.file("reference_values.csv").async("text"));
  const operationRows = parseCsv(await zip.file("operation_log.csv").async("text"));
  const ref = Object.fromEntries(referenceRows.map((row) => [`${row.scope}:${row.key}`, JSON.parse(row.value_json)]));
  const heats = heatsRows.map((row) => {
    const samples = sampleRows.filter((sample) => sample.heat_id === row.heat_id).map((sample) => {
      const rows = analysisResultRows.filter((analysis) => analysis.heat_id === row.heat_id && analysis.sample_id === sample.sample_id);
      const analysisResults = rows.map((analysis) => ({
        id: analysis.analysis_id,
        sampleId: sample.sample_id,
        status: analysis.status || "active",
        method: analysis.method || "OES",
        occurredAt: analysis.occurred_at || analysis.recorded_at || sample.analyzed_at || sample.sampled_at,
        recordedAt: analysis.recorded_at || analysis.occurred_at || sample.analyzed_at || sample.sampled_at,
        recordedBy: analysis.recorded_by_json ? JSON.parse(analysis.recorded_by_json) : { displayName: "미입력" },
        correctionOf: analysis.correction_of || undefined,
        processSnapshot: analysis.process_snapshot_json ? JSON.parse(analysis.process_snapshot_json) : (sample.analysis_process_snapshot_json ? JSON.parse(sample.analysis_process_snapshot_json) : undefined),
        values: Object.fromEntries(analysisValueRows.filter((value) => value.heat_id === row.heat_id && value.analysis_id === analysis.analysis_id).map((value) => [value.item, Number(value.value)])),
      }));
      const adoptedAnalysisId = sample.adopted_analysis_id || (sample.adopted === "true" ? analysisResults.at(-1)?.id : null) || null;
      return normalizeSampleAnalyses({ id: sample.sample_id, status: sample.status || "active", sampledAt: sample.sampled_at, recordedAt: sample.recorded_at || sample.sampled_at, recordedBy: sample.recorded_by_json ? JSON.parse(sample.recorded_by_json) : { displayName: "미입력" }, stage: sample.stage, adopted: sample.adopted === "true", adoptedAnalysisId, analysisResults, processSnapshot: sample.process_snapshot_json ? JSON.parse(sample.process_snapshot_json) : null });
    });
    const events = eventRows.filter((event) => event.heat_id === row.heat_id).map((event) => JSON.parse(event.payload_json));
    const lifecycle = row.lifecycle_json ? JSON.parse(row.lifecycle_json) : {};
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
      demo: row.demo === undefined || row.demo === "" ? undefined : row.demo === "true",
      initial: JSON.parse(row.initial_json),
      process: JSON.parse(row.process_json),
      stageHistory: row.stage_history_json ? JSON.parse(row.stage_history_json) : [],
      correctionBase: row.correction_base_json ? JSON.parse(row.correction_base_json) : undefined,
      referenceSnapshot: row.reference_snapshot_json ? JSON.parse(row.reference_snapshot_json) : undefined,
      predictionSnapshots: row.prediction_snapshots_json ? JSON.parse(row.prediction_snapshots_json) : [],
      correctionLog: row.correction_log_json ? JSON.parse(row.correction_log_json) : [],
      actualEndpointAnalysisId: row.actual_endpoint_analysis_id || null,
      samples,
      events,
      ...Object.fromEntries(Object.entries(lifecycle).filter(([, value]) => value !== null)),
    };
  });
  const restored = {
    schemaVersion: ref["application:schemaVersion"],
    locale: ref["application:locale"],
    currentHeatId: ref["application:currentHeatId"],
    operatorProfile: ref["application:operatorProfile"] ?? { displayName: "" },
    onboardingCompleted: ref["application:onboardingCompleted"] ?? true,
    settings: ref["settings:all"],
    heats,
    operationLog: operationRows.map((row) => JSON.parse(row.payload_json)),
    lastSavedAt: null,
  };
  if (!SUPPORTED_BACKUP_SCHEMA_VERSIONS.includes(restored.schemaVersion)) throw new Error("unsupported_schema_version");
  const gradeCodes = new Set(restored.settings.gradeProfiles.map((item) => item.code));
  const equipmentIds = new Set(restored.settings.equipmentProfiles.map((item) => item.id));
  const coefficientIds = new Set(restored.settings.coefficientProfiles.map((item) => item.id));
  const heatIds = new Set(restored.heats.map((heat) => heat.id));
  const invalidReference = restored.heats.some((heat) => !gradeCodes.has(heat.gradeCode) || !equipmentIds.has(heat.equipmentProfileId) || !coefficientIds.has(heat.coefficientProfileId));
  const invalidCurrentHeat = restored.heats.length > 0 ? !heatIds.has(restored.currentHeatId) : restored.currentHeatId !== null;
  if (invalidReference || invalidCurrentHeat) throw new Error("reference_integrity_failed");
  const normalized = normalizeCoachState(restored);
  const operationalError = validateOperationalState(normalized);
  if (operationalError) throw new Error(operationalError);
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
