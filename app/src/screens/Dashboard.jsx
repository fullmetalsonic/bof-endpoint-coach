import { calculateEndpoint, qualityRows } from "../calculation/endpoint.js";
import { HeatSummaryBar } from "../components/HeatSummaryBar.jsx";
import { ProcessRail } from "../components/ProcessRail.jsx";
import { WorkflowPanel } from "../components/WorkflowPanel.jsx";
import { QualityPanel } from "../components/QualityPanel.jsx";
import { AnalysisTable } from "../components/AnalysisTable.jsx";
import { DataLedger } from "../components/DataLedger.jsx";
import { ActionBar } from "../components/ActionBar.jsx";
import { getActionAvailability } from "../domain/processStages.js";
import { getStageWorkflow } from "../domain/workflowGuidance.js";
import { canRollbackLastStage } from "../domain/correctionOperations.js";
import { SampleResidualPanel } from "../components/SampleResidualPanel.jsx";

export function Dashboard({ state, heat, locale, t, selectHeat, saveStatus, canWrite = true, onAction, onAdvance, onEditInitial, onNewHeat, onOpenTimeline, onOpenCorrection, onRollback }) {
  // 조업값 저장으로 다시 렌더링되는 바로 그 시점의 계산 시각을 남긴다.
  // 상단 시계의 저빈도 갱신값을 재사용하면 방금 입력한 공정 시각보다 계산 시각이 과거로 보일 수 있다.
  const calculation = calculateEndpoint(heat, state.settings, new Date().toISOString());
  const rows = qualityRows(heat, state.settings, calculation);
  const workflow = getStageWorkflow(heat, locale);
  return (
    <>
      <HeatSummaryBar heat={heat} heats={state.heats} settings={state.settings} locale={locale} t={t} selectHeat={selectHeat} calculation={calculation} onNewHeat={onNewHeat} writeLocked={!canWrite} />
      <div className="dashboard-shell" data-testid="dashboard-screen">
        <ProcessRail heat={heat} locale={locale} />
        <main className="dashboard-main">
          <div className="dashboard-title-row"><h1>{heat.stage} {locale === "ko" ? heat.stageLabelKo : heat.stageLabelEn} {t("summary")}</h1><div className="dashboard-title-actions"><span>{locale === "ko" ? "입력 → 확인 → 단계 전환" : "Enter → verify → advance"}</span>{canRollbackLastStage(heat) && <button type="button" className="stage-undo-button" disabled={!canWrite} onClick={onRollback}>{locale === "ko" ? "마지막 단계 전환 취소" : "Undo last stage"}</button>}</div></div>
          <WorkflowPanel heat={heat} locale={locale} rows={rows} t={t} onAction={onAction} onAdvance={onAdvance} onEditInitial={onEditInitial} writeLocked={!canWrite} />
          <QualityPanel rows={rows} locale={locale} t={t} />
          <SampleResidualPanel heat={heat} settings={state.settings} calculation={calculation} locale={locale} />
          <AnalysisTable heat={heat} t={t} locale={locale} onCorrection={onOpenCorrection} onOpenTimeline={onOpenTimeline} />
          <p className="calculation-footnote">※ {t("validationWarning")} · {locale === "ko" ? calculation.basis?.labelKo : calculation.basis?.labelEn} · {t("literatureScenarioRange")}: {calculation.carbon.available ? `${calculation.carbon.low.toFixed(3)}–${calculation.carbon.high.toFixed(3)} %` : "–"} / {calculation.temperature.available ? `${calculation.temperature.low.toFixed(0)}–${calculation.temperature.high.toFixed(0)} °C` : "–"}</p>
        </main>
        <DataLedger heat={heat} calculation={calculation} rows={rows} saveStatus={saveStatus} t={t} locale={locale} />
      </div>
      <ActionBar t={t} locale={locale} onAction={onAction} availability={getActionAvailability(heat)} recommendedAction={workflow.recommendedAction} writeLocked={!canWrite} />
    </>
  );
}
