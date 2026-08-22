import { expect, test } from "@playwright/test";
import { advance, clearWorkspace, createHeat, startEmpty } from "./helpers.js";

test.use({ viewport: { width: 1920, height: 1080 } });

test.beforeEach(async ({ page }) => {
  await clearWorkspace(page);
});

test("1920×1080 업무 화면은 한 개의 주 행동과 구분된 보조 전환을 표시한다", async ({ page }) => {
  await startEmpty(page, "1920 검증자");
  await createHeat(page, "E2E-1920", { fullInputs: true });
  await advance(page, "G0", "G1");

  const workflow = page.locator(".workflow-panel");
  await expect(workflow.getByRole("heading", { name: "실제 조업값 기록" })).toBeVisible();
  await expect(workflow.locator(".workflow-primary-button")).toHaveCount(1);
  await expect(workflow.locator(".workflow-transition-card .stage-controls.secondary button")).toHaveCount(1);
  await expect(page.locator(".action-bar button.recommended")).toHaveCount(1);

  const primaryStyle = await workflow.locator(".workflow-primary-button").evaluate((element) => getComputedStyle(element).backgroundColor);
  const secondaryStyle = await workflow.locator(".workflow-transition-card .stage-controls.secondary button").evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(primaryStyle).not.toBe(secondaryStyle);

  const boxes = await Promise.all([".process-rail", ".dashboard-main", ".data-ledger", ".action-bar"].map(async (selector) => page.locator(selector).boundingBox()));
  for (const box of boxes) {
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1920);
  }
  expect(await page.locator("body").evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(true);
});

test("영문 전환 후에도 현재 작업·순서·다음 단계가 같은 위치에서 유지된다", async ({ page }) => {
  await startEmpty(page, "English QA");
  await createHeat(page, "E2E-EN", { fullInputs: true });
  await advance(page, "G0", "G1");
  await page.getByRole("button", { name: "English", exact: true }).click();

  const workflow = page.locator(".workflow-panel");
  await expect(workflow.getByRole("heading", { name: "Record actual operating values" })).toBeVisible();
  await expect(workflow.getByText("Stage sequence")).toBeVisible();
  await expect(workflow.getByText("G2 Early blow", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Checkpoint · enter now" })).toBeVisible();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(true);
});
