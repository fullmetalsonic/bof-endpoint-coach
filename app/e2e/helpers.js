import { expect } from "@playwright/test";

export async function clearWorkspace(page, url = "/") {
  await page.goto(url);
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      const request = indexedDB.deleteDatabase("bof-endpoint-coach");
      request.onsuccess = request.onerror = request.onblocked = () => resolve();
    });
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
}

export async function startEmpty(page, operator = "E2E 작업자") {
  await page.getByLabel("작업자 이름").fill(operator);
  await page.getByRole("button", { name: "빈 작업으로 시작" }).click();
  await expect(page.getByText("진행 중인 차지가 없습니다")).toBeVisible();
}

export async function createHeat(page, id, { fullInputs = false } = {}) {
  await page.getByRole("button", { name: /신규 차지/ }).last().click();
  await page.getByLabel("차지 번호").fill(id);
  if (fullInputs) {
    const fillField = async (label, value) => page.locator("label").filter({ hasText: label }).getByRole("spinbutton").fill(String(value));
    await fillField("용선 중량", 230);
    await page.locator("label").filter({ hasText: "용선 중량" }).getByRole("combobox").selectOption("t");
    await fillField("용선 탄소", 4.5);
    await fillField("용선 Si", 0.64);
    await fillField("용선 Mn", 0.04);
    await fillField("용선 P", 1760);
    await page.locator("label").filter({ hasText: "용선 P" }).getByRole("combobox").selectOption("ppm");
    await fillField("용선 온도", 1350);
    await fillField("스크랩 중량", 30);
    await page.locator("label").filter({ hasText: "스크랩 중량" }).getByRole("combobox").selectOption("t");
    await fillField("스크랩 탄소", 0.2);
    await fillField("초기 부원료", 12);
    await page.locator("label").filter({ hasText: "초기 부원료" }).getByRole("combobox").selectOption("t");
    await fillField("계획 총 산소", 13000);
    await fillField("산소 유량", 300);
  }
  await page.getByRole("button", { name: "차지 시작", exact: true }).click();
  await expect(page.getByText(id, { exact: true }).first()).toBeVisible();
}

export async function readState(page) {
  return page.evaluate(async () => new Promise((resolve, reject) => {
    const request = indexedDB.open("bof-endpoint-coach", 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction("state", "readonly");
      const get = transaction.objectStore("state").get("application");
      get.onerror = () => reject(get.error);
      get.onsuccess = () => resolve(get.result);
      transaction.oncomplete = () => database.close();
    };
  }));
}

export async function waitForState(page, predicate) {
  let current;
  await expect.poll(async () => {
    current = await readState(page);
    return Boolean(current && predicate(current));
  }, { timeout: 5000 }).toBe(true);
  return current;
}

export async function advance(page, from, to) {
  await page.getByRole("button", { name: new RegExp(`${from} → ${to}`) }).click();
  await page.getByRole("button", { name: /기록하고 이동$/ }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`^${to} `) })).toBeVisible();
}
