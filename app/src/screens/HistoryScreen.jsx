import { calculateEndpoint } from "../calculation/endpoint.js";

export function HistoryScreen({ state, locale, t, onSelect }) {
  return (
    <main className="workspace-screen history-screen" data-testid="history-screen">
      <div className="workspace-heading"><div><span>Data Ledger</span><h1>{t("historyTitle")}</h1><p>{locale === "ko" ? "완료·진행 차지의 입력과 계산 버전을 다시 확인합니다." : "Review inputs and calculation versions for active and completed heats."}</p></div></div>
      <section className="panel history-table"><table><thead><tr><th>{t("heatNo")}</th><th>{t("grade")}</th><th>{t("status")}</th><th>{t("stage")}</th><th>C {t("endpointEstimate")}</th><th>T {t("endpointEstimate")}</th><th>{t("details")}</th></tr></thead><tbody>{state.heats.map((heat) => { const calc = calculateEndpoint(heat, state.settings); return <tr key={heat.id}><td><strong>{heat.id}</strong></td><td>{heat.gradeCode}</td><td><span className={`status-pill ${heat.status}`}>{t(heat.status === "completed" ? "completed" : "inProgress")}</span></td><td>{heat.stage}</td><td>{calc.carbon.available ? `${calc.carbon.value.toFixed(3)} %` : "–"}</td><td>{calc.temperature.available ? `${calc.temperature.value.toFixed(0)} °C` : "–"}</td><td><button type="button" onClick={() => onSelect(heat.id)}>{t("details")}</button></td></tr>; })}</tbody></table></section>
    </main>
  );
}
