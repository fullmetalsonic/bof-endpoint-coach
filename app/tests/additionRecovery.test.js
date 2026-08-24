import { describe, expect, it } from "vitest";
import { createLiteratureAdditionProfile } from "../src/calculation/addition/additionProfile.js";
import { additionBaseFingerprint, encodeAdditionRecoveryString, parseAdditionRecoveryString, verifyAdditionRecoveryPayload } from "../src/calibration/additionRecoveryCodec.js";

describe("addition coefficient emergency recovery", () => {
  it("round-trips all six values with a verified check code", async () => {
    const profile = createLiteratureAdditionProfile();
    profile.corrections = { fluxAmountMultiplier: 1.04, coolantAmountMultiplier: 1.11, alloyAmountMultiplier: 0.97, oxygenAmountMultiplier: 1.02, timingShiftMinutes: -0.5, effectMultiplier: 0.93 };
    const baseFingerprint = await additionBaseFingerprint(profile);
    const encoded = await encodeAdditionRecoveryString({ profileId: profile.id, profileVersionId: profile.versionId, formulaVersion: profile.formulaVersion, baseFingerprint, corrections: profile.corrections });
    const parsed = parseAdditionRecoveryString(encoded);
    const verified = await verifyAdditionRecoveryPayload(parsed);
    expect(verified.corrections).toEqual(profile.corrections);
    expect(verified.checkCode).toMatch(/^[A-F0-9]{8}$/);
  });

  it("rejects a mistyped value even when the format looks valid", async () => {
    const profile = createLiteratureAdditionProfile();
    const baseFingerprint = await additionBaseFingerprint(profile);
    const encoded = await encodeAdditionRecoveryString({ profileId: profile.id, profileVersionId: profile.versionId, formulaVersion: profile.formulaVersion, baseFingerprint, corrections: profile.corrections });
    const parsed = parseAdditionRecoveryString(encoded.replace("FLUX=1.0000", "FLUX=1.1000"));
    await expect(verifyAdditionRecoveryPayload(parsed)).rejects.toThrow("addition_recovery_check_mismatch");
  });
});
