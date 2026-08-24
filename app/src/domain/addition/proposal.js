import { calculateEndpoint } from "../../calculation/endpoint.js";
import { calculateAdditionCoach } from "../../calculation/addition/recommendationCoordinator.js";

function operatorSnapshot(operatorProfile) {
  return { displayName: operatorProfile?.displayName?.trim() || "미입력" };
}

function processSnapshot(heat) {
  return {
    stage: heat.stage,
    cumulativeOxygenNm3: Number.isFinite(Number(heat.process?.cumulativeOxygenNm3)) ? Number(heat.process.cumulativeOxygenNm3) : null,
    oxygenFlowNm3PerMinute: Number.isFinite(Number(heat.process?.oxygenFlowNm3PerMinute)) ? Number(heat.process.oxygenFlowNm3PerMinute) : null,
    lanceHeightM: Number.isFinite(Number(heat.process?.lanceHeightM)) ? Number(heat.process.lanceHeightM) : null,
    remainingMinutes: Number.isFinite(Number(heat.process?.remainingMinutes)) ? Number(heat.process.remainingMinutes) : null,
  };
}

export function createAdditionProposalSnapshot(heat, settings, trigger, { calculatedAt = new Date().toISOString(), mode = "shadow", operatorProfile = null } = {}) {
  const endpoint = calculateEndpoint(heat, settings, calculatedAt);
  const calculation = calculateAdditionCoach(heat, settings, endpoint, calculatedAt);
  return {
    id: `ADDPROP-${crypto.randomUUID()}`,
    status: "active",
    mode,
    triggerType: trigger.type,
    triggerId: trigger.id ?? null,
    calculatedAt,
    createdAt: calculatedAt,
    createdBy: operatorSnapshot(operatorProfile),
    heatId: heat.id,
    stage: heat.stage,
    processSnapshot: processSnapshot(heat),
    endpointSnapshotId: heat.predictionSnapshots?.at(-1)?.id ?? null,
    result: structuredClone(calculation),
  };
}

export function appendAdditionProposal(heat, settings, trigger, options = {}) {
  const proposal = createAdditionProposalSnapshot(heat, settings, trigger, options);
  return {
    ...heat,
    additionCoach: {
      hidden: Boolean(heat.additionCoach?.hidden),
      operatorPlans: structuredClone(heat.additionCoach?.operatorPlans ?? []),
      decisions: structuredClone(heat.additionCoach?.decisions ?? []),
      proposals: [...(heat.additionCoach?.proposals ?? []), proposal],
    },
  };
}

export function appendExistingAdditionProposal(heat, proposal, triggerId = null) {
  return {
    ...heat,
    additionCoach: {
      hidden: Boolean(heat.additionCoach?.hidden),
      operatorPlans: structuredClone(heat.additionCoach?.operatorPlans ?? []),
      decisions: structuredClone(heat.additionCoach?.decisions ?? []),
      proposals: [...(heat.additionCoach?.proposals ?? []), { ...structuredClone(proposal), triggerId: triggerId ?? proposal.triggerId ?? null }],
    },
  };
}
