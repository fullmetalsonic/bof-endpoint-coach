import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderStandaloneMarkdown } from "./render-standalone-markdown.mjs";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { version } = JSON.parse(readFileSync(resolve(projectRoot, "app/package.json"), "utf8"));
const result = renderStandaloneMarkdown({
  sourcePath: resolve(projectRoot, `docs/manual/취련코치_발표용_설명서_v${version}.md`),
  outputPath: resolve(projectRoot, `release/BOF_Endpoint_Coach_PRESENTATION_GUIDE_v${version}.html`),
  title: `취련 코치 v${version} · 발표용 설명서`,
  documentLabel: `취련 코치 v${version} · 발표용 설명서`,
});

console.log(`Prepared presentation guide with ${result.embeddedCount} screenshots: ${result.outputPath}`);
