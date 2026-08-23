import { expect, test } from "@playwright/test";
import { clearWorkspace, createHeat, openNewHeat, startEmpty, waitForState } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await clearWorkspace(page);
});

test("작성 중인 신규 차지 초안은 닫은 뒤 복구하거나 명시적으로 버릴 수 있다", async ({ page }) => {
  await startEmpty(page, "초안 검증자");
  await openNewHeat(page);
  const dialog = page.getByRole("dialog", { name: "신규 차지" });
  await dialog.getByLabel("차지 번호").fill("DRAFT-RECOVER");
  await dialog.getByRole("button", { name: "닫기" }).click();

  await openNewHeat(page);
  await expect(page.getByLabel("차지 번호")).toHaveValue("DRAFT-RECOVER");
  await expect(page.getByText("저장되지 않은 초안을 복구했습니다.")).toBeVisible();
  await page.getByRole("button", { name: "초안 버리기" }).click();

  await openNewHeat(page);
  await expect(page.getByLabel("차지 번호")).not.toHaveValue("DRAFT-RECOVER");
});

test("다른 창의 저장을 감지한 창은 읽기 전용이 되고 최신 상태를 다시 읽는다", async ({ page, context }) => {
  await startEmpty(page, "다중 창 검증자");
  await waitForState(page, (state) => state.operatorProfile.displayName === "다중 창 검증자");
  const second = await context.newPage();
  await second.goto("/");
  await expect(second.getByText("진행 중인 차지가 없습니다")).toBeVisible();

  await createHeat(page, "MULTI-WINDOW");
  await waitForState(page, (state) => state.heats.some((heat) => heat.id === "MULTI-WINDOW"));
  await expect(second.getByText("다른 창에서 작업공간이 변경됐습니다.")).toBeVisible();
  await second.getByRole("button", { name: "최신 상태 불러오기" }).click();
  await second.getByRole("button", { name: "확인하고 불러오기" }).click();
  await expect(second.getByText("MULTI-WINDOW", { exact: true }).first()).toBeVisible();
});

test("1920 화면의 200% 상당 폭에서도 가로 페이지 넘침 없이 조작하고 모달을 Escape로 닫는다", async ({ page }) => {
  await page.getByLabel("작업자 이름").fill("확대 검증자");
  await page.getByRole("button", { name: "DEMO로 체험" }).click();
  await page.setViewportSize({ width: 960, height: 540 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.locator(".workflow-panel")).toBeVisible();
  await page.getByRole("button", { name: "확대 검증자" }).click();
  await expect(page.getByRole("dialog", { name: "작업자 설정 대화상자" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "작업자 설정 대화상자" })).toHaveCount(0);
});

test("차지 이력은 검색과 상태 필터로 필요한 행만 좁힌다", async ({ page }) => {
  await page.getByLabel("작업자 이름").fill("이력 검증자");
  await page.getByRole("button", { name: "DEMO로 체험" }).click();
  await page.getByRole("button", { name: "차지 이력" }).click();
  await page.getByRole("searchbox", { name: "검색" }).fill("260822-01");
  await expect(page.locator(".history-table tbody tr")).toHaveCount(1);
  await expect(page.locator(".history-table tbody tr")).toContainText("DEMO-260822-01");
  await page.getByLabel("상태").selectOption("cancelled");
  await expect(page.getByText("조건에 맞는 차지가 없습니다.")).toBeVisible();
});
