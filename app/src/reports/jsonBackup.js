import { APP_VERSION } from "../data/demoState.js";
import { getAnalysisResults } from "../domain/analysisRecords.js";
import { buildResidualLedger } from "../calibration/residualLedger.js";
import { JSON_BACKUP_FORMAT, JSON_BACKUP_MAX_BYTES, JSON_BACKUP_SCHEMA_VERSION, assertSafeJsonTree, validateJsonBackupContent, validatePortableRecoveryPoint } from "../domain/jsonBackupSchema.js";
import { retainRecoveryPoints } from "../storage/recoveryStore.js";
import { canonicalStringify, sha256Hex } from "./canonicalJson.js";
import { buildAdditionEvidenceLedger } from "../calibration/additionEvidence.js";

function workspaceForExport(state) {
  const workspace = structuredClone(state);
  delete workspace.storageRevision;
  delete workspace.lastSavedAt;
  return workspace;
}

export function jsonBackupSummary(state, recoveryPoints = []) {
  const heats = state.heats ?? [];
  return {
    heatCount: heats.length,
    activeHeatCount: heats.filter((heat) => heat.status === "in_progress").length,
    completedHeatCount: heats.filter((heat) => ["tapped", "completed", "archived"].includes(heat.status)).length,
    fieldHeatCount: heats.filter((heat) => !heat.demo).length,
    demoHeatCount: heats.filter((heat) => heat.demo).length,
    eventCount: heats.reduce((count, heat) => count + (heat.events?.length ?? 0), 0),
    sampleCount: heats.reduce((count, heat) => count + (heat.samples?.length ?? 0), 0),
    analysisCount: heats.reduce((count, heat) => count + (heat.samples ?? []).reduce((subtotal, sample) => subtotal + getAnalysisResults(sample).length, 0), 0),
    coefficientVersionCount: (state.settings?.coefficientProfiles ?? []).reduce((count, profile) => count + 1 + (profile.versionHistory?.length ?? 0), 0),
    additionModelVersionCount: (state.settings?.additionModelProfiles ?? []).reduce((count, profile) => count + 1 + (profile.versionHistory?.length ?? 0), 0),
    additionProposalCount: heats.reduce((count, heat) => count + (heat.additionCoach?.proposals?.length ?? 0), 0),
    additionPlanCount: heats.reduce((count, heat) => count + (heat.additionCoach?.operatorPlans?.length ?? 0), 0),
    additionEvidenceCount: buildAdditionEvidenceLedger(state).length,
    residualCount: buildResidualLedger(state).length,
    trainingRunCount: state.trainingRuns?.length ?? 0,
    recoveryPointCount: recoveryPoints.length,
  };
}

export function jsonBackupFilename(at = new Date()) {
  const local = new Date(at.getTime() - at.getTimezoneOffset() * 60000).toISOString();
  return `BOF_Coach_Backup_${local.slice(0, 10)}_${local.slice(11, 16).replace(":", "")}.json`;
}

async function inputText(input) {
  if (typeof input === "string") {
    if (new TextEncoder().encode(input).byteLength > JSON_BACKUP_MAX_BYTES) throw new Error("json_backup_too_large");
    return input;
  }
  if (input?.size > JSON_BACKUP_MAX_BYTES || input?.byteLength > JSON_BACKUP_MAX_BYTES) throw new Error("json_backup_too_large");
  if (typeof input?.text === "function") return input.text();
  if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) return new TextDecoder().decode(input);
  throw new Error("json_backup_input_invalid");
}

export async function createJsonBackup(state, recoveryPoints = [], { createdAt = new Date().toISOString(), exportId = `EXP-${crypto.randomUUID()}` } = {}) {
  const retainedPoints = retainRecoveryPoints(recoveryPoints);
  const recoveryValidation = retainedPoints.map((point) => ({ source: point, result: validatePortableRecoveryPoint(point) }));
  const portablePoints = recoveryValidation.filter((entry) => entry.result.valid).map((entry) => entry.result.point);
  const recoveryPointWarnings = recoveryValidation.filter((entry) => !entry.result.valid).map((entry) => ({ id: entry.source.id, createdAt: entry.source.createdAt, reason: entry.source.reason, validationError: entry.result.error, stateIncluded: false }));
  const workspace = workspaceForExport(state);
  const content = {
    format: JSON_BACKUP_FORMAT,
    schemaVersion: JSON_BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    export: {
      exportId,
      createdAt,
      storageRevision: Number(state.storageRevision ?? 0),
    },
    summary: jsonBackupSummary(workspace, portablePoints),
    payload: {
      workspace,
      recoveryPoints: portablePoints,
      recoveryPointWarnings,
      modelRegistry: structuredClone(workspace.modelRegistry ?? []),
      trainingRuns: structuredClone(workspace.trainingRuns ?? []),
    },
  };
  const contentSha256 = await sha256Hex(canonicalStringify(content));
  const envelope = {
    ...content,
    integrity: {
      algorithm: "SHA-256",
      canonicalization: "sorted-json-v1",
      contentSha256,
    },
  };
  const text = JSON.stringify(envelope, null, 2);
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const verified = await parseJsonBackup(blob);
  return { blob, envelope, filename: jsonBackupFilename(new Date(createdAt)), sha256: contentSha256, preview: verified.preview };
}

export async function parseJsonBackup(input) {
  const text = await inputText(input);
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error("json_backup_parse_failed");
  }
  assertSafeJsonTree(envelope);
  if (envelope.integrity?.algorithm !== "SHA-256" || envelope.integrity?.canonicalization !== "sorted-json-v1" || !/^[a-f0-9]{64}$/i.test(envelope.integrity?.contentSha256 ?? "")) throw new Error("json_integrity_metadata_invalid");
  const content = structuredClone(envelope);
  delete content.integrity;
  const actualHash = await sha256Hex(canonicalStringify(content));
  if (actualHash !== envelope.integrity.contentSha256) throw new Error("json_hash_mismatch");
  const { workspace, recoveryPoints } = validateJsonBackupContent(content);
  const summary = jsonBackupSummary(workspace, recoveryPoints);
  for (const [key, value] of Object.entries(summary)) if (Number(content.summary?.[key]) !== value) throw new Error(`json_summary_mismatch:${key}`);
  return {
    state: workspace,
    recoveryPoints,
    envelope,
    sha256: actualHash,
    preview: {
      filename: null,
      createdAt: content.export.createdAt,
      appVersion: content.appVersion,
      schemaVersion: content.schemaVersion,
      storageRevision: content.export.storageRevision,
      operatorName: workspace.operatorProfile?.displayName ?? "",
      summary,
      sha256: actualHash,
      recoveryPointWarnings: structuredClone(content.payload.recoveryPointWarnings ?? []),
    },
  };
}
