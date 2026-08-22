import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = "fullmetalsonic/bof-endpoint-coach";
const repositoryUrl = `https://github.com/${repository}`;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { version } = JSON.parse(readFileSync(resolve(projectRoot, "app/package.json"), "utf8"));
const sourcePath = resolve(projectRoot, "docs/user-guide.md");
const outputPath = resolve(projectRoot, `release/BOF_Endpoint_Coach_USER_GUIDE_v${version}.html`);
const screenshotPaths = [
  "docs/screenshots/dashboard-ko.png",
  "docs/screenshots/correction-ledger-ko.png",
  "docs/screenshots/settings-ko.png",
  "docs/screenshots/dashboard-en.png",
];

const renderedGuide = execFileSync(
  "gh",
  ["api", "markdown", "--method", "POST", "--input", "-"],
  {
    input: JSON.stringify({ text: readFileSync(sourcePath, "utf8"), mode: "gfm", context: repository }),
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  },
);

function imageDataUri(relativePath) {
  const absolutePath = resolve(projectRoot, relativePath);
  const mimeType = extname(absolutePath).toLowerCase() === ".jpg" ? "image/jpeg" : "image/png";
  return `data:${mimeType};base64,${readFileSync(absolutePath).toString("base64")}`;
}

let articleHtml = renderedGuide;
for (const imagePath of screenshotPaths) {
  const rawUrl = `https://raw.githubusercontent.com/${repository}/main/${imagePath}`;
  articleHtml = articleHtml.replaceAll(`src="${rawUrl}"`, `src="${imageDataUri(imagePath)}"`);
  articleHtml = articleHtml.replaceAll(`src="${imagePath}"`, `src="${imageDataUri(imagePath)}"`);
}

articleHtml = articleHtml.replace(
  /href="(?!#|https?:|mailto:)([^"]+)"/g,
  (_match, relativePath) => `href="${repositoryUrl}/blob/main/${relativePath}"`,
);

const styles = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; background: #eef2f6; }
body { margin: 0; color: #1f2937; background: #eef2f6; font-family: "Segoe UI", "Noto Sans KR", Arial, sans-serif; font-size: 16px; line-height: 1.65; }
.page-shell { max-width: 1240px; margin: 0 auto; padding: 28px 24px 64px; }
.document-bar { display: flex; justify-content: space-between; gap: 20px; padding: 14px 18px; color: #51606f; background: #fff; border: 1px solid #cbd5e1; border-bottom: 3px solid #175ea8; }
.document-bar strong { color: #17324d; }
.document-bar a { color: #175ea8; text-decoration: none; }
.markdown-body { padding: 42px 52px 64px; background: #fff; border: 1px solid #cbd5e1; border-top: 0; }
.markdown-body > :first-child { margin-top: 0; }
.markdown-body h1, .markdown-body h2, .markdown-body h3 { color: #17324d; line-height: 1.3; }
.markdown-body h1 { margin: 0 0 18px; padding-bottom: 12px; border-bottom: 2px solid #175ea8; font-size: 32px; }
.markdown-body h2 { margin: 36px 0 16px; padding: 8px 0 8px 12px; border-left: 5px solid #175ea8; border-bottom: 1px solid #d7dee7; font-size: 24px; }
.markdown-body h3 { margin: 26px 0 10px; font-size: 19px; }
.markdown-body p, .markdown-body ul, .markdown-body ol, .markdown-body table, .markdown-body blockquote { margin-top: 0; margin-bottom: 18px; }
.markdown-body li + li { margin-top: 6px; }
.markdown-body a { color: #175ea8; }
.markdown-body blockquote { padding: 14px 18px; color: #5b4300; background: #fff8d8; border-left: 5px solid #d49a00; }
.markdown-body table { width: 100%; border-collapse: collapse; font-size: 14px; }
.markdown-body th, .markdown-body td { padding: 10px 12px; border: 1px solid #cbd5e1; text-align: left; vertical-align: top; }
.markdown-body th { color: #17324d; background: #eaf1f8; }
.markdown-body tr:nth-child(even) td { background: #f8fafc; }
.markdown-body code { padding: 2px 5px; color: #18324d; background: #edf2f7; border-radius: 4px; font-family: Consolas, monospace; }
.markdown-body img { display: block; width: 100%; height: auto; margin: 18px 0 24px; border: 1px solid #b8c4d0; background: #fff; }
.markdown-body hr { height: 1px; margin: 34px 0; border: 0; background: #cbd5e1; }
@media (max-width: 760px) { .page-shell { padding: 0; } .document-bar { border-width: 0 0 3px; } .markdown-body { padding: 26px 20px 48px; border: 0; } .markdown-body h1 { font-size: 27px; } .markdown-body h2 { font-size: 21px; } .markdown-body table { display: block; overflow-x: auto; } }
@media print { html, body { background: #fff; } .page-shell { max-width: none; padding: 0; } .document-bar { display: none; } .markdown-body { padding: 0; border: 0; } }
`;

const standaloneHtml = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>취련 코치 v${version} · 사용 설명서</title>
  <style>${styles}</style>
</head>
<body>
  <main class="page-shell">
    <header class="document-bar">
      <strong>취련 코치 v${version} · 오프라인 사용 설명서</strong>
      <a href="${repositoryUrl}">${repository}</a>
    </header>
    ${articleHtml}
  </main>
</body>
</html>`;

if (/<script(?=\s|>)/i.test(standaloneHtml)) throw new Error("User guide must not contain scripts.");
if ((standaloneHtml.match(/data:image\/png;base64,/g) ?? []).length !== screenshotPaths.length) {
  throw new Error("User guide does not embed all screenshots.");
}

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, standaloneHtml, "utf8");
console.log(`Prepared standalone user guide: ${outputPath}`);
