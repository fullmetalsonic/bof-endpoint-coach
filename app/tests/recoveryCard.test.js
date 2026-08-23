import { describe, expect, it } from "vitest";
import { createReferenceSettings } from "../src/data/referenceSettings.js";
import { createDemoState, createEmptyState } from "../src/data/demoState.js";
import { buildRecoveryCardSnapshot, recoveryCardGroupOptions } from "../src/calibration/recoveryCardSnapshot.js";
import { coefficientBaseFingerprint, encodeCoreRecoveryString, parseCoreRecoveryString, verifyCoreRecoveryPayload } from "../src/calibration/recoveryCardCodec.js";
import { buildManualRecoveryProfile, validateManualCoefficientRecovery, validateRecoveryLearningDetails } from "../src/domain/manualCoefficientRecovery.js";
import { createJsonBackup, parseJsonBackup } from "../src/reports/jsonBackup.js";
import { calculateEndpoint } from "../src/calculation/endpoint.js";
import { validateSettings } from "../src/domain/settingsValidation.js";

function profile() {
  return structuredClone(createReferenceSettings().coefficientProfiles[0]);
}

function core(source = profile()) {
  return {
    profileId: source.id,
    coefficientVersionId: source.versionId,
    formulaVersion: source.formulaVersion,
    baseFingerprint: "ABCDEF123456",
    offsets: { C: 0.002, temperature: -5, P: 0.001, Mn: -0.01, Si: 0, S: 0.0005 },
  };
}

