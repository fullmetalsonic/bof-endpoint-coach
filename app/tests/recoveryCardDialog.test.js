/* @vitest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CoefficientRecoveryCardDialog } from "../src/components/CoefficientRecoveryCardDialog.jsx";
import { createReferenceSettings } from "../src/data/referenceSettings.js";
import { coefficientBaseFingerprint, encodeCoreRecoveryString } from "../src/calibration/recoveryCardCodec.js";

describe("CoefficientRecoveryCardDialog", () => {
  it("shows the six-value card and moves a verified handwritten recovery into a settings draft", async () => {
    const settings = createReferenceSettings();
    const profile = settings.coefficientProfiles[0];
    const baseFingerprint = await coefficientBaseFingerprint(profile);
    const recoveryString = await encodeCoreRecoveryString({
      profileId: profile.id,
      coefficientVersionId: profile.versionId,
      formulaVersion: profile.formulaVersion,
      baseFingerprint,
      offsets: { C: 0.002, temperature: -5, P: 0.001, Mn: -0.01, Si: 0, S: 0.0005 },
    });
    const onApply = vi.fn();
    render(React.createElement(CoefficientRecoveryCardDialog, { settings, trainingRuns: [], operatorName: "김철수", locale: "ko", canWrite: true, onClose: vi.fn(), onApply }));

    expect(await screen.findByTestId("recovery-card-sheet")).toBeTruthy();
    expect(screen.getAllByText("핵심 6개").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("tab", { name: "수동 복구 입력" }));
    fireEvent.change(screen.getByPlaceholderText("BOFRC1|PROFILE=…|CHECK=…"), { target: { value: recoveryString } });
    fireEvent.click(screen.getByRole("button", { name: "문자열 나누기" }));
    expect(screen.getByText(/복구문자열을 6개 핵심값/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("예: PC 초기화 후 종이 카드 복구"), { target: { value: "PC 초기화 후 종이 카드 복구" } });
    fireEvent.click(screen.getByRole("button", { name: "값 검사하고 현재 계수와 비교" }));
    await waitFor(() => expect(screen.getByText(/식별정보·확인코드·값 검사를 통과/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "검증된 값을 계수 초안에 반영" }));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0].profile.calibrationOffsets.P).toBe(0.001);
    expect(onApply.mock.calls[0][0].profile.manualRecoverySource.evidenceRestored).toBe(false);
  });
});
