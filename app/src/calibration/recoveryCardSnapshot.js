import { resolveCoefficientProfile } from "../calculation/coefficientProfile.js";
import { coefficientBaseFingerprint, coreRecoveryCheckCode, encodeCoreRecoveryString } from "./recoveryCardCodec.js";
import { RECOVERY_CARD_FIELDS, normalizeRecoveryOffsets } from "./recoveryCardFields.js";

function groupParts(groupKey = "") {
  const [gradeCode = "–", equipmentProfileId = "–", formulaVersion = "–", coefficientVersionId = "–", mode = "–"] = groupKey.split("|");
  return { gradeCode, equipmentProfileId, formulaVersion, coefficientVersionId, mode };
}

export function recoveryCardGroupOptions(trainingRuns = [], profile) {
  if (!profile) return [];
  const groups = new Map();
  for (const run of trainingRuns) {
    if (!run.groupKey || run.coefficientVersionId !== profile.versionId) continue;
    if (!groups.has(run.groupKey)) groups.set(run.groupKey, {
      groupKey: run.groupKey,
      ...groupParts(run.groupKey),
      status: run.status,
      synthetic: Boolean(run.synthetic),
      latestAt: run.createdAt,
      elementKeys: new Set(),
    });
    const group = groups.get(run.groupKey);
    group.elementKeys.add(run.element);
    if (new Date(run.createdAt) > new Date(group.latestAt)) group.latestAt = run.createdAt;
    if (run.status === "current") group.status = "current";
  }
  return [...groups.values()].map(({ elementKeys, ...group }) => ({ ...group, elementCount: elementKeys.size })).sort((a, b) => {
    if (a.synthetic !== b.synthetic) return a.synthetic ? 1 : -1;
    if (a.status !== b.status) return a.status === "current" ? -1 : 1;
    return new Date(b.latestAt) - new Date(a.latestAt);
  });
}

function latestRun(trainingRuns, groupKey, element, profile) {
  return trainingRuns
    .filter((run) => run.groupKey === groupKey && run.element === element && run.coefficientVersionId === profile.versionId)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "current" ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    })[0] ?? null;
}

export async function buildRecoveryCardSnapshot({ profile, trainingRuns = [], groupKey = "", operatorName = "", generatedAt = new Date().toISOString() }) {
  if (!profile) throw new Error("recovery_profile_missing");
  const offsets = normalizeRecoveryOffsets(profile.calibrationOffsets);
  const baseFingerprint = await coefficientBaseFingerprint(profile);
  const core = {
    profileId: profile.id,
    coefficientVersionId: profile.versionId,
    formulaVersion: profile.formulaVersion,
    baseFingerprint,
    offsets,
  };
  const checkCode = await coreRecoveryCheckCode(core);
  const recoveryString = await encodeCoreRecoveryString(core);
  const resolved = resolveCoefficientProfile(profile);
  const rows = RECOVERY_CARD_FIELDS.map((field) => {
    const run = groupKey ? latestRun(trainingRuns, groupKey, field.key, profile) : null;
    return {
      ...field,
      appliedOffset: offsets[field.key],
      learningCurrentOffset: run?.currentOffset ?? null,
      recommendedDelta: run?.recommendedDelta ?? null,
      candidateOffset: run?.candidateOffset ?? null,
      evidenceCount: run?.usedRowIds?.length ?? 0,
      heatCount: run?.usedHeatIds?.length ?? 0,
      stage: run?.stage ?? "no_evidence",
      status: run?.status ?? "missing",
      synthetic: Boolean(run?.synthetic),
      eligibleForApproval: Boolean(run?.eligibleForApproval),
      runId: run?.id ?? null,
    };
  });
  return {
    cardVersion: "BOFRC1",
    generatedAt,
    operatorName: String(operatorName ?? "").trim(),
    profile: {
      id: profile.id,
      nameKo: profile.nameKo,
      nameEn: profile.nameEn,
      versionId: profile.versionId,
      formulaVersion: profile.formulaVersion,
      basisStatus: resolved.status,
    },
    baseFingerprint,
    checkCode,
    recoveryString,
    group: groupKey ? { groupKey, ...groupParts(groupKey) } : null,
    rows,
  };
}
