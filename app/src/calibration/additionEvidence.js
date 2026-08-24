import { getActiveAnalysisResults } from "../domain/analysisRecords.js";

const CORRECTION_KEYS = Object.freeze({
  flux: "fluxAmountMultiplier",
  coolant: "coolantAmountMultiplier",
  alloy: "alloyAmountMultiplier",
  oxygen: "oxygenAmountMultiplier",
});

function finite(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function active(record) {
  return (record?.status ?? "active") === "active";
}

function time(value) {
  return new Date(value).getTime();
}

function activeAnalysisSeries(heat) {
  return (heat.samples ?? [])
    .filter(active)
    .map((sample) => {
      const analysis = getActiveAnalysisResults(sample).sort((a, b) => time(a.recordedAt ?? a.occurredAt) - time(b.recordedAt ?? b.occurredAt)).at(-1);
      return analysis ? { sampleId: sample.id, sampledAt: sample.sampledAt, analysisId: analysis.id, values: analysis.values ?? {} } : null;
    })
    .filter(Boolean)
    .sort((a, b) => time(a.sampledAt) - time(b.sampledAt));
}

function matchingRecommendation(proposal, event) {
  const recommendations = proposal?.result?.recommendations ?? [];
  if (event.type === "reblow") return recommendations.find((item) => item.operationType === "oxygen") ?? null;
  if (event.type !== "material") return null;
  return recommendations.find((item) => item.operationType === "material" && item.materialCode === event.payload?.materialCode) ?? null;
}

function effectDefinition(recommendation) {
  if (recommendation.model === "coolant") return { element: "temperature", expected: recommendation.effects?.temperature?.estimatedDeltaC, unit: "°C" };
  if (recommendation.model === "oxygen") return { element: "C", expected: recommendation.effects?.carbon?.estimatedDelta, unit: "%" };
  if (recommendation.model === "alloy") {
    const element = recommendation.target?.element;
    return { element, expected: recommendation.effects?.[element]?.estimatedDelta, unit: "%" };
  }
  return { element: null, expected: null, unit: null };
}

function eventAmount(event) {
  return event.type === "reblow" ? event.payload?.additionalOxygenNm3 : event.payload?.amountKg;
}

function groupKey(row) {
  return [row.gradeCode, row.equipmentProfileId, row.formulaVersion, row.profileVersionId, row.model, row.materialCode ?? "OXYGEN", row.synthetic ? "DEMO" : "FIELD"].join("|");
}

function targetHit(value, target) {
  if (!finite(value) || !target) return null;
  if (finite(target.min) && Number(value) < Number(target.min)) return false;
  if (finite(target.max) && Number(value) > Number(target.max)) return false;
  return true;
}

function targetForElement(heat, element) {
  return heat.referenceSnapshot?.gradeProfile?.targets?.[element] ?? null;
}

function proposalForEvent(heat, event) {
  const ids = new Set([event.id, event.correctionOf].filter(Boolean));
  return [...(heat.additionCoach?.proposals ?? [])]
    .filter((proposal) => active(proposal) && ids.has(proposal.triggerId))
    .sort((a, b) => time(b.calculatedAt) - time(a.calculatedAt))[0] ?? null;
}

function timingProposalForEvent(heat, event) {
  return [...(heat.additionCoach?.proposals ?? [])]
    .filter((proposal) => active(proposal) && time(proposal.calculatedAt) < time(event.occurredAt) && matchingRecommendation(proposal, event)?.timing?.startAt)
    .sort((a, b) => time(b.calculatedAt) - time(a.calculatedAt))[0] ?? null;
}

export function buildAdditionEvidenceLedger(state) {
  const rows = [];
  for (const heat of state.heats ?? []) {
    if (["cancelled"].includes(heat.status)) continue;
    const analyses = activeAnalysisSeries(heat);
    const activeActions = (heat.events ?? []).filter((event) => active(event) && ["material", "reblow"].includes(event.type)).sort((a, b) => time(a.occurredAt) - time(b.occurredAt));
    for (const event of activeActions) {
      const proposal = proposalForEvent(heat, event);
      const recommendation = matchingRecommendation(proposal, event);
      if (!proposal || !recommendation) continue;
      const actualAmount = Number(eventAmount(event));
      const recommendedAmount = Number(recommendation.amount?.midpoint);
      if (!(actualAmount > 0) || !(recommendedAmount > 0)) continue;
      const effect = effectDefinition(recommendation);
      const timingProposal = timingProposalForEvent(heat, event);
      const timingRecommendation = matchingRecommendation(timingProposal, event);
      const timingStart = time(timingRecommendation?.timing?.startAt);
      const timingEnd = time(timingRecommendation?.timing?.endAt);
      const timingReference = Number.isFinite(timingStart) ? (Number.isFinite(timingEnd) ? (timingStart + timingEnd) / 2 : timingStart) : NaN;
      const actualTimingOffsetMinutes = Number.isFinite(timingReference) ? (time(event.occurredAt) - timingReference) / 60000 : null;
      const currentTimingShift = Number(timingRecommendation?.coefficientSnapshot?.timingShiftMinutes ?? 0);
      const inferredTimingShift = finite(actualTimingOffsetMinutes) ? currentTimingShift + Number(actualTimingOffsetMinutes) : null;
      const before = analyses.filter((analysis) => time(analysis.sampledAt) <= time(event.occurredAt)).at(-1) ?? null;
      const after = analyses.find((analysis) => time(analysis.sampledAt) > time(event.occurredAt)) ?? null;
      const interfering = after ? activeActions.filter((other) => other.id !== event.id && time(other.occurredAt) > time(event.occurredAt) && time(other.occurredAt) < time(after.sampledAt)) : [];
      const expectedForActual = finite(effect.expected) ? Number(effect.expected) * actualAmount / recommendedAmount : null;
      const actualDelta = before && after && effect.element && finite(before.values?.[effect.element]) && finite(after.values?.[effect.element])
        ? Number(after.values[effect.element]) - Number(before.values[effect.element])
        : null;
      const effectRatio = finite(actualDelta) && finite(expectedForActual) && Math.abs(Number(expectedForActual)) > 1e-12
        ? Number(actualDelta) / Number(expectedForActual)
        : null;
      const correctionKey = CORRECTION_KEYS[recommendation.model] ?? null;
      const currentCorrection = Number(recommendation.coefficientSnapshot?.[correctionKey] ?? 1);
      const inferredCorrection = finite(effectRatio) && Number(effectRatio) > 0.2 && Number(effectRatio) < 5
        ? currentCorrection / Number(effectRatio)
        : null;
      const row = {
        id: `${heat.id}:${event.id}:${proposal.id}`,
        heatId: heat.id,
        eventId: event.id,
        proposalId: proposal.id,
        occurredAt: event.occurredAt,
        recordedBy: event.recordedBy?.displayName ?? "미입력",
        gradeCode: heat.gradeCode,
        equipmentProfileId: heat.equipmentProfileId,
        model: recommendation.model,
        materialCode: recommendation.materialCode,
        actualAmount,
        recommendedAmount,
        amountUnit: recommendation.amount.unit,
        element: effect.element,
        unit: effect.unit,
        beforeAnalysisId: before?.analysisId ?? null,
        afterAnalysisId: after?.analysisId ?? null,
        beforeValue: before && effect.element && finite(before.values?.[effect.element]) ? Number(before.values[effect.element]) : null,
        afterValue: after && effect.element && finite(after.values?.[effect.element]) ? Number(after.values[effect.element]) : null,
        expectedDelta: expectedForActual,
        actualDelta,
        residual: finite(actualDelta) && finite(expectedForActual) ? Number(actualDelta) - Number(expectedForActual) : null,
        effectRatio,
        correctionKey,
        currentCorrection,
        inferredCorrection,
        isolated: interfering.length === 0,
        interferingEventIds: interfering.map((item) => item.id),
        targetHit: after && effect.element ? targetHit(after.values?.[effect.element], targetForElement(heat, effect.element)) : null,
        formulaVersion: proposal.result?.profile?.formulaVersion ?? recommendation.formulaVersion ?? "unknown",
        profileId: proposal.result?.profile?.id ?? recommendation.profileId ?? "unknown",
        profileVersionId: proposal.result?.profile?.versionId ?? recommendation.profileVersionId ?? "legacy",
        timingProposalId: timingProposal?.id ?? null,
        recommendedTimingStartAt: timingRecommendation?.timing?.startAt ?? null,
        recommendedTimingEndAt: timingRecommendation?.timing?.endAt ?? null,
        actualTimingOffsetMinutes,
        currentTimingShift,
        inferredTimingShift,
        referenceMode: heat.referenceSnapshot?.mode ?? (heat.demo ? "demo_snapshot" : "manual_reference"),
        synthetic: Boolean(heat.demo || heat.referenceSnapshot?.mode !== "manual_reference"),
      };
      row.eligible = Boolean(row.correctionKey && finite(row.inferredCorrection) && row.isolated && row.beforeAnalysisId && row.afterAnalysisId);
      row.timingEligible = Boolean(row.eligible && row.targetHit === true && row.timingProposalId && finite(row.inferredTimingShift));
      row.exclusionReason = row.eligible ? null
        : recommendation.model === "flux" ? "slag_result_missing"
          : !before ? "before_analysis_missing"
            : !after ? "after_analysis_missing"
              : interfering.length ? "confounded_by_other_action"
                : !finite(actualDelta) ? "effect_value_missing"
                  : !finite(inferredCorrection) ? "effect_direction_or_outlier"
                    : "not_learning_eligible";
      row.groupKey = groupKey(row);
      rows.push(row);
    }
  }
  return rows.sort((a, b) => time(a.occurredAt) - time(b.occurredAt));
}

export function additionEvidenceGroups(rows) {
  const groups = new Map();
  for (const source of rows) {
    const candidates = [];
    if (source.eligible) candidates.push(source);
    if (source.timingEligible) candidates.push({ ...source, id: `${source.id}:timing`, correctionKey: "timingShiftMinutes", currentCorrection: source.currentTimingShift, inferredCorrection: source.inferredTimingShift, operatingBand: Number(source.actualTimingOffsetMinutes) < -1 ? "early" : Number(source.actualTimingOffsetMinutes) > 1 ? "late" : "middle" });
    for (const row of candidates) {
      const key = `${row.groupKey}|${row.correctionKey}`;
      if (!groups.has(key)) groups.set(key, { key, groupKey: row.groupKey, correctionKey: row.correctionKey, profileVersionId: row.profileVersionId, model: row.model, materialCode: row.materialCode, rows: [], synthetic: false });
      const group = groups.get(key);
      group.rows.push(row);
      group.synthetic ||= row.synthetic;
    }
  }
  return [...groups.values()];
}
