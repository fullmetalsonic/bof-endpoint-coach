import path from "node:path";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { expect, test } from "@playwright/test";

const { version } = JSON.parse(readFileSync(path.resolve("package.json"), "utf8"));
const versionHeading = new RegExp(`v${version.replaceAll(".", "\\.")}`);
const documents = [
  ["사용 설명서", `BOF_Endpoint_Coach_USER_GUIDE_v${version}.html`, versionHeading],
  ["상세 설명서", `BOF_Endpoint_Coach_DETAILED_USER_GUIDE_v${version}.html`, versionHeading],
  ["발표용 설명서", `BOF_Endpoint_Coach_PRESENTATION_GUIDE_v${version}.html`, versionHeading],
  ["GitHub형 README", `BOF_Endpoint_Coach_README_v${version}.html`, /BOF Endpoint Coach/],
  ["메일 미리보기", `BOF_Endpoint_Coach_EMAIL_PREVIEW_v${version}.html`, /BOF Endpoint Coach/],
];

for (const [label, filename, heading] of documents) {
  test(`${label} HTML은 이미지·레이아웃·페이지 오류 없이 직접 열린다`, async ({ page }) => {
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.setViewportSize({ width: 1280, height: 960 });
    await page.goto(pathToFileURL(path.resolve("..", "release", filename)).href, { waitUntil: "load" });
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(heading);
    expect(await page.locator("body").evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(true);
    const images = await page.locator("img").evaluateAll((items) => items.map((item) => ({ complete: item.complete, width: item.naturalWidth })));
    expect(images.length).toBeGreaterThan(0);
    expect(images.every((item) => item.complete && item.width > 0)).toBe(true);
    expect(await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => /^https?:/.test(entry.name)).map((entry) => entry.name))).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
}