describe("coefficient emergency recovery card", () => {
  it("round-trips the six core offsets through the compact recovery string", async () => {
    const text = await encodeCoreRecoveryString(core());
    const parsed = parseCoreRecoveryString(text);
    const verified = await verifyCoreRecoveryPayload(parsed);
    expect(text).toContain("BOFRC1|");
    expect(verified.offsets).toEqual(core().offsets);
    expect(verified.checkCode).toMatch(/^[A-F0-9]{8}$/);
  });

  it("allows key case and order changes but rejects duplicates, unknown keys, and tampering", async () => {
    const text = await encodeCoreRecoveryString(core());
    const parts = text.split("|");
    const reordered = [parts[0].toLowerCase(), ...parts.slice(1).reverse().map((part) => `${part.split("=")[0].toLowerCase()}=${part.slice(part.indexOf("=") + 1)}`)].join("|");
    await expect(verifyCoreRecoveryPayload(parseCoreRecoveryString(reordered))).resolves.toMatchObject({ offsets: core().offsets });
    expect(() => parseCoreRecoveryString(`${text}|C=0`)).toThrow(/duplicate_key/);
    expect(() => parseCoreRecoveryString(`${text}|OTHER=1`)).toThrow(/unknown_key/);
    const tampered = text.replace("C=+0.00200", "C=+0.00300");
    await expect(verifyCoreRecoveryPayload(parseCoreRecoveryString(tampered))).rejects.toThrow("recovery_check_code_mismatch");
    await expect(verifyCoreRecoveryPayload({ ...core(), offsets: { ...core().offsets, C: "" }, checkCode: "00000000" })).rejects.toThrow("recovery_offsets_invalid");
  });

  it("changes the base fingerprint when an effective literature or site value changes", async () => {
    const first = profile();
    const second = profile();
    second.overrideValues.heatLossFractionBase = 0.04;
    expect(await coefficientBaseFingerprint(first)).not.toBe(await coefficientBaseFingerprint(second));
  });

  it("builds six rows and never invents missing learning evidence", async () => {
    const source = profile();
    const groupKey = `DEMO-LC|BOF-DEMO-A|${source.formulaVersion}|${source.versionId}|FIELD`;
    const runs = [{
      id: "TR-1", groupKey, element: "P", coefficientVersionId: source.versionId, status: "current", createdAt: "2026-08-23T00:00:00.000Z",
      currentOffset: 0, recommendedDelta: 0.001, candidateOffset: 0.001, usedRowIds: ["R1"], usedHeatIds: ["H1"], stage: "ledger_only", synthetic: false,
    }, {
      id: "TR-OLD", groupKey, element: "P", coefficientVersionId: source.versionId, status: "stale", createdAt: "2026-08-22T00:00:00.000Z",
      currentOffset: 0, recommendedDelta: 0.009, candidateOffset: 0.009, usedRowIds: ["OLD"], usedHeatIds: ["OLD"], stage: "ledger_only", synthetic: false,
    }];
    const snapshot = await buildRecoveryCardSnapshot({ profile: source, trainingRuns: runs, groupKey, operatorName: "테스터" });
    expect(snapshot.rows).toHaveLength(6);
    expect(snapshot.rows.find((row) => row.key === "P")).toMatchObject({ recommendedDelta: 0.001, evidenceCount: 1 });
    expect(snapshot.rows.find((row) => row.key === "C")).toMatchObject({ recommendedDelta: null, status: "missing" });
    expect(recoveryCardGroupOptions(runs, source)).toMatchObject([{ elementCount: 1, status: "current" }]);
  });

  it("requires complete detail triples and verifies candidate = current + delta", () => {
    expect(validateRecoveryLearningDetails([{ element: "P", currentOffset: 0, recommendedDelta: 0.001, candidateOffset: 0.001 }]).errors).toEqual([]);
    expect(validateRecoveryLearningDetails([{ element: "P", currentOffset: 0, recommendedDelta: 0.001, candidateOffset: 0.002 }]).errors[0].code).toBe("detail_equation_mismatch");
    expect(validateRecoveryLearningDetails([{ element: "P", currentOffset: 0, recommendedDelta: "", candidateOffset: 0.001 }]).errors[0].code).toBe("detail_incomplete");
  });

  it("validates identity and creates a reference-only new profile draft", async () => {
    const target = profile();
    const input = core(target);
    input.coefficientVersionId = "COEF-LIT-001-V-LOST-AFTER-RESET";
    input.baseFingerprint = await coefficientBaseFingerprint(target);
    input.checkCode = parseCoreRecoveryString(await encodeCoreRecoveryString(input)).checkCode;
    const validation = await validateManualCoefficientRecovery({
      targetProfile: target,
      coreInput: input,
      detailRows: [{ element: "P", currentOffset: 0, recommendedDelta: 0.001, candidateOffset: 0.001 }],
      operatorName: "김철수",
      reason: "PC 초기화 후 카드 복구",
    });
    expect(validation.valid).toBe(true);
    const restored = buildManualRecoveryProfile(target, validation, { operatorName: "김철수", reason: "PC 초기화 후 카드 복구", enteredAt: "2026-08-23T01:02:03.000Z" });
    expect(restored.calibrationOffsets.P).toBe(0.001);
    expect(restored.manualRecoverySource.referenceLearningValues).toHaveLength(1);
    expect(restored.manualRecoverySource.evidenceRestored).toBe(false);
    expect(restored.manualRecoverySource.sourceCoefficientVersionId).toBe("COEF-LIT-001-V-LOST-AFTER-RESET");
    const settings = createReferenceSettings();
    settings.coefficientProfiles[0] = restored;
    expect(validateSettings(settings)).toEqual([]);
    settings.coefficientProfiles[0].calibrationOffsets.P = 0.002;
    expect(validateSettings(settings)).toContain(`${target.id} 비상 수동복구 출처의 형식과 확인코드를 확인하십시오.`);
  });

  it("blocks a formula or base mismatch and bad operator metadata", async () => {
    const target = profile();
    const input = core(target);
    input.baseFingerprint = await coefficientBaseFingerprint(target);
    input.checkCode = parseCoreRecoveryString(await encodeCoreRecoveryString(input)).checkCode;
    const wrongFormula = await validateManualCoefficientRecovery({
      targetProfile: { ...target, formulaVersion: "OTHER" }, coreInput: input, operatorName: "", reason: "x",
    });
    expect(wrongFormula.valid).toBe(false);
    expect(wrongFormula.errors.map((error) => error.code)).toEqual(expect.arrayContaining(["formula_version_mismatch", "base_fingerprint_mismatch", "operator_missing", "reason_too_short"]));
  });

  it("preserves recovery metadata through the existing JSON 0.6.0 backup contract", async () => {
    const state = createEmptyState({ operatorProfile: { displayName: "김철수" }, onboardingCompleted: true });
    const target = state.settings.coefficientProfiles[0];
    const input = core(target);
    input.baseFingerprint = await coefficientBaseFingerprint(target);
    input.checkCode = parseCoreRecoveryString(await encodeCoreRecoveryString(input)).checkCode;
    const validation = await validateManualCoefficientRecovery({ targetProfile: target, coreInput: input, operatorName: "김철수", reason: "JSON 왕복 복구 확인" });
    state.settings.coefficientProfiles[0] = buildManualRecoveryProfile(target, validation, { operatorName: "김철수", reason: "JSON 왕복 복구 확인" });
    const created = await createJsonBackup(state, []);
    const parsed = await parseJsonBackup(created.blob);
    expect(parsed.preview.schemaVersion).toBe("0.6.0");
    expect(parsed.state.settings.coefficientProfiles[0].manualRecoverySource.coreCheckCode).toBe(input.checkCode);
  });

  it("does not retroactively apply a recovered current setting to an existing heat snapshot", () => {
    const state = createDemoState({ displayName: "테스터" });
    const heat = state.heats[0];
    const before = calculateEndpoint(heat, state.settings);
    state.settings.coefficientProfiles[0].calibrationOffsets.P = 0.05;
    const after = calculateEndpoint(heat, state.settings);
    expect(after.phosphorus.value).toBe(before.phosphorus.value);
    expect(after.coefficient.versionId).toBe(before.coefficient.versionId);
  });
});
