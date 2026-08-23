import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, resolve } from "node:path";

const repository = "fullmetalsonic/bof-endpoint-coach";
const repositoryUrl = `https://github.com/${repository}`;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function markdownImagePaths(markdown) {
  return [...markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^)]*)?\)/g)].map((match) => match[1]);
}

function imageDataUri(path) {
  const mimeType = extname(path).toLowerCase() === ".jpg" ? "image/jpeg" : "image/png";
  return `data:${mimeType};base64,${readFileSync(path).toString("base64")}`;
}

export function renderStandaloneMarkdown({ sourcePath, outputPath, title, documentLabel }) {
  const markdown = readFileSync(sourcePath, "utf8");
  const rendered = execFileSync("gh", ["api", "markdown", "--method", "POST", "--input", "-"], {
    input: JSON.stringify({ text: markdown, mode: "gfm", context: repository }),
    encoding: "utf8",
    maxBuffer: 24 * 1024 * 1024,
  });
  let articleHtml = rendered;
  const images = markdownImagePaths(markdown).map((relativePath) => ({
    relativePath,
    absolutePath: resolve(dirname(sourcePath), relativePath),
  }));
  for (const item of images) {
    const fileName = basename(item.relativePath);
    articleHtml = articleHtml.replace(new RegExp(`src="[^"]*${escapeRegExp(fileName)}[^"]*"`, "g"), `src="${imageDataUri(item.absolutePath)}"`);
  }
  articleHtml = articleHtml.replace(/<a[^>]*>\s*(<img[^>]*src="data:image\/(?:png|jpeg);base64,[^"]+"[^>]*>)\s*<\/a>/g, "$1");
  articleHtml = articleHtml.replace(/href="(?!#|https?:|mailto:)([^"]+)"/g, (_match, relativePath) => `href="${repositoryUrl}/blob/main/${relativePath}"`);

  const styles = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html { scroll-behavior: smooth; background: #eef2f6; }
body { margin: 0; color: #1f2937; background: #eef2f6; font-family: "Segoe UI", "Noto Sans KR", Arial, sans-serif; font-size: 16px; line-height: 1.65; }
.page-shell { max-width: 1320px; margin: 0 auto; padding: 28px 24px 64px; }
.document-bar { position: sticky; z-index: 10; top: 0; display: flex; justify-content: space-between; gap: 20px; padding: 14px 18px; color: #51606f; background: rgba(255,255,255,.98); border: 1px solid #cbd5e1; border-bottom: 3px solid #175ea8; }
.document-bar strong { color: #17324d; }
.document-bar a { color: #175ea8; text-decoration: none; }
.markdown-body { padding: 42px 52px 64px; background: #fff; border: 1px solid #cbd5e1; border-top: 0; }
.markdown-body > :first-child { margin-top: 0; }
.markdown-body h1, .markdown-body h2, .markdown-body h3 { color: #17324d; line-height: 1.3; }
.markdown-body h1 { margin: 0 0 18px; padding-bottom: 12px; border-bottom: 2px solid #175ea8; font-size: 32px; }
.markdown-body h2 { margin: 38px 0 16px; padding: 8px 0 8px 12px; border-left: 5px solid #175ea8; border-bottom: 1px solid #d7dee7; font-size: 24px; }
.markdown-body h3 { margin: 28px 0 11px; font-size: 19px; }
.markdown-body p, .markdown-body ul, .markdown-body ol, .markdown-body table, .markdown-body blockquote { margin-top: 0; margin-bottom: 18px; }
.markdown-body li + li { margin-top: 6px; }
.markdown-body a { color: #175ea8; }
.markdown-body blockquote { padding: 14px 18px; color: #5b4300; background: #fff8d8; border-left: 5px solid #d49a00; }
.markdown-body table { display: table; width: 100%; border-collapse: collapse; font-size: 14px; }
.markdown-body th, .markdown-body td { padding: 10px 12px; border: 1px solid #cbd5e1; text-align: left; vertical-align: top; }
.markdown-body th { color: #17324d; background: #eaf1f8; }
.markdown-body tr:nth-child(even) td { background: #f8fafc; }
.markdown-body code { padding: 2px 5px; color: #18324d; background: #edf2f7; border-radius: 4px; font-family: Consolas, monospace; }
.markdown-body img { display: block; width: 100%; height: auto; margin: 18px 0 24px; border: 1px solid #aebbc9; background: #fff; box-shadow: 0 4px 14px rgba(24,45,70,.08); }
.markdown-body hr { height: 1px; margin: 34px 0; border: 0; background: #cbd5e1; }
@media (max-width: 760px) { .page-shell { padding: 0; } .document-bar { position: static; border-width: 0 0 3px; } .markdown-body { padding: 26px 20px 48px; border: 0; } .markdown-body h1 { font-size: 27px; } .markdown-body h2 { font-size: 21px; } .markdown-body table { display: block; overflow-x: auto; } }
@media print { html, body { background: #fff; } .page-shell { max-width: none; padding: 0; } .document-bar { display: none; } .markdown-body { padding: 0; border: 0; } }
`;

  const standaloneHtml = `<!doctype html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"><title>${title}</title><style>${styles}</style></head>
<body><main class="page-shell"><header class="document-bar"><strong>${documentLabel}</strong><a href="${repositoryUrl}">${repository}</a></header>${articleHtml}</main></body>
</html>`;
  if (/<script(?=\s|>)/i.test(standaloneHtml)) throw new Error("Standalone guide must not contain scripts.");
  const embeddedCount = (standaloneHtml.match(/data:image\/(?:png|jpeg);base64,/g) ?? []).length;
  if (embeddedCount !== images.length) throw new Error(`Expected ${images.length} embedded images, found ${embeddedCount}.`);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, standaloneHtml, "utf8");
  return { outputPath, embeddedCount };
}
