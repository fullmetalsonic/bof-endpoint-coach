import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createHash } from "node:crypto";
import { APP_VERSION, BACKUP_SCHEMA_VERSION, createDemoState } from "../src/data/demoState.js";
import { createBackupBlob, restoreBackup } from "../src/reports/backup.js";
import { applyHeatEvent } from "../src/domain/heatOperations.js";
import { correctAnalysisRecord, setActualEndpointAnalysis } from "../src/domain/correctionOperations.js";
import { capturePredictionSnapshot } from "../src/domain/predictionHistory.js";

describe("backup package", () => {
  it("uses app v0.6.1 while keeping the offline-learning v0.6.0 backup schema", () => {
    expect(APP_VERSION).toBe("0.6.1");
    expect(BACKUP_SCHEMA_VERSION).toBe("0.6.0");
    expect(createDemoState().schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
  });

  it("creates the required CSV package and restores the same heat data", async () => {
    const source = createDemoState();
    const sourceAnalysis = source.heats[0].samples[0].analysisResults[0];
    sourceAnalysis.occurredAt = new Date(new Date(source.heats[0].samples[0].sampledAt).getTime() + 60_000).toISOString();
    sourceAnalysis.processSnapshot = { cumulativeOxygenNm3: 4100 };
    source.operationLog.push({ id: "LOG-BACKUP-TEST", type: "backup_exported", at: new Date().toISOString(), filename: "test.zip" });
    const blob = await createBackupBlob(source);
    const archive = await blob.arrayBuffer();
    const zip = await JSZip.loadAsync(archive);
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining(["manifest.csv", "heats.csv", "events.csv", "samples.csv", "analysis_results.csv", "analysis_values.csv", "reference_values.csv", "operation_log.csv", "coefficient_versions.csv", "calibration_residuals.csv"]));
    const restored = await restoreBackup(archive);
    expect(restored.heats).toHaveLength(source.heats.length);
    expect(restored.heats[0].id).toBe(source.heats[0].id);
    expect(restored.heats[0].samples.at(-1).values.C).toBe(0.074);
    expect(restored.settings.coefficientProfiles[0].formulaVersion).toBe("BOF-REF-CALC 0.3.0");
    expect(restored.settings.coefficientProfiles[0].literatureValues.postCombustionRatioBase).toBe(0.15);
    expect(restored.heats[0].samples.at(-1).processSnapshot.cumulativeOxygenNm3).toBe(12970);
    expect(restored.operationLog.some((entry) => entry.type === "backup_exported")).toBe(true);
    expect(restored.heats[0].stageHistory).toHaveLength(source.heats[0].stageHistory.length);
    expect(restored.operatorProfile).toEqual(source.operatorProfile);
    expect(restored.heats[0].samples[0].analysisResults[0].occurredAt).toBe(sourceAnalysis.occurredAt);
    expect(restored.heats[0].samples[0].analysisResults[0].processSnapshot.cumulativeOxygenNm3).toBe(4100);
  });

  it("continues to restore a v0.1 manifest and migrates it to the current schema", async () => {
    const source = createDemoState();
    source.schemaVersion = "0.1.0";
    const blob = await createBackupBlob(source);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    zip.remove("coefficient_versions.csv");
    zip.remove("calibration_residuals.csv");
    const manifest = await zip.file("manifest.csv").async("text");
    zip.file("manifest.csv", manifest.split("\n").filter((line) => !line.startsWith("coefficient_versions.csv,") && !line.startsWith("calibration_residuals.csv,")).join("\n"));
    const restored = await restoreBackup(await zip.generateAsync({ type: "arraybuffer" }));
    expect(restored.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(restored.heats[0].id).toBe(source.heats[0].id);
  });

  it("round-trips correction links, prediction snapshots, frozen settings, and the selected actual endpoint", async () => {
    const source = createDemoState({ displayName: "백업 검증자" });
    const analysisId = source.heats[0].samples.at(-1).analysisResults[0].id;
    let heat = correctAnalysisRecord(source.heats[0], analysisId, { values: { C: 0.071 } }, "백업 정정 검증", source.operatorProfile);
    heat = capturePredictionSnapshot(heat, source.settings, { type: "correction", id: heat.correctionLog.at(-1).id });
    heat = applyHeatEvent(heat, "tap", { occurredAt: new Date().toISOString(), note: "" }, source.operatorProfile);
    heat = capturePredictionSnapshot(heat, source.settings, { type: "tap", id: heat.events.at(-1).id });
    heat = setActualEndpointAnalysis(heat, heat.samples.at(-1).adoptedAnalysisId, "출강 후 확정", source.operatorProfile);
    source.heats[0] = heat;

    const restored = await restoreBackup(await (await createBackupBlob(source)).arrayBuffer());
    const restoredHeat = restored.heats[0];
    expect(restoredHeat.correctionLog.map((entry) => entry.type)).toEqual(["analysis_corrected", "actual_endpoint_selected"]);
    expect(restoredHeat.samples.at(-1).analysisResults.map((analysis) => analysis.status)).toEqual(["superseded", "active"]);
    expect(restoredHeat.predictionSnapshots).toHaveLength(2);
    expect(restoredHeat.actualEndpointAnalysisId).toBe(restoredHeat.samples.at(-1).adoptedAnalysisId);
    expect(restoredHeat.referenceSnapshot.coefficientProfile.id).toBe("COEF-LIT-001");
  });

  it("rejects a backup with an unsupported manifest schema", async () => {
    const blob = await createBackupBlob(createDemoState());
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const manifest = await zip.file("manifest.csv").async("text");
    zip.file("manifest.csv", manifest.replaceAll(BACKUP_SCHEMA_VERSION, "9.9.9"));
    const tampered = await zip.generateAsync({ type: "arraybuffer" });
    await expect(restoreBackup(tampered)).rejects.toThrow("unsupported_schema_version");
  });

  it("rejects a manifest that omits a required CSV from hashing", async () => {
    const blob = await createBackupBlob(createDemoState());
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const manifest = await zip.file("manifest.csv").async("text");
    zip.file("manifest.csv", manifest.split("\n").filter((line) => !line.startsWith("heats.csv,")).join("\n"));
    const tampered = await zip.generateAsync({ type: "arraybuffer" });
    await expect(restoreBackup(tampered)).rejects.toThrow("manifest_file_set_invalid");
  });

  it("rejects content changes and false row counts", async () => {
    const blob = await createBackupBlob(createDemoState());
    const hashZip = await JSZip.loadAsync(await blob.arrayBuffer());
    hashZip.file("heats.csv", `${await hashZip.file("heats.csv").async("text")}\nTAMPERED`);
    await expect(restoreBackup(await hashZip.generateAsync({ type: "arraybuffer" }))).rejects.toThrow("hash_mismatch:heats.csv");

    const countZip = await JSZip.loadAsync(await blob.arrayBuffer());
    const manifest = await countZip.file("manifest.csv").async("text");
    countZip.file("manifest.csv", manifest.replace(/(heats\.csv,[a-f0-9]{64},)\d+/, "$1999"));
    await expect(restoreBackup(await countZip.generateAsync({ type: "arraybuffer" }))).rejects.toThrow("row_count_mismatch:heats.csv");
  });

  it("rejects semantically impossible analysis even when its hash is recomputed", async () => {
    const blob = await createBackupBlob(createDemoState());
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const values = await zip.file("analysis_values.csv").async("text");
    const tamperedValues = values.replace(/(,C,)\d+(?:\.\d+)?(,%)/, "$1-1$2");
    const digest = createHash("sha256").update(tamperedValues).digest("hex");
    const manifest = await zip.file("manifest.csv").async("text");
    zip.file("analysis_values.csv", tamperedValues);
    zip.file("manifest.csv", manifest.replace(/(analysis_values\.csv,)[a-f0-9]{64}/, `$1${digest}`));
    await expect(restoreBackup(await zip.generateAsync({ type: "arraybuffer" }))).rejects.toThrow("analysis_value_integrity_failed");
  });

  it("rejects a backup whose coefficient settings are invalid", async () => {
    const source = createDemoState();
    source.settings.coefficientProfiles[0].overrideValues.oxygenPurityFraction = 1.5;
    const blob = await createBackupBlob(source);
    await expect(restoreBackup(await blob.arrayBuffer())).rejects.toThrow("settings_integrity_failed");
  });
});
