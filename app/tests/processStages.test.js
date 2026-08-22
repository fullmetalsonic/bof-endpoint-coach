import { describe, expect, it } from "vitest";
import { getActionAvailability, getNextStage, hasEndpointReviewSample } from "../src/domain/processStages.js";

describe("process stages", () => {
  it("defines each next stage through G8", () => {
    expect(getNextStage("G0").code).toBe("G1");
    expect(getNextStage("G7").code).toBe("G8");
    expect(getNextStage("G8")).toBeNull();
  });

  it("enables tap only at G6", () => {
    expect(getActionAvailability({ status: "in_progress", stage: "G5", samples: [] }).tap).toBe(false);
    expect(getActionAvailability({ status: "in_progress", stage: "G6", samples: [] }).tap).toBe(true);
  });

  it("allows post-tap material and result entry at G7, then locks G8", () => {
    const g7 = getActionAvailability({ status: "tapped", stage: "G7", samples: [{ id: "S-1" }] });
    expect(g7).toEqual({ material: true, sample: true, analysis: true, checkpoint: false, reblow: false, tap: false });
    expect(Object.values(getActionAvailability({ status: "completed", stage: "G8", samples: [] })).every((value) => value === false)).toBe(true);
  });

  it("requires adopted C and temperature for endpoint review", () => {
    expect(hasEndpointReviewSample({ samples: [{ adopted: true, values: { C: 0.06 } }] })).toBe(false);
    expect(hasEndpointReviewSample({ samples: [{ adopted: true, values: { C: 0.06, temperature: 1670 } }] })).toBe(true);
  });
});
