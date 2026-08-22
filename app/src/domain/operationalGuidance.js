const elementNames = {
  ko: { C: "탄소", temperature: "온도", P: "인", Mn: "망간", Si: "규소", S: "황" },
  en: { C: "Carbon", temperature: "Temperature", P: "Phosphorus", Mn: "Manganese", Si: "Silicon", S: "Sulfur" },
};

export function getOpenChecks(heat, rows, locale = "ko") {
  const checks = [];
  if (["G5", "G6"].includes(heat.stage)) {
    checks.push({
      severity: "warning",
      text: locale === "ko" ? "출강 전 최종 샘플 채취" : "Take final pre-tap sample",
    });
  }

  rows.forEach((row) => {
    if (!row.prediction.available || !["low", "high"].includes(row.predictionState)) return;
    const direction = row.predictionState === "low"
      ? (locale === "ko" ? "하한 미달" : "below target")
      : (locale === "ko" ? "상한 초과" : "above target");
    checks.push({
      severity: "danger",
      text: locale === "ko"
        ? `${elementNames.ko[row.key]} 종점 예상 ${direction}`
        : `${elementNames.en[row.key]} endpoint estimate ${direction}`,
    });
  });

  if (checks.length === 0 && !["G7", "G8"].includes(heat.stage)) {
    const currentAction = getStageWorkflow(heat, locale).current.title;
    checks.push({
      severity: "warning",
      text: locale === "ko" ? `현재 작업: ${currentAction}` : `Current task: ${currentAction}`,
    });
  }
  return checks.slice(0, 4);
}
import { getStageWorkflow } from "./workflowGuidance.js";
