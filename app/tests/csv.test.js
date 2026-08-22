import { describe, expect, it } from "vitest";
import { encodeCsv, parseCsv } from "../src/storage/csv.js";

describe("CSV codec", () => {
  it("round-trips commas, quotes, newlines, and formula-leading values", () => {
    const rows = [{ id: "=1+1", note: "comma, quote \" and\nline", value: "0.061" }];
    const csv = encodeCsv(rows, ["id", "note", "value"]);
    expect(csv).toContain("'=1+1");
    expect(parseCsv(csv)).toEqual(rows);
  });
});
