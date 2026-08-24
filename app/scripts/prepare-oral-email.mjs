import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = "fullmetalsonic/bof-endpoint-coach";
const repositoryUrl = `https://github.com/${repository}`;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { version } = JSON.parse(readFileSync(resolve(projectRoot, "app/package.json"), "utf8"));
const releaseUrl = `${repositoryUrl}/releases/tag/v${version}`;
const sourcePath = resolve(projectRoot, `docs/manual/취련코치_구두_기능소개_v${version}.md`);
const emailBodyPath = resolve(projectRoot, `work/email/BOF_Endpoint_Coach_ORAL_EMAIL_BODY_v${version}.html`);
const previewPath = resolve(projectRoot, `work/email/BOF_Endpoint_Coach_ORAL_EMAIL_PREVIEW_v${version}.html`);
const manifestPath = resolve(projectRoot, `work/email/BOF_Endpoint_Coach_ORAL_EMAIL_MANIFEST_v${version}.json`);

const images = [
  { markdownPath: "screenshots/v0.7.2/01-dashboard-addition-coach.png", filePath: "docs/manual/screenshots/v0.7.2/01-dashboard-addition-coach.png", cid: "bof-oral-dashboard" },
  { markdownPath: "screenshots/v0.6.0/04-prediction-explanation.png", filePath: "docs/manual/screenshots/v0.6.0/04-prediction-explanation.png", cid: "bof-oral-prediction" },
  { markdownPath: "screenshots/v0.7.2/03-addition-learning.png", filePath: "docs/manual/screenshots/v0.7.2/03-addition-learning.png", cid: "bof-oral-learning" },
  { markdownPath: "screenshots/v0.6.0/01-storage-recovery.png", filePath: "docs/manual/screenshots/v0.6.0/01-storage-recovery.png", cid: "bof-oral-storage" },
  { markdownPath: "screenshots/v0.6.1/02-recovery-card-core.png", filePath: "docs/manual/screenshots/v0.6.1/02-recovery-card-core.png", cid: "bof-oral-recovery" },
];

const renderedMarkdown = execFileSync(
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

function applyInlineStyle(html, tag, style) {
  return html.replace(new RegExp(`<${tag}(?=\\s|>)([^>]*)>`, "gi"), (_match, attributes) => {
    const withoutStyle = attributes.replace(/\sstyle="[^"]*"/gi, "");
    return `<${tag}${withoutStyle} style="${style}">`;
  });
}

function prepareArticle(imageSource) {
  let html = renderedMarkdown
    .replace(/<a[^>]*class="anchor"[^>]*>[\s\S]*?<\/a>/gi, "")
    .replace(/href="(?!#|https?:|mailto:)([^"]+)"/g, (_match, relativePath) =>
      `href="${repositoryUrl}/blob/main/docs/manual/${relativePath}"`,
    );

  for (const image of images) {
    html = html.replaceAll(`src="${image.markdownPath}"`, `src="${imageSource(image)}"`);
  }
  html = html.replace(/<a[^>]*>\s*(<img[^>]*src="(?:cid:|data:image\/)[^"]+"[^>]*>)\s*<\/a>/g, "$1");

  const styles = {
    article: "color:#1f2328;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',Arial,sans-serif;font-size:16px;line-height:1.65;word-break:keep-all;overflow-wrap:anywhere;",
    h1: "margin:0 0 18px;padding:0 0 12px;border-bottom:2px solid #175ea8;color:#17324d;font-size:32px;line-height:1.25;font-weight:700;",
    h2: "margin:34px 0 16px;padding:7px 0 7px 12px;border-left:5px solid #175ea8;border-bottom:1px solid #d7dee7;color:#17324d;font-size:24px;line-height:1.3;font-weight:700;",
    h3: "margin:26px 0 12px;color:#17324d;font-size:19px;line-height:1.4;font-weight:700;",
    p: "margin:0 0 16px;color:#1f2328;font-size:16px;line-height:1.65;",
    ul: "margin:0 0 16px;padding-left:30px;color:#1f2328;font-size:16px;line-height:1.65;",
    ol: "margin:0 0 16px;padding-left:30px;color:#1f2328;font-size:16px;line-height:1.65;",
    li: "margin:5px 0;color:#1f2328;font-size:16px;line-height:1.65;",
    blockquote: "margin:0 0 20px;padding:12px 16px;border-left:5px solid #d49a00;color:#5b4300;background:#fff8d8;",
    table: "width:100%;margin:0 0 20px;border-spacing:0;border-collapse:collapse;color:#1f2328;font-size:14px;line-height:1.5;",
    th: "padding:9px 12px;border:1px solid #cbd5e1;background:#eaf1f8;color:#17324d;text-align:left;font-weight:700;",
    td: "padding:9px 12px;border:1px solid #cbd5e1;background:#ffffff;text-align:left;vertical-align:top;",
    a: "color:#0969da;text-decoration:underline;",
    strong: "font-weight:700;color:#1f2328;",
    code: "padding:2px 5px;border-radius:5px;background:#edf2f7;color:#18324d;font-family:Consolas,'Courier New',monospace;font-size:14px;",
    pre: "margin:0 0 18px;padding:16px;border-radius:6px;background:#f6f8fa;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;",
    img: "display:block;width:100%;max-width:100%;height:auto;margin:16px 0 22px;border:1px solid #aebbc9;border-radius:4px;background:#ffffff;",
    hr: "height:1px;margin:30px 0;border:0;background:#cbd5e1;",
  };

  for (const [tag, style] of Object.entries(styles)) {
    html = applyInlineStyle(html, tag, style);
  }
  return html;
}

