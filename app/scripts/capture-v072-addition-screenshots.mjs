import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const projectRoot = resolve(appRoot, "..");
const output = resolve(projectRoot, "docs", "manual", "screenshots", "v0.7.2");
const html = await readFile(resolve(appRoot, "dist", "standalone", "index.html"));
const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(html);
});
await new Promise((done, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", done); });
const url = `http://127.0.0.1:${server.address().port}/`;

await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(error.message));

try {
  await page.goto(url);
  await page.evaluate(async () => {
    await new Promise((done) => {
      const request = indexedDB.deleteDatabase("bof-endpoint-coach");
      request.onsuccess = request.onerror = request.onblocked = () => done();
    });
    localStorage.clear();
  });
  await page.reload();
  await page.getByLabel("작업자 이름").fill("DEMO 작업자");
  await page.getByRole("button", { name: "DEMO로 체험" }).click();
  await page.getByTestId("dashboard-screen").waitFor();
  await page.locator(".addition-coach-bar").waitFor();
  await page.screenshot({ path: resolve(output, "01-dashboard-addition-coach.png") });

  await page.locator(".addition-coach-bar").getByRole("button", { name: "비교 보기" }).click();
  await page.getByRole("dialog", { name: "투입 계획 비교" }).waitFor();
  await page.screenshot({ path: resolve(output, "02-addition-plan-comparison.png") });
  await page.getByRole("dialog", { name: "투입 계획 비교" }).getByRole("button", { name: "닫기", exact: true }).last().click();

  await page.locator(".main-nav").getByRole("button", { name: "학습 · 계수" }).click();
  await page.getByRole("heading", { name: "투입 코치 오차학습" }).waitFor();
  await page.screenshot({ path: resolve(output, "03-addition-learning.png") });

  await page.getByRole("button", { name: "투입계수 복구 카드" }).click();
  const recovery = page.getByRole("dialog", { name: "투입계수 비상복구 카드" });
  await recovery.waitFor();
  await recovery.getByText(/BOFARC1\|PROFILE=/).waitFor();
  await page.screenshot({ path: resolve(output, "04-addition-recovery-card.png") });
  await recovery.getByRole("tab", { name: "수동 복구 입력" }).click();
  await page.screenshot({ path: resolve(output, "05-addition-manual-recovery.png") });
  await recovery.getByRole("button", { name: "닫기", exact: true }).last().click();

  await page.locator(".settings-tabs").getByRole("button", { name: "투입 모델" }).click();
  await page.getByRole("heading", { name: "공개 문헌 투입 시험 시나리오" }).waitFor();
  await page.screenshot({ path: resolve(output, "06-addition-model-settings.png") });

  if (pageErrors.length) throw new Error(`Screenshot flow page errors: ${pageErrors.join(" | ")}`);
  console.log(`Captured v0.7.2 addition-coach screenshots in ${output}`);
} finally {
  await browser.close();
  await new Promise((done) => server.close(done));
}
