const VERSION_METADATA = new Set(["versionId", "parentVersionId", "createdAt", "versionHistory", "restoredFromVersionId"]);

function comparable(profile) {
  return Object.fromEntries(Object.entries(profile ?? {}).filter(([key]) => !VERSION_METADATA.has(key)));
}

function snapshot(profile) {
  return structuredClone(Object.fromEntries(Object.entries(profile ?? {}).filter(([key]) => key !== "versionHistory")));
}

function versionId(profileId, at) {
  const digits = at.toISOString().replace(/[-:TZ.]/g, "");
  return `${profileId}-V-${digits.slice(0, 17)}`;
}

export function coefficientProfileChanged(previous, next) {
  return JSON.stringify(comparable(previous)) !== JSON.stringify(comparable(next));
}

export function versionCoefficientProfiles(previousProfiles, draftProfiles, operatorProfile, reason, at = new Date()) {
  return (draftProfiles ?? []).map((draft) => {
    const previous = (previousProfiles ?? []).find((item) => item.id === draft.id);
    if (!previous || !coefficientProfileChanged(previous, draft)) return structuredClone(draft);
    const changedAt = at.toISOString();
    const archived = {
      versionId: previous.versionId ?? `${previous.id}-LEGACY`,
      archivedAt: changedAt,
      archivedBy: operatorProfile?.displayName?.trim() || "미입력",
      changeReason: reason?.trim() || "계수 변경",
      profile: snapshot(previous),
    };
    return {
      ...structuredClone(draft),
      versionId: versionId(draft.id, at),
      parentVersionId: previous.versionId ?? null,
      createdAt: changedAt,
      restoredFromVersionId: draft.restoredFromVersionId ?? null,
      versionHistory: [...(previous.versionHistory ?? []), archived],
    };
  });
}

export function restoreCoefficientVersion(profile, targetVersionId) {
  const record = (profile.versionHistory ?? []).find((item) => item.versionId === targetVersionId);
  if (!record?.profile) return null;
  return {
    ...structuredClone(record.profile),
    id: profile.id,
    versionHistory: structuredClone(profile.versionHistory ?? []),
    versionId: profile.versionId,
    parentVersionId: profile.parentVersionId,
    createdAt: profile.createdAt,
    restoredFromVersionId: targetVersionId,
    modifiedAt: new Date().toISOString(),
  };
}
