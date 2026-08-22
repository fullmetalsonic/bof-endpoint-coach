import { calculateEndpoint, qualityRows } from "../calculation/endpoint.js";
import { HeatSummaryBar } from "../components/HeatSummaryBar.jsx";
import { ProcessRail } from "../components/ProcessRail.jsx";
import { ReviewSummary } from "../components/ReviewSummary.jsx";
import { QualityPanel } from "../components/QualityPanel.jsx";
import { AnalysisTable } from "../components/AnalysisTable.jsx";
import { DataLedger } from "../components/DataLedger.jsx";
import { ActionBar } from "../components/ActionBar.jsx";
import { StageControls } from "../components/StageControls.jsx";
import { getActionAvailability } from "../domain/processStages.js";

export function Dashboard({ state, heat, locale, t, selectHeat, saveStatus, onAction, onAdvance, onNewHeat, now }) {
  const calculation = calculateEndpoint(heat, state.settings, now.toISOString());
  const rows = qualityRows(heat, state.settings, calculation);
  return (
    <>
      <HeatSummaryBar heat={heat} heats={state.heats} settings={state.settings} locale={locale} t={t} selectHeat={selectHeat} calculation={calculation} onNewHeat={onNewHeat} />
      <div className="dashboard-shell" data-testid="dashboard-screen">
        <ProcessRail heat={heat} locale={locale} />
        <main className="dashboard-main">
          <div className="dashboard-title-row"><h1>{heat.stage} {locale === "ko" ? heat.stageLabelKo : heat.stageLabelEn} {t("summary")}</h1><StageControls heat={heat} locale={locale} onAdvance={onAdvance} /></div>
          <ReviewSummary heat={heat} locale={locale} rows={rows} t={t} />
          <QualityPanel rows={rows} locale={locale} t={t} />
          <AnalysisTable heat={heat} t={t} />
          <p className="calculation-footnote">※ {t("validationWarning")} · {locale === "ko" ? calculation.basis?.labelKo : calculation.basis?.labelEn} · {t("literatureScenarioRange")}: {calculation.carbon.available ? `${calculation.carbon.low.toFixed(3)}–${calculation.carbon.high.toFixed(3)} %` : "–"} / {calculation.temperature.available ? `${calculation.temperature.low.toFixed(0)}–${calculation.temperature.high.toFixed(0)} °C` : "–"}</p>
        </main>
        <DataLedger heat={heat} calculation={calculation} rows={rows} saveStatus={saveStatus} t={t} locale={locale} />
      </div>
      <ActionBar t={t} onAction={onAction} availability={getActionAvailability(heat)} />
    </>
  );
}
