import { expect, test } from "@playwright/test";
import { clearWorkspace, startEmpty, waitForState } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await clearWorkspace(page);
});

test("보정계수 카드를 캡처한 뒤 초기화된 작업공간에 수동 복구해 새 버전으로 저장한다", async ({ page }) => {
  await startEmpty(page, "비상복구 검증자");
  await page.locator(".main-nav").getByRole("button", { name: "기준 정보" }).click();
  await page.locator(".settings-tabs").getByRole("button", { name: "계산 · 보정 계수" }).click();
  await page.getByLabel("calibration-P").fill("0.001");
  await page.getByLabel("변경 사유").fill("비상복구 원본 계수 준비");
  await page.getByRole("button", { name: "설정 저장" }).click();
  await waitForState(page, (state) => state.settings.coefficientProfiles[0].calibrationOffsets.P === 0.001);

  await page.locator(".settings-tabs").getByRole("button", { name: "계산 · 보정 계수" }).click();
  await page.getByRole("button", { name: "비상복구 카드" }).click();
  await expect(page.getByTestId("recovery-card-sheet")).toBeVisible();
  await expect(page.locator(".recovery-card-table tbody tr")).toHaveCount(6);
  const recoveryString = await page.locator(".recovery-card-string code").innerText();
  expect(recoveryString).toContain("P=+0.00100");
  await page.getByRole("button", { name: "상세 최대 24개" }).click();
  await expect(page.getByText("근거 없음").first()).toBeVisible();
  await page.getByRole("button", { name: "닫기", exact: true }).last().click();

  await page.locator(".main-nav").getByRole("button", { name: "분석 · 리포트" }).click();
  await page.getByRole("button", { name: "작업공간 초기화" }).click();
  await page.getByRole("button", { name: "빈 작업으로 초기화" }).click();
  await waitForState(page, (state) => state.settings.coefficientProfiles[0].calibrationOffsets.P === 0);

  await page.locator(".main-nav").getByRole("button", { name: "기준 정보" }).click();
  await page.locator(".settings-tabs").getByRole("button", { name: "계산 · 보정 계수" }).click();
  await page.getByRole("button", { name: "비상복구 카드" }).click();
  await page.getByRole("tab", { name: "수동 복구 입력" }).click();
  const tampered = recoveryString.replace(/CHECK=([A-F0-9]{7})([A-F0-9])$/, (_match, prefix, last) => `CHECK=${prefix}${last === "0" ? "1" : "0"}`);
  await page.getByPlaceholder("BOFRC1|PROFILE=…|CHECK=…").fill(tampered);
  await page.getByRole("button", { name: "문자열 나누기" }).click();
  await page.getByPlaceholder("예: PC 초기화 후 종이 카드 복구").fill("브라우저 초기화 후 카드 복구");
  await page.getByRole("button", { name: "값 검사하고 현재 계수와 비교" }).click();
  await expect(page.getByText("핵심 확인코드가 값과 일치하지 않습니다.")).toBeVisible();

  await page.getByPlaceholder("BOFRC1|PROFILE=…|CHECK=…").fill(recoveryString);
  await page.getByRole("button", { name: "문자열 나누기" }).click();
  await page.getByRole("button", { name: "값 검사하고 현재 계수와 비교" }).click();
  await expect(page.getByText(/식별정보·확인코드·값 검사를 통과/)).toBeVisible();
  await page.getByRole("button", { name: "검증된 값을 계수 초안에 반영" }).click();

  await expect(page.getByText(/검증된 비상복구값을 설정 초안에 반영/)).toBeVisible();
  await expect(page.getByLabel("calibration-P")).toHaveValue("0.001");
  await page.getByRole("button", { name: "설정 저장" }).click();
  const restored = await waitForState(page, (state) => state.settings.coefficientProfiles[0].calibrationOffsets.P === 0.001 && state.settings.coefficientProfiles[0].manualRecoverySource?.evidenceRestored === false);
  const profile = restored.settings.coefficientProfiles[0];
  expect(profile.versionHistory).toHaveLength(1);
  expect(profile.manualRecoverySource.enteredBy).toBe("비상복구 검증자");
  expect(profile.manualRecoverySource.referenceLearningValues).toEqual([]);
  expect(restored.trainingRuns).toEqual([]);
});

test("비상복구 카드는 1920·1280·760px와 키보드 닫기에서 핵심 조작을 잃지 않는다", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await startEmpty(page, "화면검증자");
  await page.locator(".main-nav").getByRole("button", { name: "기준 정보" }).click();
  await page.locator(".settings-tabs").getByRole("button", { name: "계산 · 보정 계수" }).click();
  const opener = page.getByRole("button", { name: "비상복구 카드" });
  await opener.focus();
  await opener.press("Enter");
  const dialog = page.getByRole("dialog", { name: "보정계수 비상복구 카드" });
  await expect(dialog).toBeVisible();

  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 800 }, { width: 760, height: 720 }]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("button", { name: "핵심 6개" })).toBeVisible();
    await expect(page.getByRole("button", { name: "상세 최대 24개" })).toBeVisible();
    await expect(page.getByRole("button", { name: "수동 복구 입력으로 이동" })).toBeVisible();
    const geometry = await dialog.evaluate((node) => {
      const rect = node.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        viewportWidth: document.documentElement.clientWidth,
        bodyOverflow: document.body.scrollWidth > document.body.clientWidth,
      };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.bodyOverflow).toBe(false);
  }

  await page.emulateMedia({ media: "print" });
  await expect(page.getByTestId("recovery-card-sheet")).toBeVisible();
  await expect(page.locator(".recovery-card-table tbody tr")).toHaveCount(6);
  await expect(page.locator(".recovery-card-toolbar")).toBeHidden();
  await page.emulateMedia({ media: "screen" });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});
