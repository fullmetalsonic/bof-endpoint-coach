import { validateOperationalState } from "./stateIntegrity.js";
import { validateSettings } from "./settingsValidation.js";
import { normalizeCoachState } from "../data/stateMigration.js";
import { retainRecoveryPoints } from "../storage/recoveryStore.js";
import { canonicalStringify } from "../reports/canonicalJson.js";

export const JSON_BACKUP_FORMAT = "bof-endpoint-coach-backup";
export const JSON_BACKUP_SCHEMA_VERSION = "0.6.0";
export const JSON_BACKUP_MAX_BYTES = 50 * 1024 * 1024;

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function assertSafeJsonTree(value, depth = 0) {
  if (depth > 120) throw new Error("json_nesting_too_deep");
  if (!value || typeof value !== "object") return;
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) throw new Error("json_dangerous_key");
    assertSafeJsonTree(value[key], depth + 1);
  }
}

function assertWorkspace(workspace) {
  const normalized = normalizeCoachState(structuredClone(workspace));
  const operationalError = validateOperationalState(normalized);
  if (operationalError) throw new Error(operationalError);
  if (validateSettings(normalized.settings, "en").length) throw new Error("settings_integrity_failed");
  const logIds = (normalized.operationLog ?? []).map((entry) => entry.id);
  if (new Set(logIds).size !== logIds.length || logIds.some((id) => typeof id !== "string" || !id.trim()) || normalized.operationLog.some((entry) => !Number.isFinite(new Date(entry.at).getTime()))) throw new Error("operation_log_integrity_failed");
  return normalized;
}

export function validatePortableRecoveryPoint(point) {
  try {
    if (!point?.id || !point.reason || !Number.isFinite(new Date(point.createdAt).getTime()) || !point.state) throw new Error("recovery_point_invalid");
    return { valid: true, point: { ...structuredClone(point), state: assertWorkspace(point.state) }, error: null };
  } catch (error) {
    return { valid: false, point: null, error: error?.message ?? "recovery_point_invalid" };
  }
}

function validateModelAndTraining(modelRegistry, trainingRuns) {
  if (!Array.isArray(modelRegistry)) throw new Error("model_registry_invalid");
  if (!Array.isArray(trainingRuns)) throw new Error("training_runs_invalid");
  const modelIds = modelRegistry.map((model) => model.id);
  if (new Set(modelIds).size !== modelIds.length || modelIds.some((id) => typeof id !== "string" || !id.trim())) throw new Error("model_registry_invalid");
  const runIds = trainingRuns.map((run) => run.id);
  if (new Set(runIds).size !== runIds.length) throw new Error("training_runs_invalid");
  for (const run of trainingRuns) {
    if (!run.id || !/^[a-f0-9]{64}$/i.test(run.datasetSha256 ?? "") || !/^[a-f0-9]{64}$/i.test(run.runSha256 ?? "") || !["current", "stale"].includes(run.status) || !Number.isFinite(new Date(run.createdAt).getTime()) || !run.groupKey || !run.element || !Array.isArray(run.usedRowIds) || !Array.isArray(run.usedHeatIds) || !Array.isArray(run.excludedHeats)) throw new Error("training_runs_invalid");
  }
}

export function validateJsonBackupContent(content) {
  if (!content || content.format !== JSON_BACKUP_FORMAT) throw new Error("json_backup_format_invalid");
  if (content.schemaVersion !== JSON_BACKUP_SCHEMA_VERSION) throw new Error("unsupported_json_schema_version");
  if (!content.export?.exportId || !Number.isFinite(new Date(content.export.createdAt).getTime()) || !Number.isInteger(Number(content.export.storageRevision)) || Number(content.export.storageRevision) < 0) throw new Error("json_export_metadata_invalid");
  if (!content.payload?.workspace) throw new Error("json_workspace_missing");
  const workspace = assertWorkspace(content.payload.workspace);
  const sourcePoints = content.payload.recoveryPoints ?? [];
  if (!Array.isArray(sourcePoints) || new Set(sourcePoints.map((point) => point?.id)).size !== sourcePoints.length) throw new Error("recovery_point_invalid");
  const recoveryPoints = retainRecoveryPoints(sourcePoints);
  for (const point of recoveryPoints) {
    const validated = validatePortableRecoveryPoint(point);
    if (!validated.valid) throw new Error(validated.error);
    Object.assign(point, validated.point);
  }
  if (!Array.isArray(content.payload.recoveryPointWarnings ?? [])) throw new Error("recovery_point_warning_invalid");
  const modelRegistry = content.payload.modelRegistry ?? [];
  const trainingRuns = content.payload.trainingRuns ?? [];
  validateModelAndTraining(modelRegistry, trainingRuns);
  if (canonicalStringify(workspace.modelRegistry ?? []) !== canonicalStringify(modelRegistry) || canonicalStringify(workspace.trainingRuns ?? []) !== canonicalStringify(trainingRuns)) throw new Error("json_payload_consistency_failed");
  workspace.modelRegistry = structuredClone(modelRegistry);
  workspace.trainingRuns = structuredClone(trainingRuns);
  return { workspace, recoveryPoints };
}