function wrapEmail(articleHtml) {
  return `<!doctype html>
<html lang="ko">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>취련 코치 v${version} · 구두 기능 소개</title></head>
<body style="margin:0;padding:0;background:#eef2f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#eef2f6;border-collapse:collapse;">
    <tr><td align="center" style="padding:24px 12px 48px;">
      <table role="presentation" width="960" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:960px;border-collapse:collapse;">
        <tr><td style="padding:18px 22px;border:1px solid #9fb4c9;border-bottom:3px solid #175ea8;border-radius:6px 6px 0 0;background:#ffffff;color:#17324d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',Arial,sans-serif;font-size:15px;line-height:1.65;">
          <strong style="font-size:18px;font-weight:700;">취련 코치 v${version} · 사용자 구두 기능 소개</strong><br>
          GitHub 저장소: <a href="${repositoryUrl}" style="color:#0969da;text-decoration:underline;">${repositoryUrl}</a><br>
          최신 Release: <a href="${releaseUrl}" style="color:#0969da;text-decoration:underline;">${releaseUrl}</a><br>
          <span style="color:#59636e;">아래 내용은 처음 보는 사용자에게 화면을 보여주며 그대로 설명할 수 있는 90초·7~10분 대본입니다.</span>
        </td></tr>
        <tr><td style="padding:42px;border:1px solid #cbd5e1;border-top:0;border-radius:0 0 6px 6px;background:#ffffff;text-align:left;">
          ${articleHtml}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const emailBody = wrapEmail(prepareArticle((image) => `cid:${image.cid}`));
const previewBody = wrapEmail(prepareArticle((image) => imageDataUri(image.filePath)));

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

function validateGeneratedHtml() {
  for (const tag of ["a", "pre", "table"]) {
    const opening = countMatches(emailBody, new RegExp(`<${tag}(?=\\s|>)`, "gi"));
    const closing = countMatches(emailBody, new RegExp(`</${tag}>`, "gi"));
    if (opening !== closing) throw new Error(`Unbalanced ${tag} tags: ${opening}/${closing}`);
  }
  if (countMatches(emailBody, /src="cid:/g) !== images.length) throw new Error("Email body does not reference every CID image.");
  if (countMatches(previewBody, /data:image\/png;base64,/g) !== images.length) throw new Error("Email preview does not embed every image.");
  if (/<script(?=\s|>)/i.test(emailBody) || /<script(?=\s|>)/i.test(previewBody)) throw new Error("Email HTML must not contain scripts.");
  if (/src="https?:/i.test(emailBody)) throw new Error("Email body must not load external images.");
  if (!emailBody.includes(repositoryUrl) || !emailBody.includes(releaseUrl)) throw new Error("GitHub links are missing from the email body.");
}

validateGeneratedHtml();

mkdirSync(dirname(emailBodyPath), { recursive: true });
writeFileSync(emailBodyPath, emailBody, "utf8");
writeFileSync(previewPath, previewBody, "utf8");
writeFileSync(manifestPath, `${JSON.stringify({ version, repositoryUrl, releaseUrl, images }, null, 2)}\n`, "utf8");
console.log(`Prepared oral email body: ${emailBodyPath}`);
console.log(`Prepared oral email preview with ${images.length} CID images: ${previewPath}`);
console.log(`Prepared oral email manifest: ${manifestPath}`);
