import { getStageWorkflow } from "../domain/workflowGuidance.js";
import { Plus } from "@phosphor-icons/react";
import { isActiveHeat } from "../domain/processStages.js";
import { heatGradeProfile } from "../domain/referenceSnapshot.js";

function formatTime(value) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function formatTarget(target) {
  const finite = (value) => value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
  if (!finite(target?.min) && !finite(target?.max)) return "–";
  const decimals = target?.decimals ?? 3;
  return `${finite(target?.min) ? Number(target.min).toFixed(decimals) : "–"}–${finite(target?.max) ? Number(target.max).toFixed(decimals) : "–"} ${target?.unit ?? "%"}`;
}

export function HeatSummaryBar({ heat, heats, settings, locale, t, selectHeat, calculation, onNewHeat }) {
  const grade = heatGradeProfile(heat, settings);
  const target = grade?.targets?.C;
  const workflow = getStageWorkflow(heat, locale);
  const elapsedEnd = heat.completedAt ?? heat.cancelledAt ?? calculation.calculatedAt;
  const elapsedMinutes = Math.max(0, Math.floor((new Date(elapsedEnd) - new Date(heat.startedAt)) / 60000));
  const summary = [
    [t("heatNo"), heat.id],
    [t("grade"), locale === "ko" ? grade?.nameKo : grade?.nameEn],
    [t("targetCarbon"), formatTarget(target)],
    [t("currentStage"), `${heat.stage}  ${locale === "ko" ? heat.stageLabelKo : heat.stageLabelEn}`],
    [t("elapsed"), locale === "ko" ? `${elapsedMinutes} 분` : `${elapsedMinutes} min`],
    [t("oxygen"), `${Number(heat.process.cumulativeOxygenNm3).toLocaleString()} Nm³`],
    [t("expectedTap"), formatTime(heat.expectedTapAt)],
    [t("nextAction"), workflow.current.title],
  ];
  return (
    <section className="heat-context" aria-label={t("activeHeats")}>
      <div className="heat-tabs">
        <span>{t("activeHeats")} {heats.filter(isActiveHeat).length}</span>
        {heats.filter(isActiveHeat).map((item) => (
          <button key={item.id} type="button" className={item.id === heat.id ? "selected" : ""} onClick={() => selectHeat(item.id)}>{item.id} · {item.stage}</button>
        ))}
        <button className="add-heat" type="button" onClick={onNewHeat}><Plus /> {t("newHeat")}</button>
      </div>
      <div className="summary-grid">
        {summary.map(([label, value], index) => (
          <div className="summary-cell" key={label}>
            <span>{label}</span>
            <strong className={index === 7 ? "accent" : ""} title={value || "–"}>{value || "–"}</strong>
          </div>
        ))}
      </div>
      <div className="summary-status-tags">{calculation.demo && <span className="summary-demo-tag">DEMO</span>}<span className={`summary-basis-tag ${calculation.basis?.status ?? ""}`}>{locale === "ko" ? calculation.basis?.labelKo : calculation.basis?.labelEn}</span></div>
    </section>
  );
}
