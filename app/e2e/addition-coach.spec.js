import { expect, test } from "@playwright/test";
import { clearWorkspace, startEmpty, waitForState } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await clearWorkspace(page);
});

test("빈 작업도 문헌 투입모델 프로필을 한 개 이상 유지한다", async ({ page }) => {
  const generated = await page.evaluate(async () => (await import("/src/data/referenceSettings.js")).createReferenceSettings());
  expect(generated.additionModelProfiles).toHaveLength(1);
  await startEmpty(page, "투입모델 마이그레이션 검증자");
  const state = await waitForState(page, (stored) => stored.settings?.additionModelProfiles?.length >= 1);
  expect(state.settings.additionModelProfiles[0].status).toBe("literature_test");
});

test("투입 계획 비교·버전 이력·비상복구 카드가 실제 조작으로 이어진다", async ({ page }) => {
  await page.getByLabel("작업자 이름").fill("투입코치 검증자");
  await page.getByRole("button", { name: "DEMO로 체험" }).click();
  await expect(page.getByTestId("dashboard-screen")).toBeVisible();

  const coach = page.locator(".addition-coach-bar");
  await expect(coach).toBeVisible();
  await coach.getByRole("button", { name: "비교 보기" }).click();
  const dialog = page.getByRole("dialog", { name: "투입 계획 비교" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/코치안은 참고 계획이며 실제 투입 기록이 아닙니다/)).toBeVisible();

  const amount = dialog.getByRole("spinbutton", { name: "예상량" });
  await amount.fill("100");
  await dialog.getByRole("button", { name: "내 계획 저장" }).click();
  await waitForState(page, (state) => state.heats.find((heat) => heat.id === state.currentHeatId)?.additionCoach?.operatorPlans?.filter((plan) => plan.status === "active").length === 1);
  await amount.fill("120");
  await dialog.getByRole("button", { name: "내 계획 저장" }).click();
  const planned = await waitForState(page, (state) => state.heats.find((heat) => heat.id === state.currentHeatId)?.additionCoach?.operatorPlans?.length === 2);
  expect(planned.heats.find((heat) => heat.id === planned.currentHeatId).additionCoach.operatorPlans.map((plan) => plan.status)).toEqual(["superseded", "active"]);
  await dialog.getByRole("button", { name: "닫기", exact: true }).last().click();

  await page.locator(".main-nav").getByRole("button", { name: "학습 · 계수" }).click();
  await expect(page.getByRole("heading", { name: "투입 코치 오차학습" })).toBeVisible();
  await expect(page.getByText(/실제 투입 전·후 분석/)).toBeVisible();
  await page.getByRole("button", { name: "투입계수 복구 카드" }).click();
  const recovery = page.getByRole("dialog", { name: "투입계수 비상복구 카드" });
  await expect(recovery).toBeVisible();
  await expect(recovery.locator("tbody tr")).toHaveCount(6);
  await expect(recovery.getByText(/BOFARC1\|PROFILE=/)).toBeVisible();
  await recovery.getByRole("tab", { name: "수동 복구 입력" }).click();
  await expect(recovery.getByText(/초안만 생성/)).toBeVisible();
});

test("투입 코치 핵심 조작은 1920·1280·760px에서 가로 넘침 없이 보인다", async ({ page }) => {
  await page.getByLabel("작업자 이름").fill("반응형 검증자");
  await page.getByRole("button", { name: "DEMO로 체험" }).click();
  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1280, height: 800 }, { width: 760, height: 720 }]) {
    await page.setViewportSize(viewport);
    const bar = page.locator(".addition-coach-bar");
    await expect(bar).toBeVisible();
    const geometry = await bar.evaluate((node) => ({ right: node.getBoundingClientRect().right, viewport: document.documentElement.clientWidth, overflow: document.body.scrollWidth > document.body.clientWidth }));
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewport + 1);
    expect(geometry.overflow).toBe(false);
  }
});
