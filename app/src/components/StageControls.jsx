import { ArrowRight, WarningCircle } from "@phosphor-icons/react";
import { getNextStage, validateStageAdvance } from "../domain/processStages.js";

export function StageControls({ heat, locale, onAdvance }) {
  const next = getNextStage(heat.stage);
  const validation = validateStageAdvance(heat);
  const ko = locale === "ko";
  if (!next || heat.stage === "G6") return <div className="stage-controls"><span>{heat.stage === "G6" ? (ko ? "출강 기록 후 G7로 이동합니다." : "Record tap to move to G7.") : (ko ? "최종 단계입니다." : "Final stage.")}</span></div>;
  const reason = validation.reason === "endpoint_sample_required" ? (ko ? "C·온도가 입력된 채택 샘플이 필요합니다." : "An adopted sample with C and temperature is required.") : "";
  return (
    <div className="stage-controls">
      {reason && <span className="stage-blocked"><WarningCircle />{reason}</span>}
      <button type="button" disabled={!validation.ok} onClick={onAdvance}>{heat.stage} → {next.code} · {ko ? next.labelKo : next.labelEn}<ArrowRight /></button>
    </div>
  );
}
