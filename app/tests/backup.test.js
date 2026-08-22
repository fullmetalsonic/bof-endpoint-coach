import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { APP_VERSION, BACKUP_SCHEMA_VERSION, createDemoState } from "../src/data/demoState.js";
import { createBackupBlob, restoreBackup } from "../src/reports/backup.js";

describe("backup package", () => {
  it("keeps the v0.1 backup schema compatible while the app advances to v0.2", () => {
    expect(APP_VERSION).toBe("0.2.0");
    expect(BACKUP_SCHEMA_VERSION).toBe("0.1.0");
    expect(createDemoState().schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
  });

  it("creates the required CSV package and restores the same heat data", async () => {
    const source = createDemoState();
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
  });

  it("rejects a backup with an unsupported manifest schema", async () => {
    const blob = await createBackupBlob(createDemoState());
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const manifest = await zip.file("manifest.csv").async("text");
    zip.file("manifest.csv", manifest.replaceAll("0.1.0", "9.9.9"));
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
