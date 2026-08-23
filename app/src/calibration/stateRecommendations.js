import { residualGroups } from "./residualLedger.js";
import { buildCalibrationRecommendations } from "./recommendation.js";

export function buildStateCalibrationRecommendations(state, rows) {
  return residualGroups(rows).flatMap((group) => {
    const latest = group.rows.at(-1);
    const profile = (state.settings?.coefficientProfiles ?? []).find((item) => item.id === latest?.coefficientId);
    return buildCalibrationRecommendations(group.rows, profile?.calibrationOffsets ?? {}, profile?.versionId ?? null);
  });
}
