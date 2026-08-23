import { describe, expect, it } from "vitest";
import { createDemoState } from "../src/data/demoState.js";
import { canonicalStringify, sha256Hex } from "../src/reports/canonicalJson.js";
import { createJsonBackup, parseJsonBackup } from "../src/reports/jsonBackup.js";
import { makeRecoveryPoint } from "../src/storage/recoveryStore.js";

async function resign(envelope) {
  const content = structuredClone(envelope);
  delete content.integrity;
  return JSON.stringify({
    ...content,
    integrity: {
      algorithm: "SHA-256",
      canonicalization: "sorted-json-v1",
      contentSha256: await sha256Hex(canonicalStringify(content)),
    },
  });
}

describe("canonical JSON backup", () => {
  it("round-trips the whole workspace and recovery points with a verified hash", async () => {
    const state = createDemoState({ displayName: "JSON 검증자" });
    state.trainingRuns.push({ id: "RUN-001", runSha256: "b".repeat(64), datasetSha256: "a".repeat(64), status: "current", createdAt: "2026-08-23T00:00:00.000Z", groupKey: "DEMO|BOF|FORMULA|COEF|DEMO", element: "C", usedRowIds: [], usedHeatIds: [], excludedHeats: [] });
    const recoveryPoint = makeRecoveryPoint(state, {
      id: "REC-001",
      reason: "manual",
      labelKo: "검증 복구점",
      createdAt: "2026-08-23T01:02:03.000Z",
    });

    const created = await createJsonBackup(state, [recoveryPoint], {
      createdAt: "2026-08-23T02:03:04.000Z",
      exportId: "EXP-001",
    });
    const restored = await parseJsonBackup(created.blob);

    expect(created.filename).toMatch(/^BOF_Coach_Backup_\d{4}-\d{2}-\d{2}_\d{4}\.json$/);
    expect(restored.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(restored.state.operatorProfile.displayName).toBe("JSON 검증자");
    expect(restored.state.heats).toHaveLength(2);
    expect(restored.state.trainingRuns[0].id).toBe("RUN-001");
    expect(restored.recoveryPoints[0].id).toBe("REC-001");
    expect(restored.preview.summary.heatCount).toBe(2);
  });

  it("rejects content tampering before applying any state", async () => {
    const created = await createJsonBackup(createDemoState(), [], { exportId: "EXP-TAMPER" });
    const envelope = JSON.parse(await created.blob.text());
    envelope.payload.workspace.operatorProfile.displayName = "위조";
    await expect(parseJsonBackup(JSON.stringify(envelope))).rejects.toThrow("json_hash_mismatch");
  });

  it("rejects a false summary even when the file is re-signed", async () => {
    const created = await createJsonBackup(createDemoState(), [], { exportId: "EXP-SUMMARY" });
    const envelope = JSON.parse(await created.blob.text());
    envelope.summary.heatCount = 999;
    await expect(parseJsonBackup(await resign(envelope))).rejects.toThrow("json_summary_mismatch:heatCount");
  });

  it("rejects unsupported schemas and dangerous property names", async () => {
    const created = await createJsonBackup(createDemoState(), [], { exportId: "EXP-SCHEMA" });
    const schemaEnvelope = JSON.parse(await created.blob.text());
    schemaEnvelope.schemaVersion = "9.9.9";
    await expect(parseJsonBackup(await resign(schemaEnvelope))).rejects.toThrow("unsupported_json_schema_version");

    const dangerousEnvelope = JSON.parse(await created.blob.text());
    Object.defineProperty(dangerousEnvelope.payload.workspace.heats[0].events[0], "__proto__", { value: { polluted: true }, enumerable: true });
    await expect(parseJsonBackup(await resign(dangerousEnvelope))).rejects.toThrow("json_dangerous_key");
  });

  it("rejects semantically invalid settings even when the file is re-signed", async () => {
    const created = await createJsonBackup(createDemoState(), [], { exportId: "EXP-SETTINGS" });
    const envelope = JSON.parse(await created.blob.text());
    envelope.payload.workspace.settings.coefficientProfiles[0].overrideValues.oxygenPurityFraction = 1.5;
    await expect(parseJsonBackup(await resign(envelope))).rejects.toThrow("settings_integrity_failed");
  });

  it("rejects duplicate recovery IDs and mismatched duplicated learning payloads", async () => {
    const state = createDemoState();
    const point = makeRecoveryPoint(state, { id: "REC-DUP" });
    const created = await createJsonBackup(state, [point], { exportId: "EXP-DUP" });
    const duplicateEnvelope = JSON.parse(await created.blob.text());
    duplicateEnvelope.payload.recoveryPoints.push(structuredClone(duplicateEnvelope.payload.recoveryPoints[0]));
    await expect(parseJsonBackup(await resign(duplicateEnvelope))).rejects.toThrow("recovery_point_invalid");

    const mismatchEnvelope = JSON.parse(await created.blob.text());
    mismatchEnvelope.payload.modelRegistry[0].status = "tampered-but-resigned";
    await expect(parseJsonBackup(await resign(mismatchEnvelope))).rejects.toThrow("json_payload_consistency_failed");
  });

  it("rejects invalid operation logs even when the file is re-signed", async () => {
    const created = await createJsonBackup(createDemoState(), [], { exportId: "EXP-LOG" });
    const envelope = JSON.parse(await created.blob.text());
    envelope.payload.workspace.operationLog[0].at = "not-a-date";
    await expect(parseJsonBackup(await resign(envelope))).rejects.toThrow("operation_log_integrity_failed");
  });

  it("rejects inputs larger than the configured 50 MiB safety limit", async () => {
    await expect(parseJsonBackup({ size: 50 * 1024 * 1024 + 1, text: async () => "{}" })).rejects.toThrow("json_backup_too_large");
  });

  it("keeps an invalid legacy recovery point local but does not let it block a valid workspace backup", async () => {
    const state = createDemoState();
    const invalid = makeRecoveryPoint(state, { id: "REC-INVALID-LEGACY" });
    invalid.state.heats[0].stageHistory = [];
    const created = await createJsonBackup(state, [invalid], { exportId: "EXP-QUARANTINE" });
    expect(created.preview.summary.recoveryPointCount).toBe(0);
    expect(created.preview.recoveryPointWarnings).toHaveLength(1);
    expect(created.preview.recoveryPointWarnings[0]).toMatchObject({ id: "REC-INVALID-LEGACY", createdAt: invalid.createdAt, reason: "manual", stateIncluded: false });
    expect(created.preview.recoveryPointWarnings[0].validationError).toMatch(/_state_integrity_failed$/);
  });

  it("round-trips a 1,000-heat workspace without exceeding the portable JSON limit", async () => {
    const state = createDemoState({ displayName: "대량 검증" });
    const template = state.heats[0];
    state.heats = Array.from({ length: 1000 }, (_, index) => ({
      ...structuredClone(template),
      id: `LOAD-${String(index + 1).padStart(4, "0")}`,
      demo: false,
    }));
    state.currentHeatId = state.heats[0].id;

    const created = await createJsonBackup(state, [], { exportId: "EXP-LOAD-1000" });
    const restored = await parseJsonBackup(created.blob);

    expect(created.blob.size).toBeLessThan(50 * 1024 * 1024);
    expect(restored.state.heats).toHaveLength(1000);
    expect(restored.preview.summary).toMatchObject({ heatCount: 1000, fieldHeatCount: 1000 });
  }, 30000);
});
