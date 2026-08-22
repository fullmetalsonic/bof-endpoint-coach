import { getStageGuidance } from "../domain/operationalGuidance.js";
import { Plus } from "@phosphor-icons/react";
import { isActiveHeat } from "../domain/processStages.js";

function formatTime(value) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export function HeatSummaryBar({ heat, heats, settings, locale, t, selectHeat, calculation, onNewHeat }) {
  const grade = settings.gradeProfiles.find((item) => item.code === heat.gradeCode);
  const target = grade?.targets?.C;
  const guidance = getStageGuidance(heat.stage, locale);
  const elapsedEnd = heat.completedAt ?? heat.cancelledAt ?? calculation.calculatedAt;
  const elapsedMinutes = Math.max(0, Math.floor((new Date(elapsedEnd) - new Date(heat.startedAt)) / 60000));
  const summary = [
    [t("heatNo"), heat.id],
    [t("grade"), locale === "ko" ? grade?.nameKo : grade?.nameEn],
    [t("targetCarbon"), target ? `${target.min.toFixed(3)}–${target.max.toFixed(3)} %` : "–"],
    [t("currentStage"), `${heat.stage}  ${locale === "ko" ? heat.stageLabelKo : heat.stageLabelEn}`],
    [t("elapsed"), locale === "ko" ? `${elapsedMinutes} 분` : `${elapsedMinutes} min`],
    [t("oxygen"), `${Number(heat.process.cumulativeOxygenNm3).toLocaleString()} Nm³`],
    [t("expectedTap"), formatTime(heat.expectedTapAt)],
    [t("nextAction"), guidance.title],
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
