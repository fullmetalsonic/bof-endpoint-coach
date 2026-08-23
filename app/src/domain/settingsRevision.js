import { versionCoefficientProfiles } from "./coefficientVersions.js";

const EXCLUDED_PATHS = new Set(["version", "revisionHistory", "lastRevision", "versionHistory"]);

function flatten(value, prefix = "", output = {}) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, output));
    return output;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      if (EXCLUDED_PATHS.has(key)) return;
      flatten(item, prefix ? `${prefix}.${key}` : key, output);
    });
    return output;
  }
  output[prefix] = value ?? null;
  return output;
}

export function diffSettings(previous, next) {
  const before = flatten(previous);
  const after = flatten(next);
  const paths = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...paths]
    .filter((path) => JSON.stringify(before[path]) !== JSON.stringify(after[path]))
    .sort()
    .map((path) => ({ path, before: before[path] ?? null, after: after[path] ?? null }));
}

export function localSettingsVersion(at = new Date()) {
  const digits = at.toISOString().replace(/[-:TZ.]/g, "");
  return `LOCAL-REF-${digits.slice(0, 17)}`;
}

export function prepareSettingsRevision(current, draft, operatorProfile, reason, at = new Date()) {
  const versionedDraft = {
    ...structuredClone(draft),
    coefficientProfiles: versionCoefficientProfiles(current.coefficientProfiles, draft.coefficientProfiles, operatorProfile, reason, at),
  };
  const changes = diffSettings(current, versionedDraft);
  if (!changes.length) return current;
  const changedAt = at.toISOString();
  const revision = {
    id: `SETREV-${crypto.randomUUID()}`,
    previousVersion: current.version ?? null,
    version: localSettingsVersion(at),
    changedAt,
    changedBy: operatorProfile?.displayName?.trim() || "미입력",
    reason: reason?.trim() || "설정 변경",
    changes,
  };
  return {
    ...versionedDraft,
    version: revision.version,
    revisionHistory: [...(current.revisionHistory ?? []), revision],
    lastRevision: revision,
  };
}
