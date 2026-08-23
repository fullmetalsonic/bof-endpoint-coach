import { describe, expect, it } from "vitest";
import { buildTrainingRuns, learningEligibilitySummary } from "../src/calibration/trainingRun.js";
import { createDemoState } from "../src/data/demoState.js";
import { capturePredictionSnapshot } from "../src/domain/predictionHistory.js";

function completedFieldState() {
  const state = createDemoState({ displayName: "학습 검증자" });
  const heat = structuredClone(state.heats[0]);
  heat.id = "FIELD-001";
  heat.demo = false;
  heat.status = "tapped";
  heat.referenceSnapshot.gradeProfile.status = "field";
  heat.referenceSnapshot.equipmentProfile.status = "field";
  heat.predictionSnapshots = [];
  heat.actualEndpointAnalysisId = heat.samples.at(-1).adoptedAnalysisId;
  state.heats = [capturePredictionSnapshot(heat, state.settings, { type: "tap", id: "EV-TAP" }, "2026-08-23T01:00:00.000Z")];
  state.currentHeatId = heat.id;
  return state;
}

describe("reproducible training runs", () => {
  it("records deterministic dataset hashes, metrics, split, and exclusions", async () => {
    const state = completedFieldState();
    state.heats.push(structuredClone(createDemoState().heats[1]));
    const runs = await buildTrainingRuns(state, [], { createdAt: "2026-08-23T02:00:00.000Z", createdBy: "학습 검증자" });
    expect(runs).toHaveLength(6);
    expect(new Set(runs.map((run) => run.datasetSha256)).size).toBe(6);
    expect(runs.every((run) => /^[a-f0-9]{64}$/.test(run.datasetSha256))).toBe(true);
    expect(runs[0]).toMatchObject({ status: "current", createdBy: "학습 검증자", split: { trainingCount: 1, validationCount: 0 } });
    expect(runs[0].usedHeatIds).toEqual(["FIELD-001"]);
    expect(runs[0].excludedHeats.some((item) => item.reasons.includes("synthetic_or_demo"))).toBe(true);
  });

  it("reuses an identical run and marks the former run stale after source correction", async () => {
    const state = completedFieldState();
    const first = await buildTrainingRuns(state, [], { createdAt: "2026-08-23T02:00:00.000Z" });
    const duplicate = await buildTrainingRuns(state, first, { createdAt: "2026-08-23T03:00:00.000Z" });
    expect(duplicate).toHaveLength(6);
    state.heats[0].samples.at(-1).analysisResults[0].values.P += 0.001;
    const changed = await buildTrainingRuns(state, duplicate, { createdAt: "2026-08-23T04:00:00.000Z" });
    expect(changed).toHaveLength(7);
    const phosphorus = changed.filter((run) => run.element === "P");
    expect(phosphorus.map((run) => run.status).sort()).toEqual(["current", "stale"]);
    expect(phosphorus.find((run) => run.status === "stale").staleReason).toBe("dataset_changed");
  });

  it("reports why incomplete and DEMO heats are excluded", () => {
    const summary = learningEligibilitySummary(createDemoState());
    expect(summary.eligibleHeatCount).toBe(0);
    expect(summary.excludedHeatCount).toBe(2);
    expect(summary.reasonCounts.synthetic_or_demo).toBe(2);
    expect(summary.reasonCounts.confirmed_endpoint_missing).toBe(2);
  });
});
