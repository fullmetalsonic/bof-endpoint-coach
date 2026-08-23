import { getStageWorkflow } from "../domain/workflowGuidance.js";
import { Plus } from "@phosphor-icons/react";
import { isActiveHeat } from "../domain/processStages.js";
import { heatGradeProfile } from "../domain/referenceSnapshot.js";
import { calculateEndpoint, qualityRows } from "../calculation/endpoint.js";
import { getOpenChecks } from "../domain/operationalGuidance.js";

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

function latestActivityAt(heat) {
  return [...(heat.events ?? []), ...(heat.stageHistory ?? []), ...(heat.samples ?? []).flatMap((sample) => [sample, ...(sample.analysisResults ?? [])])]
    .map((item) => item.recordedAt ?? item.occurredAt ?? item.analyzedAt ?? item.sampledAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] ?? heat.startedAt;
}

function freshness(value, locale) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return locale === "ko" ? "방금" : "now";
  return locale === "ko" ? `${minutes}분 전` : `${minutes}m ago`;
}

export function HeatSummaryBar({ heat, heats, settings, locale, t, selectHeat, calculation, onNewHeat, writeLocked = false }) {
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
  const referenceLabel = calculation.referenceMode === "demo_data"
    ? (locale === "ko" ? "DEMO 데이터" : "DEMO data")
    : calculation.referenceMode === "demo_reference"
      ? (locale === "ko" ? "DEMO 기준" : "DEMO reference")
      : (locale === "ko" ? "수동 입력" : "Manual input");
  const activeHeatSummaries = heats.filter(isActiveHeat).map((item) => {
    const itemCalculation = item.id === heat.id ? calculation : calculateEndpoint(item, settings);
    const checks = getOpenChecks(item, qualityRows(item, settings, itemCalculation), locale);
    return { heat: item, checks, danger: checks.filter((check) => check.severity === "danger").length, activityAt: latestActivityAt(item) };
  });
  return (
    <section className="heat-context" aria-label={t("activeHeats")}>
      <div className="heat-tabs">
        <span>{t("activeHeats")} {heats.filter(isActiveHeat).length}</span>
        {activeHeatSummaries.map((item) => (
          <button key={item.heat.id} type="button" className={item.heat.id === heat.id ? "selected" : ""} onClick={() => selectHeat(item.heat.id)} aria-label={`${item.heat.id}, ${item.heat.stage}, ${item.checks.length} checks`}><strong>{item.heat.id} · {item.heat.stage}</strong><small>{freshness(item.activityAt, locale)} · {locale === "ko" ? `확인 ${item.checks.length}` : `${item.checks.length} checks`}</small>{item.danger > 0 && <b>{item.danger}</b>}</button>
        ))}
        <button className="add-heat" type="button" onClick={onNewHeat} disabled={writeLocked}><Plus /> {t("newHeat")}</button>
      </div>
      <div className="summary-grid">
        {summary.map(([label, value], index) => (
          <div className="summary-cell" key={label}>
            <span>{label}</span>
            <strong className={index === 7 ? "accent" : ""} title={value || "–"}>{value || "–"}</strong>
          </div>
        ))}
      </div>
      <div className="summary-status-tags"><span className={`summary-demo-tag ${calculation.referenceMode ?? ""}`}>{referenceLabel}</span><span className={`summary-basis-tag ${calculation.basis?.status ?? ""}`}>{locale === "ko" ? calculation.basis?.labelKo : calculation.basis?.labelEn}</span></div>
    </section>
  );
}
