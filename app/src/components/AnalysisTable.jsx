function format(value, decimals = 3) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value).toFixed(decimals) : "–";
}

function formatTime(value) {
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export function AnalysisTable({ heat, t, locale, onCorrection, onOpenTimeline }) {
  const ko = locale === "ko";
  const samples = [...heat.samples].filter((sample) => (sample.status ?? "active") === "active").sort((a, b) => new Date(b.sampledAt) - new Date(a.sampledAt)).slice(0, 4).map((sample) => {
    const activeResults = getActiveAnalysisResults(sample);
    const analysis = activeResults.find((result) => result.id === sample.adoptedAnalysisId) ?? activeResults.at(-1) ?? null;
    return { sample, analysis };
  });
  return (
    <section className="analysis-table panel">
      <div className="panel-title"><h2>{t("recentResults")}</h2><button type="button" className="table-header-action" onClick={onOpenTimeline}>{ko ? "전체 이력·정정" : "Full timeline"}</button></div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>{t("sampledAt")}</th><th>{t("stage")}</th><th>{t("sampleId")}</th><th>C (%)</th><th>Si (%)</th><th>Mn (%)</th><th>P (%)</th><th>S (%)</th><th>{t("currentActual")} T (°C)</th><th>{t("method")}</th><th>{ko ? "관리" : "Actions"}</th></tr></thead>
          <tbody>{samples.map(({ sample, analysis }) => <tr key={sample.id}><td>{formatTime(sample.sampledAt)}</td><td>{sample.stage}</td><td>{sample.id}</td><td>{format(analysis?.values?.C)}</td><td>{format(analysis?.values?.Si, 2)}</td><td>{format(analysis?.values?.Mn, 2)}</td><td>{format(analysis?.values?.P)}</td><td>{format(analysis?.values?.S)}</td><td>{format(analysis?.values?.temperature, 0)}</td><td><span className="analysis-method-cell">{analysis?.method ?? "Pending"}{analysis?.dissolvedOxygen?.recordStatus === "recorded" && <small>[O] {analysis.dissolvedOxygen.valuePpm} ppm</small>}</span></td><td><div className="sample-actions">{analysis ? <><button type="button" onClick={() => onCorrection({ mode: "correct", targetKind: "analysis", targetId: analysis.id })}>{ko ? "수정" : "Correct"}</button><button type="button" className="danger-link" onClick={() => onCorrection({ mode: "void", targetKind: "analysis", targetId: analysis.id })}>{ko ? "무효" : "Void"}</button></> : <button type="button" onClick={onOpenTimeline}>{ko ? "이력" : "Timeline"}</button>}</div></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}
import { getActiveAnalysisResults } from "../domain/analysisRecords.js";
