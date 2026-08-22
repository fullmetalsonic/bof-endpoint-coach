import { describe, expect, it } from "vitest";
import { getInitialInputReadiness, getStageWorkflow } from "../src/domain/workflowGuidance.js";

function heatAt(stage, overrides = {}) {
  return {
    id: "WF-001",
    status: stage === "G7" ? "tapped" : stage === "G8" ? "completed" : "in_progress",
    stage,
    startedAt: "2026-08-22T01:00:00.000Z",
    initial: {},
    process: { cumulativeOxygenNm3: 0 },
    samples: [],
    events: [],
    stageHistory: [{ from: null, to: stage, occurredAt: "2026-08-22T01:00:00.000Z" }],
    ...overrides,
  };
}

describe("stage workflow guidance", () => {
  it("routes an empty G0 heat to initial input editing, then to G1 when calculation inputs are complete", () => {
    const empty = heatAt("G0");
    expect(getStageWorkflow(empty, "ko").current.kind).toBe("edit_initial");
    const complete = heatAt("G0", { initial: { hotMetalKg: 230000, hotMetalC: 4.5, scrapKg: 30000, scrapC: 0.2, plannedTotalOxygenNm3: 13000, hotMetalTemperatureC: 1350 } });
    expect(getInitialInputReadiness(complete).predictionComplete).toBe(true);
    expect(getStageWorkflow(complete, "ko").current.kind).toBe("advance");
  });

  it("routes G3 through sample, analysis, checkpoint, and stage transition in order", () => {
    const base = heatAt("G3");
    expect(getStageWorkflow(base, "ko").recommendedAction).toBe("sample");
    const sampled = { ...base, samples: [{ id: "S-1", stage: "G3", sampledAt: "2026-08-22T01:01:00.000Z", values: {} }] };
    expect(getStageWorkflow(sampled, "ko").recommendedAction).toBe("analysis");
    const analyzed = { ...sampled, samples: [{ ...sampled.samples[0], adopted: true, values: { C: 0.2, temperature: 1550 } }] };
    expect(getStageWorkflow(analyzed, "ko").recommendedAction).toBe("checkpoint");
    const checked = { ...analyzed, events: [{ type: "checkpoint", stage: "G3", occurredAt: "2026-08-22T01:02:00.000Z" }] };
    expect(getStageWorkflow(checked, "ko").current.kind).toBe("advance");
  });

  it("keeps G5 advance visibly blocked until an adopted C and temperature sample exists", () => {
    const base = heatAt("G5");
    const workflow = getStageWorkflow(base, "ko");
    expect(workflow.recommendedAction).toBe("sample");
    expect(workflow.steps.find((step) => step.id === "advance").status).toBe("blocked");
    const ready = { ...base, samples: [{ id: "S-F", stage: "G5", sampledAt: "2026-08-22T01:01:00.000Z", adopted: true, values: { C: 0.06, temperature: 1670 } }] };
    expect(getStageWorkflow(ready, "ko").advanceValidation.ok).toBe(true);
  });

  it("recommends a final pre-tap sample at G6 while leaving tap available", () => {
    const workflow = getStageWorkflow(heatAt("G6", { samples: [{ id: "S-F", stage: "G5", adopted: true, values: { C: 0.06, temperature: 1670 } }] }), "ko");
    expect(workflow.recommendedAction).toBe("sample");
    expect(workflow.availability.tap).toBe(true);
  });
});
