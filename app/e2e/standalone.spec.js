import path from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";
import { clearWorkspace, createHeat, startEmpty, waitForState } from "./helpers.js";

const standaloneUrl = pathToFileURL(path.resolve("dist/standalone/index.html")).href;

test("배포용 단일 HTML은 서버 없이 실행되고 새로고침 후 입력을 복원한다", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 1280, height: 960 });
  await clearWorkspace(page, standaloneUrl);
  await startEmpty(page, "오프라인 작업자");
  await createHeat(page, "OFFLINE-001");
  await waitForState(page, (state) => state.heats.some((heat) => heat.id === "OFFLINE-001"));

  await page.reload();
  await expect(page.getByRole("button", { name: "오프라인 작업자" })).toBeVisible();
  await expect(page.getByText("OFFLINE-001", { exact: true }).first()).toBeVisible();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(true);
  expect(await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => /^https?:/.test(entry.name)).map((entry) => entry.name))).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("배포용 단일 HTML 두 창도 최신 저장을 덮어쓰지 않고 다시 읽는다", async ({ page, context }) => {
  await clearWorkspace(page, standaloneUrl);
  await startEmpty(page, "오프라인 다중 창");
  await waitForState(page, (state) => state.operatorProfile.displayName === "오프라인 다중 창");
  const second = await context.newPage();
  await second.goto(standaloneUrl);
  await expect(second.getByText("진행 중인 차지가 없습니다")).toBeVisible();

  await createHeat(page, "OFFLINE-MULTI");
  await waitForState(page, (state) => state.heats.some((heat) => heat.id === "OFFLINE-MULTI"));
  await expect(second.getByText("다른 창에서 작업공간이 변경됐습니다.")).toBeVisible();
  await second.getByRole("button", { name: "최신 상태 불러오기" }).click();
  await second.getByRole("button", { name: "확인하고 불러오기" }).click();
  await expect(second.getByText("OFFLINE-MULTI", { exact: true }).first()).toBeVisible();
});
