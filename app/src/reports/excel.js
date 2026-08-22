import JSZip from "jszip";
import { calculateEndpoint } from "../calculation/endpoint.js";
import { downloadBlob } from "./backup.js";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function escapeXml(value) {
  const cleaned = [...String(value ?? "")].filter((character) => {
    const code = character.charCodeAt(0);
    return code >= 32 || code === 9 || code === 10 || code === 13;
  }).join("");
  return cleaned
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function columnName(index) {
  let value = index + 1;
  let name = "";
  while (value > 0) {
    value -= 1;
    name = String.fromCharCode(65 + (value % 26)) + name;
    value = Math.floor(value / 26);
  }
  return name;
}

function cellXml(value, rowIndex, columnIndex, header) {
  const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
  const style = header ? ' s="1"' : "";
  if (typeof value === "number" && Number.isFinite(value)) return `<c r="${reference}"${style}><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${reference}" t="b"${style}><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${reference}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function worksheetXml(rows) {
  const lastColumn = columnName(Math.max(0, ...rows.map((row) => row.length - 1)));
  const sheetRows = rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((value, columnIndex) => cellXml(value, rowIndex, columnIndex, rowIndex === 0)).join("")}</row>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${Math.max(1, rows.length)}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

function objectRows(objects) {
  if (objects.length === 0) return [["No data"]];
  const headers = [...new Set(objects.flatMap((item) => Object.keys(item)))];
  return [headers, ...objects.map((item) => headers.map((header) => item[header] ?? ""))];
}

export function buildExcelSheets(state) {
  const summary = state.heats.map((heat) => {
    const calc = calculateEndpoint(heat, state.settings);
    const latest = [...heat.samples].sort((a, b) => new Date(b.sampledAt) - new Date(a.sampledAt))[0];
    return {
      "Heat ID": heat.id,
      Grade: heat.gradeCode,
      Status: heat.status,
      Stage: heat.stage,
      "Actual C (%)": latest?.values?.C ?? "",
      "Estimated C (%)": calc.carbon.available ? calc.carbon.value : "Unavailable",
      "C scenario low (%)": calc.carbon.available ? calc.carbon.low : "Unavailable",
      "C scenario high (%)": calc.carbon.available ? calc.carbon.high : "Unavailable",
      "Actual temperature (°C)": latest?.values?.temperature ?? "",
      "Estimated temperature (°C)": calc.temperature.available ? calc.temperature.value : "Unavailable",
      "Temperature scenario low (°C)": calc.temperature.available ? calc.temperature.low : "Unavailable",
      "Temperature scenario high (°C)": calc.temperature.available ? calc.temperature.high : "Unavailable",
      "Formula version": calc.formulaVersion ?? "",
      "Coefficient basis": calc.basis?.status ?? "",
      "Override fields": calc.basis?.overrideFields?.join(", ") ?? "",
      "Literature source IDs": calc.basis?.sourceIds?.join(", ") ?? "",
      "DEMO / not plant validated": calc.demo ? "YES" : "NO",
    };
  });
  const events = state.heats.flatMap((heat) => heat.events.map((event) => ({
    "Heat ID": heat.id,
    "Event ID": event.id,
    Type: event.type,
    "Occurred at": event.occurredAt,
    Summary: event.summaryKo ?? event.summaryEn ?? "",
  })));
  const analyses = state.heats.flatMap((heat) => heat.samples.map((sample) => ({
    "Heat ID": heat.id,
    "Sample ID": sample.id,
    "Sampled at": sample.sampledAt,
    Stage: sample.stage,
    Method: sample.method,
    Adopted: sample.adopted,
    "Oxygen at analysis (Nm3)": sample.processSnapshot?.cumulativeOxygenNm3 ?? "",
    ...sample.values,
  })));
  const readMe = [
    ["Warning"],
    ["Synthetic DEMO operating data with public-literature calculation scenarios. Not plant-validated."],
    ["Priority: site-approved overrides, then user overrides, then preserved literature values."],
    ["Low/high values are literature scenarios, not statistically validated confidence intervals."],
    ["Does not replace plant procedures, safety systems, laboratory results, or operator judgment."],
    ["Settings version", state.settings.version],
  ];
  return [
    { name: "Heat summary", rows: objectRows(summary) },
    { name: "Events", rows: objectRows(events) },
    { name: "Analysis", rows: objectRows(analyses) },
    { name: "Read me", rows: readMe },
  ];
}

function contentTypesXml(sheetCount) {
  const worksheets = Array.from({ length: sheetCount }, (_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${worksheets}
</Types>`;
}

function workbookXml(sheets) {
  const entries = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews><workbookView/></bookViews>
  <sheets>${entries}</sheets>
</workbook>`;
}

function workbookRelationshipsXml(sheetCount) {
  const sheets = Array.from({ length: sheetCount }, (_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheets}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

const ROOT_RELATIONSHIPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

export async function buildExcelBlob(state) {
  const sheets = buildExcelSheets(state);
  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypesXml(sheets.length));
  zip.folder("_rels").file(".rels", ROOT_RELATIONSHIPS);
  const xl = zip.folder("xl");
  xl.file("workbook.xml", workbookXml(sheets));
  xl.file("styles.xml", STYLES);
  xl.folder("_rels").file("workbook.xml.rels", workbookRelationshipsXml(sheets.length));
  const worksheets = xl.folder("worksheets");
  sheets.forEach((sheet, index) => worksheets.file(`sheet${index + 1}.xml`, worksheetXml(sheet.rows)));
  return zip.generateAsync({ type: "blob", mimeType: XLSX_MIME, compression: "DEFLATE" });
}

export async function exportExcelReport(state, filename = "bof-endpoint-coach-report.xlsx") {
  const blob = await buildExcelBlob(state);
  downloadBlob(blob, filename);
}
