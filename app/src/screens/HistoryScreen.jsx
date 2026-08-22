import { calculateEndpoint } from "../calculation/endpoint.js";
import { canDeleteHeat } from "../domain/heatOperations.js";

function statusText(status, locale) {
  const labels = {
    in_progress: ["진행 중", "In progress"], tapped: ["출강 후", "Tapped"], completed: ["완료", "Completed"], cancelled: ["취소", "Cancelled"], archived: ["보관", "Archived"],
  };
  return labels[status]?.[locale === "ko" ? 0 : 1] ?? status;
}

export function HistoryScreen({ state, locale, t, onSelect, onLifecycle }) {
  return (
    <main className="workspace-screen history-screen" data-testid="history-screen">
      <div className="workspace-heading"><div><span>Data Ledger</span><h1>{t("historyTitle")}</h1><p>{locale === "ko" ? "완료·진행 차지의 입력과 계산 버전을 다시 확인합니다." : "Review inputs and calculation versions for active and completed heats."}</p></div></div>
      <section className="panel history-table"><table><thead><tr><th>{t("heatNo")}</th><th>{t("grade")}</th><th>{t("status")}</th><th>{t("stage")}</th><th>C {t("endpointEstimate")}</th><th>T {t("endpointEstimate")}</th><th>{t("details")}</th></tr></thead><tbody>{state.heats.map((heat) => { const calc = calculateEndpoint(heat, state.settings); return <tr key={heat.id}><td><strong>{heat.id}</strong></td><td>{heat.gradeCode}</td><td><span className={`status-pill ${heat.status}`}>{statusText(heat.status, locale)}</span></td><td>{heat.stage}</td><td>{calc.carbon.available ? `${calc.carbon.value.toFixed(3)} %` : "–"}</td><td>{calc.temperature.available ? `${calc.temperature.value.toFixed(0)} °C` : "–"}</td><td><div className="history-actions"><button type="button" onClick={() => onSelect(heat.id)}>{t("details")}</button>{canDeleteHeat(heat) && <button type="button" className="danger-link" onClick={() => onLifecycle(heat, "delete")}>{locale === "ko" ? "삭제" : "Delete"}</button>}{["in_progress", "tapped"].includes(heat.status) && !canDeleteHeat(heat) && <button type="button" className="danger-link" onClick={() => onLifecycle(heat, "cancel")}>{locale === "ko" ? "취소" : "Cancel"}</button>}{["completed", "cancelled"].includes(heat.status) && <button type="button" onClick={() => onLifecycle(heat, "archive")}>{locale === "ko" ? "보관" : "Archive"}</button>}</div></td></tr>; })}{state.heats.length === 0 && <tr><td colSpan="7">{locale === "ko" ? "저장된 차지가 없습니다." : "No saved heats."}</td></tr>}</tbody></table></section>
    </main>
  );
}
