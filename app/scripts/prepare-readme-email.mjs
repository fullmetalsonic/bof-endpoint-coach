import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repository = "fullmetalsonic/bof-endpoint-coach";
const repositoryUrl = `https://github.com/${repository}`;
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const { version } = JSON.parse(readFileSync(resolve(projectRoot, "app/package.json"), "utf8"));
const emailBodyPath = resolve(projectRoot, `work/email/BOF_Endpoint_Coach_EMAIL_BODY_v${version}.html`);
const previewPath = resolve(projectRoot, `release/BOF_Endpoint_Coach_EMAIL_PREVIEW_v${version}.html`);

const images = [
  { path: "docs/manual/screenshots/v0.6.0/03-dashboard-g6.png", cid: "bof-dashboard-g6" },
  { path: "docs/manual/screenshots/v0.6.0/01-storage-recovery.png", cid: "bof-storage-recovery" },
  { path: "docs/manual/screenshots/v0.6.0/04-prediction-explanation.png", cid: "bof-prediction-explanation" },
  { path: "docs/manual/screenshots/v0.6.0/05-learning-coefficient-runs.png", cid: "bof-learning-runs" },
];

const renderedReadme = execFileSync(
  "gh",
  ["api", "markdown", "--method", "POST", "--input", "-"],
  {
    input: JSON.stringify({ text: readFileSync(resolve(projectRoot, "README.md"), "utf8"), mode: "gfm", context: repository }),
    encoding: "utf8",
    maxBuffer: 5 * 1024 * 1024,
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
  let html = renderedReadme
    .replace(/<a[^>]*class="anchor"[^>]*>[\s\S]*?<\/a>/gi, "")
    .replace(/href="(?!#|https?:|mailto:)([^"]+)"/g, (_match, relativePath) =>
      `href="${repositoryUrl}/blob/main/${relativePath}"`,
    );

  for (const image of images) {
    html = html.replaceAll(`src="${image.path}"`, `src="${imageSource(image)}"`);
  }

  const styles = {
    article: "color:#1f2328;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',Arial,sans-serif;font-size:16px;line-height:1.6;word-break:keep-all;overflow-wrap:anywhere;",
    h1: "margin:0 0 16px;padding:0 0 10px;border-bottom:1px solid #d1d9e0;color:#1f2328;font-size:32px;line-height:1.25;font-weight:700;",
    h2: "margin:32px 0 16px;padding:0 0 8px;border-bottom:1px solid #d1d9e0;color:#1f2328;font-size:24px;line-height:1.3;font-weight:700;",
    h3: "margin:28px 0 14px;color:#1f2328;font-size:20px;line-height:1.35;font-weight:700;",
    h4: "margin:24px 0 12px;color:#1f2328;font-size:17px;line-height:1.4;font-weight:700;",
    p: "margin:0 0 16px;color:#1f2328;font-size:16px;line-height:1.65;",
    ul: "margin:0 0 16px;padding-left:30px;color:#1f2328;font-size:16px;line-height:1.65;",
    ol: "margin:0 0 16px;padding-left:30px;color:#1f2328;font-size:16px;line-height:1.65;",
    li: "margin:5px 0;color:#1f2328;font-size:16px;line-height:1.65;",
    blockquote: "margin:0 0 20px;padding:2px 16px;border-left:4px solid #d1d9e0;color:#59636e;background:#ffffff;",
    table: "width:100%;margin:0 0 20px;border-spacing:0;border-collapse:collapse;color:#1f2328;font-size:14px;line-height:1.5;",
    th: "padding:9px 12px;border:1px solid #d1d9e0;background:#f6f8fa;text-align:left;font-weight:700;",
    td: "padding:9px 12px;border:1px solid #d1d9e0;background:#ffffff;text-align:left;vertical-align:top;",
    a: "color:#0969da;text-decoration:underline;",
    strong: "font-weight:700;color:#1f2328;",
    code: "padding:2px 5px;border-radius:5px;background:#eff1f3;color:#1f2328;font-family:Consolas,'Courier New',monospace;font-size:14px;",
    pre: "margin:0 0 18px;padding:16px;border-radius:6px;background:#f6f8fa;white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;",
    img: "display:block;width:100%;max-width:100%;height:auto;margin:14px 0 18px;border:1px solid #d1d9e0;border-radius:4px;background:#ffffff;",
    hr: "height:1px;margin:28px 0;border:0;background:#d1d9e0;",
  };

  for (const [tag, style] of Object.entries(styles)) {
    html = applyInlineStyle(html, tag, style);
  }
  return html;
}

function wrapEmail(articleHtml) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>취련 코치 v${version} · GitHub README</title>
</head>
<body style="margin:0;padding:0;background:#f6f8fa;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;background:#f6f8fa;border-collapse:collapse;">
    <tr>
      <td align="center" style="padding:24px 12px 48px;">
        <table role="presentation" width="960" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:960px;border-collapse:collapse;">
          <tr>
            <td style="padding:14px 18px;border:1px solid #d1d9e0;border-radius:6px 6px 0 0;background:#fff8c5;color:#633c01;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',Arial,sans-serif;font-size:14px;line-height:1.5;">
              <strong style="font-weight:700;">v${version} 배포 안내:</strong> 단일 JSON 전체 백업·복원, 중요 작업 전 복구점, 7일 복원 취소, 재현 가능한 학습 실행, 종점예상 근거 설명을 추가했습니다. GitHub README 전체와 최신 화면을 본문에서 바로 볼 수 있습니다.
            </td>
          </tr>
          <tr>
            <td style="padding:42px;border:1px solid #d1d9e0;border-top:0;border-radius:0 0 6px 6px;background:#ffffff;text-align:left;">
              ${articleHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const emailBody = wrapEmail(prepareArticle((image) => `cid:${image.cid}`));
const previewBody = wrapEmail(prepareArticle((image) => imageDataUri(image.path)));

function countMatches(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

function validateGeneratedHtml() {
  const balancedTags = ["article", "a", "pre", "table"];
  for (const tag of balancedTags) {
    const opening = countMatches(emailBody, new RegExp(`<${tag}(?=\\s|>)`, "gi"));
    const closing = countMatches(emailBody, new RegExp(`</${tag}>`, "gi"));
    if (opening !== closing) {
      throw new Error(`Unbalanced ${tag} tags in generated email body: ${opening}/${closing}`);
    }
  }
  if (countMatches(emailBody, /src="cid:/g) !== images.length) {
    throw new Error("Generated email body does not reference all CID images.");
  }
  if (countMatches(previewBody, /data:image\/png;base64,/g) !== images.length) {
    throw new Error("Generated email preview does not embed all images.");
  }
  if (/<script(?=\s|>)/i.test(emailBody) || /<script(?=\s|>)/i.test(previewBody)) {
    throw new Error("Generated email HTML must not contain scripts.");
  }
}

validateGeneratedHtml();

mkdirSync(dirname(emailBodyPath), { recursive: true });
mkdirSync(dirname(previewPath), { recursive: true });
writeFileSync(emailBodyPath, emailBody, "utf8");
writeFileSync(previewPath, previewBody, "utf8");
console.log(`Prepared README email body: ${emailBodyPath}`);
console.log(`Prepared README email preview: ${previewPath}`);
