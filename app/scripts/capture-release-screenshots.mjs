import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = resolve(import.meta.dirname, "..");
const projectRoot = resolve(appRoot, "..");
const output = resolve(projectRoot, "docs", "screenshots");
const url = pathToFileURL(resolve(appRoot, "dist", "standalone", "index.html")).href;

await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.goto(url);
await page.evaluate(async () => {
  await new Promise((resolveDelete) => {
    const request = indexedDB.deleteDatabase("bof-endpoint-coach");
    request.onsuccess = request.onerror = request.onblocked = () => resolveDelete();
  });
  localStorage.clear();
});
await page.reload();
await page.getByLabel("작업자 이름").fill("DEMO 작업자");
await page.getByRole("button", { name: "DEMO로 체험" }).click();
await page.getByTestId("dashboard-screen").waitFor();
await page.screenshot({ path: resolve(output, "dashboard-ko.png") });

await page.getByRole("button", { name: "English" }).click();
await page.getByText("Do this now").waitFor();
await page.screenshot({ path: resolve(output, "dashboard-en.png") });
await page.getByRole("button", { name: "한국어" }).click();

await page.getByRole("button", { name: "기준 정보" }).click();
await page.getByTestId("settings-screen").waitFor();
await page.screenshot({ path: resolve(output, "settings-ko.png") });

await page.locator(".main-nav").getByRole("button", { name: "대시보드" }).click();
await page.getByRole("button", { name: "전체 이력·정정" }).click();
await page.getByTestId("heat-detail-screen").waitFor();
await page.screenshot({ path: resolve(output, "correction-ledger-ko.png") });
await page.locator(".timeline-actions").getByRole("button", { name: "수정", exact: true }).last().click();
await page.getByRole("dialog", { name: "입력 기록 수정" }).waitFor();
await page.screenshot({ path: resolve(output, "correction-modal-ko.png") });

await browser.close();
console.log(`Captured release screenshots in ${output}`);
