import { calculateEndpoint, qualityRows } from "../calculation/endpoint.js";
import { HeatSummaryBar } from "../components/HeatSummaryBar.jsx";
import { ProcessRail } from "../components/ProcessRail.jsx";
import { ReviewSummary } from "../components/ReviewSummary.jsx";
import { QualityPanel } from "../components/QualityPanel.jsx";
import { AnalysisTable } from "../components/AnalysisTable.jsx";
import { DataLedger } from "../components/DataLedger.jsx";
import { ActionBar } from "../components/ActionBar.jsx";

export function Dashboard({ state, heat, locale, t, selectHeat, saveStatus, onAction, onNewHeat, now }) {
  const calculation = calculateEndpoint(heat, state.settings, now.toISOString());
  const rows = qualityRows(heat, state.settings, calculation);
  return (
    <>
      <HeatSummaryBar heat={heat} heats={state.heats} settings={state.settings} locale={locale} t={t} selectHeat={selectHeat} calculation={calculation} onNewHeat={onNewHeat} />
      <div className="dashboard-shell" data-testid="dashboard-screen">
        <ProcessRail heat={heat} locale={locale} calculatedAt={calculation.calculatedAt} />
        <main className="dashboard-main">
          <h1>{heat.stage} {locale === "ko" ? heat.stageLabelKo : heat.stageLabelEn} {t("summary")}</h1>
          <ReviewSummary heat={heat} locale={locale} rows={rows} t={t} />
          <QualityPanel rows={rows} locale={locale} t={t} />
          <AnalysisTable heat={heat} t={t} />
          <p className="calculation-footnote">※ {t("validationWarning")} · {t("demoOnly")}</p>
        </main>
        <DataLedger heat={heat} calculation={calculation} rows={rows} saveStatus={saveStatus} t={t} locale={locale} />
      </div>
      <ActionBar t={t} onAction={onAction} />
    </>
  );
}
