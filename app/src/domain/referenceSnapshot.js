function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function captureHeatReferenceSnapshot(settings, selection, capturedAt = new Date().toISOString()) {
  return {
    capturedAt,
    settingsVersion: settings.version ?? null,
    gradeProfile: clone(settings.gradeProfiles?.find((item) => item.code === selection.gradeCode) ?? null),
    equipmentProfile: clone(settings.equipmentProfiles?.find((item) => item.id === selection.equipmentProfileId) ?? null),
    coefficientProfile: clone(settings.coefficientProfiles?.find((item) => item.id === selection.coefficientProfileId) ?? null),
  };
}

export function resolveHeatSettings(heat, currentSettings) {
  const snapshot = heat?.referenceSnapshot;
  if (!snapshot?.gradeProfile || !snapshot?.equipmentProfile || !snapshot?.coefficientProfile) return currentSettings;
  return {
    ...currentSettings,
    version: snapshot.settingsVersion ?? currentSettings.version,
    gradeProfiles: [clone(snapshot.gradeProfile)],
    equipmentProfiles: [clone(snapshot.equipmentProfile)],
    coefficientProfiles: [clone(snapshot.coefficientProfile)],
  };
}

export function heatGradeProfile(heat, currentSettings) {
  return resolveHeatSettings(heat, currentSettings).gradeProfiles.find((item) => item.code === heat.gradeCode);
}

export function heatReferenceMode(heat, currentSettings) {
  const effective = resolveHeatSettings(heat, currentSettings);
  const grade = effective.gradeProfiles.find((item) => item.code === heat.gradeCode);
  const equipment = effective.equipmentProfiles.find((item) => item.id === heat.equipmentProfileId);
  if (heat.demo) return "demo_data";
  if (grade?.status === "demo" || equipment?.status === "demo" || String(grade?.code ?? "").startsWith("DEMO-") || String(equipment?.id ?? "").includes("DEMO")) return "demo_reference";
  return "manual_reference";
}
