const IMPORTANT_TYPES = new Set([
  "event_tap",
  "actual_endpoint_selected",
  "tap_corrected",
  "settings_updated",
  "coefficient_version_restored",
  "json_backup_restored",
  "backup_restored",
]);

function validDate(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function backupStatus(state, now = new Date()) {
  const logs = state?.operationLog ?? [];
  const lastJson = [...logs].reverse().find((entry) => entry.type === "json_backup_exported" && entry.readVerified);
  const lastJsonAt = validDate(lastJson?.at);
  const changes = logs.filter((entry) => {
    const at = validDate(entry.at);
    return at && (!lastJsonAt || at > lastJsonAt) && entry.type !== "json_backup_exported";
  });
  const importantChange = [...changes].reverse().find((entry) => IMPORTANT_TYPES.has(entry.type));
  const newestChange = changes.map((entry) => validDate(entry.at)).filter(Boolean).sort((a, b) => b - a)[0] ?? null;
  const ageHours = lastJsonAt ? Math.max(0, (now - lastJsonAt) / 3_600_000) : Infinity;
  const hasOperationalData = Boolean((state?.heats ?? []).length || logs.length || (state?.settings?.revisionHistory ?? []).length);
  const overdueChange = newestChange && ageHours >= 24;
  const required = hasOperationalData && (!lastJson || Boolean(importantChange) || Boolean(overdueChange));
  return {
    status: required ? "needed" : "current",
    required,
    lastJsonAt: lastJson?.at ?? null,
    lastJson,
    importantChangeType: importantChange?.type ?? null,
    pendingChangeCount: changes.length,
    ageHours,
    reason: !lastJson ? "never_exported" : importantChange ? "important_change" : overdueChange ? "changed_over_24h" : "current",
  };
}
