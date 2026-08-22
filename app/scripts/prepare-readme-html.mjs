import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = "fullmetalsonic/bof-endpoint-coach";
const repositoryUrl = `https://github.com/${repository}`;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { version } = JSON.parse(readFileSync(resolve(projectRoot, "app/package.json"), "utf8"));
const outputPath = resolve(projectRoot, `release/BOF_Endpoint_Coach_README_v${version}.html`);

const renderedReadme = execFileSync(
  "gh",
  [
    "api",
    `repos/${repository}/readme`,
    "-H",
    "Accept: application/vnd.github.html+json",
  ],
  { encoding: "utf8", maxBuffer: 5 * 1024 * 1024 },
);

function imageDataUri(relativePath) {
  const absolutePath = resolve(projectRoot, relativePath);
  const mimeType = extname(absolutePath).toLowerCase() === ".jpg" ? "image/jpeg" : "image/png";
  return `data:${mimeType};base64,${readFileSync(absolutePath).toString("base64")}`;
}

let articleHtml = renderedReadme;
for (const imagePath of [
  "docs/screenshots/dashboard-ko.png",
  "docs/screenshots/settings-ko.png",
  "docs/screenshots/dashboard-en.png",
]) {
  articleHtml = articleHtml.replaceAll(
    `src="${imagePath}"`,
    `src="${imageDataUri(imagePath)}"`,
  );
}

articleHtml = articleHtml.replace(
  /href="(?!#|https?:|mailto:)([^"]+)"/g,
  (_match, relativePath) => `href="${repositoryUrl}/blob/main/${relativePath}"`,
);

const styles = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html { background: #f6f8fa; }
body {
  margin: 0;
  color: #1f2328;
  background: #f6f8fa;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans KR", Helvetica, Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
}
.page-shell { max-width: 1320px; margin: 0 auto; padding: 32px 24px 64px; }
.document-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
  padding: 12px 16px;
  color: #59636e;
  background: #fff;
  border: 1px solid #d1d9e0;
  border-radius: 6px;
  font-size: 13px;
}
.document-bar strong { color: #1f2328; }
.document-bar a { color: #0969da; text-decoration: none; }
.document-bar a:hover { text-decoration: underline; }
.markdown-body {
  min-width: 200px;
  padding: 45px;
  overflow-wrap: break-word;
  background: #fff;
  border: 1px solid #d1d9e0;
  border-radius: 6px;
}
.markdown-body::before, .markdown-body::after { display: table; content: ""; }
.markdown-body::after { clear: both; }
.markdown-body > :first-child { margin-top: 0 !important; }
.markdown-body > :last-child { margin-bottom: 0 !important; }
.markdown-body h1, .markdown-body h2, .markdown-body h3,
.markdown-body h4, .markdown-body h5, .markdown-body h6 {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}
.markdown-body h1 { padding-bottom: .3em; border-bottom: 1px solid #d1d9e0; font-size: 2em; }
.markdown-body h2 { padding-bottom: .3em; border-bottom: 1px solid #d1d9e0; font-size: 1.5em; }
.markdown-body h3 { font-size: 1.25em; }
.markdown-body h4 { font-size: 1em; }
.markdown-body h5 { font-size: .875em; }
.markdown-body h6 { color: #59636e; font-size: .85em; }
.markdown-body p, .markdown-body blockquote, .markdown-body ul, .markdown-body ol,
.markdown-body dl, .markdown-body table, .markdown-body pre, .markdown-body details {
  margin-top: 0;
  margin-bottom: 16px;
}
.markdown-body ul, .markdown-body ol { padding-left: 2em; }
.markdown-body li + li { margin-top: .25em; }
.markdown-body a { color: #0969da; text-decoration: none; }
.markdown-body a:hover { text-decoration: underline; }
.markdown-body strong { font-weight: 600; }
.markdown-body hr { height: .25em; margin: 24px 0; padding: 0; background: #d1d9e0; border: 0; }
.markdown-body blockquote { padding: 0 1em; color: #59636e; border-left: .25em solid #d1d9e0; }
.markdown-body table { display: block; width: max-content; max-width: 100%; overflow: auto; border-spacing: 0; border-collapse: collapse; }
.markdown-body table th { font-weight: 600; }
.markdown-body table th, .markdown-body table td { padding: 6px 13px; border: 1px solid #d1d9e0; }
.markdown-body table tr { background: #fff; border-top: 1px solid #d1d9e0; }
.markdown-body table tr:nth-child(2n) { background: #f6f8fa; }
.markdown-body code, .markdown-body tt { padding: .2em .4em; background: #818b981f; border-radius: 6px; font: 85% ui-monospace, SFMono-Regular, Consolas, monospace; }
.markdown-body pre { padding: 16px; overflow: auto; background: #f6f8fa; border-radius: 6px; }
.markdown-body pre code { padding: 0; background: transparent; font-size: 100%; }
.markdown-body img { max-width: 100%; height: auto; border: 1px solid #d1d9e0; border-radius: 4px; background: #fff; }
.markdown-body .anchor { float: left; margin-left: -20px; padding-right: 4px; line-height: 1; }
.markdown-body .anchor svg { visibility: hidden; }
.markdown-body h1:hover .anchor svg, .markdown-body h2:hover .anchor svg,
.markdown-body h3:hover .anchor svg { visibility: visible; }
.markdown-body kbd { padding: 3px 5px; color: #1f2328; background: #f6f8fa; border: 1px solid #afb8c1; border-bottom-color: #8c959f; border-radius: 6px; box-shadow: inset 0 -1px 0 #8c959f; font: 11px ui-monospace, monospace; }
@media (max-width: 760px) {
  .page-shell { padding: 0; }
  .document-bar { margin: 0; border-width: 0 0 1px; border-radius: 0; }
  .markdown-body { padding: 22px; border: 0; border-radius: 0; }
}
@media print {
  html, body { background: #fff; }
  .page-shell { max-width: none; padding: 0; }
  .document-bar { display: none; }
  .markdown-body { padding: 0; border: 0; }
  .markdown-body a { color: #1f2328; }
}
`;

const standaloneHtml = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>취련 코치 v${version} · README</title>
  <style>${styles}</style>
</head>
<body>
  <main class="page-shell">
    <header class="document-bar">
      <strong>취련 코치 v${version} · GitHub README 오프라인 사본</strong>
      <a href="${repositoryUrl}">${repository}</a>
    </header>
    ${articleHtml}
  </main>
</body>
</html>`;

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, standaloneHtml, "utf8");
console.log(`Prepared GitHub-style README HTML: ${outputPath}`);
