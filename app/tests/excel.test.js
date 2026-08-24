import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { createDemoState } from "../src/data/demoState.js";
import { buildExcelBlob, buildExcelSheets } from "../src/reports/excel.js";

describe("Excel report", () => {
  it("builds correction-aware operator-facing sheets", () => {
    const sheets = buildExcelSheets(createDemoState());
    expect(sheets.map((sheet) => sheet.name)).toEqual([
      "Heat summary", "Events", "Analysis", "Corrections", "Predictions",
      "Residual ledger", "Calibration candidates", "Coefficient versions",
      "Addition plans", "Addition proposals", "Addition evidence", "Addition candidates", "Addition versions", "Read me",
    ]);
    expect(sheets[0].rows.length).toBeGreaterThan(1);
    const analysis = sheets.find((sheet) => sheet.name === "Analysis");
    expect(analysis.rows[0]).toEqual(expect.arrayContaining(["Dissolved oxygen status", "Dissolved oxygen [O] (ppm)", "Dissolved oxygen source", "Dissolved oxygen note"]));
    expect(analysis.rows.flat()).toContain(520);
  });

  it("packages a valid Open XML workbook structure", async () => {
    const blob = await buildExcelBlob(createDemoState());
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files)).toEqual(expect.arrayContaining([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/workbook.xml",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/worksheets/sheet1.xml",
      "xl/worksheets/sheet4.xml",
    ]));
    const workbook = await zip.file("xl/workbook.xml").async("text");
    expect(workbook).toContain('name="Heat summary"');
    expect(workbook).toContain('name="Read me"');
    expect(workbook).toContain('name="Addition evidence"');
  });
});
