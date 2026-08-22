import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { APP_VERSION, BACKUP_SCHEMA_VERSION, createDemoState } from "../src/data/demoState.js";
import { createBackupBlob, restoreBackup } from "../src/reports/backup.js";

describe("backup package", () => {
  it("uses the v0.2 backup schema while the app advances to v0.2.1", () => {
    expect(APP_VERSION).toBe("0.2.1");
    expect(BACKUP_SCHEMA_VERSION).toBe("0.2.0");
    expect(createDemoState().schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
  });

  it("creates the required CSV package and restores the same heat data", async () => {
    const source = createDemoState();
    source.heats[0].samples[0].analyzedAt = "2026-08-22T01:05:00.000Z";
    source.heats[0].samples[0].analysisProcessSnapshot = { cumulativeOxygenNm3: 4100 };
    source.operationLog.push({ id: "LOG-BACKUP-TEST", type: "backup_exported", at: new Date().toISOString(), filename: "test.zip" });
    const blob = await createBackupBlob(source);
    const archive = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(archive);
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(["manifest.csv", "heats.csv", "events.csv", "samples.csv", "analysis_results.csv", "analysis_values.csv", "reference_values.csv", "operation_log.csv"]));
    const restored = await restoreBackup(archive);
    expect(restored.heats).toHaveLength(source.heats.length);
    expect(restored.heats[0].id).toBe(source.heats[0].id);
    expect(restored.heats[0].samples.at(-1).values.C).toBe(0.074);
    expect(restored.settings.coefficientProfiles[0].formulaVersion).toBe("BOF-REF-CALC 0.2.0");
    expect(restored.settings.coefficientProfiles[0].literatureValues.postCombustionRatioBase).toBe(0.15);
    expect(restored.heats[0].samples.at(-1).processSnapshot.cumulativeOxygenNm3).toBe(12970);
    expect(restored.operationLog.some((entry) => entry.type === "backup_exported")).toBe(true);
    expect(restored.heats[0].stageHistory).toHaveLength(source.heats[0].stageHistory.length);
    expect(restored.operatorProfile).toEqual(source.operatorProfile);
    expect(restored.heats[0].samples[0].analyzedAt).toBe("2026-08-22T01:05:00.000Z");
    expect(restored.heats[0].samples[0].analysisProcessSnapshot.cumulativeOxygenNm3).toBe(4100);
  });

  it("continues to restore a v0.1 manifest and migrates it to the current schema", async () => {
    const source = createDemoState();
    source.schemaVersion = "0.1.0";
    const blob = await createBackupBlob(source);
    const restored = await restoreBackup(await blob.arrayBuffer());
    expect(restored.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(restored.heats[0].id).toBe(source.heats[0].id);
  });

  it("rejects a backup with an unsupported manifest schema", async () => {
    const blob = await createBackupBlob(createDemoState());
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const manifest = await zip.file("manifest.csv").async("text");
    zip.file("manifest.csv", manifest.replaceAll(BACKUP_SCHEMA_VERSION, "9.9.9"));
    const tampered = await zip.generateAsync({ type: "arraybuffer" });
    await expect(restoreBackup(tampered)).rejects.toThrow("unsupported_schema_version");
  });

  it("rejects a backup whose coefficient settings are invalid", async () => {
    const source = createDemoState();
    source.settings.coefficientProfiles[0].overrideValues.oxygenPurityFraction = 1.5;
    const blob = await createBackupBlob(source);
    await expect(restoreBackup(await blob.arrayBuffer())).rejects.toThrow("settings_integrity_failed");
  });
});
