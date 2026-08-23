import { QualityBar } from "./QualityBar.jsx";

export function QualityPanel({ rows, explanations = {}, locale, t }) {
  return (
    <section className="quality-panel panel">
      <div className="panel-title quality-title-row">
        <h2>{t("qualityTitle")}</h2>
        <div className="legend"><span><i className="dot actual" />{t("currentActual")}</span><span><i className="dot predicted" />{t("endpointEstimate")}</span><span><i className="line" />{t("targetRange")}</span></div>
      </div>
      <div className="quality-list">
        {rows.map((row) => <QualityBar key={row.key} row={row} explanation={explanations[row.key]} locale={locale} t={t} />)}
      </div>
    </section>
  );
}
