import { chromium } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";

const appRoot = resolve(import.meta.dirname, "..");
const projectRoot = resolve(appRoot, "..");
const output = resolve(projectRoot, "docs", "manual", "screenshots", "v0.6.1");
const html = await readFile(resolve(appRoot, "dist", "standalone", "index.html"));
const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  response.end(html);
});
await new Promise((resolveListen, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolveListen);
});
const address = server.address();
const url = `http://127.0.0.1:${address.port}/`;

await mkdir(output, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page = await context.newPage();
try {
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
let storageReady = false;
for (let attempt = 0; attempt < 50 && !storageReady; attempt += 1) {
  storageReady = await page.evaluate(() => new Promise((resolveReady) => {
    const request = indexedDB.open("bof-endpoint-coach", 2);
    request.onerror = () => resolveReady(false);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("state", "readonly");
      const get = transaction.objectStore("state").get("application");
      get.onerror = () => resolveReady(false);
      get.onsuccess = () => resolveReady(Boolean(get.result?.settings && get.result?.heats?.length));
      transaction.oncomplete = () => database.close();
    };
  }));
  if (!storageReady) await page.waitForTimeout(100);
}
if (!storageReady) throw new Error("DEMO workspace save timed out before screenshot setup.");

await page.evaluate(async () => {
  const groupKey = "DEMO-LC|BOF-DEMO-A|BOF-REF-CALC 0.3.0|COEF-LIT-001-V1|DEMO";
  const details = {
    C: [0, -0.0012, -0.0012, "%p"], temperature: [0, 4.8, 4.8, "°C"], P: [0, 0.0007, 0.0007, "%p"],
    Mn: [0, -0.006, -0.006, "%p"], Si: [0, -0.0005, -0.0005, "%p"], S: [0, 0.0002, 0.0002, "%p"],
  };
  const trainingRuns = Object.entries(details).map(([element, [currentOffset, recommendedDelta, candidateOffset, unit]], index) => ({
    id: `TR-DEMO-CARD-${index + 1}`,
    runSha256: String(index + 1).repeat(64).slice(0, 64),
    datasetSha256: String(index + 7).repeat(64).slice(0, 64),
    status: "current",
    createdAt: "2026-08-23T12:00:00.000Z",
    createdBy: "DEMO",
    groupKey,
    element,
    unit,
    formulaVersion: "BOF-REF-CALC 0.3.0",
    modelId: "BOF-REF-CALC 0.3.0",
    coefficientVersionId: "COEF-LIT-001-V1",
    synthetic: true,
    stage: "synthetic_only",
    usedRowIds: Array.from({ length: 12 }, (_value, rowIndex) => `DEMO-${element}-${rowIndex + 1}`),
    usedHeatIds: ["DEMO-HEAT-01", "DEMO-HEAT-02"],
    excludedHeats: [],
    dataPeriod: { from: "2026-08-01T00:00:00.000Z", to: "2026-08-22T00:00:00.000Z" },
    split: { trainingCount: 12, validationCount: 0, holdoutPolicy: "none" },
    metrics: { trainingBaseline: {}, trainingCandidate: {}, validationBaseline: {}, validationCandidate: {} },
    currentOffset,
    recommendedDelta,
    candidateOffset,
    eligibleForApproval: false,
    reason: "synthetic_rows_not_field_eligible",
    review: { status: "not_reviewed", reviewedAt: null, reviewedBy: null, reason: "" },
  }));
  await new Promise((resolveWrite, reject) => {
    const request = indexedDB.open("bof-endpoint-coach", 2);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("state", "readwrite");
      const store = transaction.objectStore("state");
      const get = store.get("application");
      get.onerror = () => reject(get.error);
      get.onsuccess = () => {
        const workspace = get.result;
        if (!workspace) {
          transaction.abort();
          reject(new Error("DEMO workspace was not persisted before screenshot setup."));
          return;
        }
        workspace.trainingRuns = trainingRuns;
        workspace.storageRevision = Number(workspace.storageRevision ?? 0) + 1;
        store.put(workspace, "application");
      };
      transaction.oncomplete = () => { database.close(); resolveWrite(); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
    };
  });
});
await page.reload();
await page.locator(".main-nav").getByRole("button", { name: "학습 · 계수" }).click();
await page.getByTestId("learning-screen").waitFor();
await page.screenshot({ path: resolve(output, "01-learning-recovery-entry.png") });

await page.getByRole("button", { name: /보정계수 비상복구 카드/ }).click();
await page.getByTestId("recovery-card-sheet").waitFor();
await page.screenshot({ path: resolve(output, "02-recovery-card-core.png") });
const recoveryString = await page.locator(".recovery-card-string code").innerText();

await page.getByRole("button", { name: "상세 최대 24개" }).click();
await page.locator(".recovery-card-group-select select").selectOption({ index: 1 });
await page.getByText("DEMO 전용").first().waitFor();
await page.screenshot({ path: resolve(output, "03-recovery-card-detailed.png") });

await page.getByRole("tab", { name: "수동 복구 입력" }).click();
await page.getByTestId("recovery-manual-form").waitFor();
await page.screenshot({ path: resolve(output, "04-recovery-card-manual-input.png") });
await page.getByPlaceholder("BOFRC1|PROFILE=…|CHECK=…").fill(recoveryString);
await page.getByRole("button", { name: "문자열 나누기" }).click();
await page.getByPlaceholder("예: PC 초기화 후 종이 카드 복구").fill("DEMO 카드 입력 절차 확인");
await page.getByRole("button", { name: "값 검사하고 현재 계수와 비교" }).click();
await page.getByText(/식별정보·확인코드·값 검사를 통과/).waitFor();
await page.screenshot({ path: resolve(output, "05-recovery-card-validated-comparison.png") });
await page.getByRole("button", { name: "검증된 값을 계수 초안에 반영" }).click();
await page.getByText(/검증된 비상복구값을 설정 초안에 반영/).waitFor();
await page.screenshot({ path: resolve(output, "06-settings-recovery-draft.png") });

  console.log(`Captured v0.6.1 recovery-card screenshots in ${output}`);
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
