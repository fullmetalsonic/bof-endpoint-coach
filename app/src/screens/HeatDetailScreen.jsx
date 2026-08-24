import { ArrowLeft, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { canRollbackLastStage, latestActiveTapEvent, timelineRecords } from "../domain/correctionOperations.js";
import { endpointValidationComparison } from "../domain/predictionHistory.js";

function formatTime(value, locale) {
  if (!value) return "–";
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-GB", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value));
}

function formatValue(value, digits = 3) {
  return value !== null && value !== undefined && Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : "–";
}

function statusText(status, locale) {
  const labels = { active: ["유효", "Active"], superseded: ["정정됨", "Superseded"], voided: ["무효", "Voided"] };
  return labels[status]?.[locale === "ko" ? 0 : 1] ?? status;
}

export function HeatDetailScreen({ heat, locale, onBack, onDashboard, onCorrection, onAdopt, onActual }) {
  const ko = locale === "ko";
  const records = timelineRecords(heat);
  const comparison = endpointValidationComparison(heat);
  const tap = latestActiveTapEvent(heat);
  const comparisonItems = [
    { key: "C", predictionKey: "carbon", errorKey: "carbonError", digits: 3, unit: "%" },
    { key: "temperature", predictionKey: "temperature", errorKey: "temperatureError", digits: 0, unit: "°C" },
    { key: "P", predictionKey: "phosphorus", errorKey: "phosphorusError", digits: 3, unit: "%" },
    { key: "Mn", predictionKey: "manganese", errorKey: "manganeseError", digits: 3, unit: "%" },
    { key: "Si", predictionKey: "silicon", errorKey: "siliconError", digits: 3, unit: "%" },
    { key: "S", predictionKey: "sulfur", errorKey: "sulfurError", digits: 3, unit: "%" },
  ];
  return (
    <main className="workspace-screen heat-detail-screen" data-testid="heat-detail-screen">
      <div className="workspace-heading heat-detail-heading">
        <div><span>Correction Ledger</span><h1>{heat.id} · {ko ? "전체 이력·정정" : "Timeline and corrections"}</h1><p>{ko ? "원본 기록을 지우지 않고 수정·무효·채택 관계와 예상값 변화를 추적합니다." : "Track corrections, voids, adopted results, and prediction changes without deleting originals."}</p></div>
        <div className="heading-actions"><button type="button" className="secondary-button" onClick={onBack}><ArrowLeft />{ko ? "차지 이력" : "Heat history"}</button><button type="button" className="secondary-button" onClick={onDashboard}>{ko ? "대시보드 보기" : "Open dashboard"}</button></div>
      </div>

      <section className="detail-command-bar panel">
        <div><strong>{heat.stage} · {ko ? heat.stageLabelKo : heat.stageLabelEn}</strong><span>{ko ? `정정 이력 ${heat.correctionLog?.length ?? 0}건 · 예상 스냅샷 ${heat.predictionSnapshots?.length ?? 0}건` : `${heat.correctionLog?.length ?? 0} corrections · ${heat.predictionSnapshots?.length ?? 0} prediction snapshots`}</span></div>
        <div>{canRollbackLastStage(heat) && <button type="button" className="warning-button" onClick={() => onCorrection({ mode: "rollback", target: records.find((record) => record.kind === "stage" && record.status === "active" && record.stage === heat.stage) })}>{ko ? "마지막 단계 전환 취소" : "Undo last stage"}</button>}{tap && ["G7", "G8"].includes(heat.stage) && <button type="button" className="warning-button" onClick={() => onCorrection({ mode: "tap", target: { ...tap, kind: "event" } })}>{ko ? "출강 기록 정정" : "Correct tap record"}</button>}</div>
      </section>

      <section className="validation-comparison panel">
        <div className="panel-title"><h2>{ko ? "종점 예상 대 실제값 검증" : "Endpoint prediction vs actual"}</h2></div>
        <div className="comparison-grid">
          <div><span>{ko ? "비교 예상 시점" : "Prediction checkpoint"}</span><strong>{comparison.prediction ? `${comparison.prediction.stage} · ${formatTime(comparison.prediction.calculatedAt, locale)}` : "–"}</strong></div>
          {comparisonItems.map((item) => <div key={item.key}><span>{item.key === "temperature" ? (ko ? "온도 예상 / 실제 / 오차" : "Temperature predicted / actual / error") : `${item.key} ${ko ? "예상 / 실제 / 오차" : "predicted / actual / error"}`} ({item.unit})</span><strong>{formatValue(comparison.prediction?.[item.predictionKey]?.value, item.digits)} / {formatValue(comparison.actual?.values?.[item.key], item.digits)} / {formatValue(comparison[item.errorKey], item.digits)}</strong></div>)}
          <div className={comparison.actual ? "comparison-ready" : "comparison-missing"}>{comparison.actual ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}<span>{comparison.actual ? (ko ? `${comparison.sampleId} 분석을 종점 실제값으로 사용` : `${comparison.sampleId} selected as actual`) : ["G7", "G8"].includes(heat.stage) ? (ko ? "분석 결과에서 ‘종점 실제값 지정’을 선택하십시오." : "Select an analysis as the actual endpoint result.") : (ko ? "출강 이후 분석 결과를 종점 실제값으로 지정할 수 있습니다." : "An analysis can be set as actual after tapping.")}</span></div>
        </div>
      </section>

      <section className="panel timeline-panel">
        <div className="panel-title"><h2>{ko ? "차지 전체 타임라인" : "Full heat timeline"}</h2><span>{ko ? "유효·정정됨·무효 기록을 모두 표시" : "Shows active, superseded, and voided records"}</span></div>
        <div className="table-scroll"><table><thead><tr><th>{ko ? "발생 시각" : "Occurred"}</th><th>{ko ? "단계" : "Stage"}</th><th>{ko ? "기록" : "Record"}</th><th>{ko ? "상태" : "Status"}</th><th>{ko ? "입력자" : "Operator"}</th><th>{ko ? "관리" : "Actions"}</th></tr></thead><tbody>{records.map((record) => <tr key={`${record.kind}-${record.id}`} className={`record-${record.status}`}><td>{formatTime(record.occurredAt, locale)}</td><td>{record.stage ?? "–"}</td><td><strong>{ko ? record.summaryKo : record.summaryEn}</strong>{record.kind === "analysis" && <small>{record.adopted ? (ko ? "채택 결과" : "Adopted") : ""}{record.actual ? ` · ${ko ? "종점 실제값" : "Actual endpoint"}` : ""}{record.dissolvedOxygen?.recordStatus === "recorded" ? ` · [O] ${record.dissolvedOxygen.valuePpm} ppm` : ` · ${ko ? "용존산소 미측정" : "Dissolved oxygen not measured"}`}</small>}</td><td><span className={`record-status ${record.status}`}>{statusText(record.status, locale)}</span></td><td>{record.recordedBy?.displayName ?? "–"}</td><td><div className="timeline-actions">{record.correctable && <button type="button" onClick={() => onCorrection({ mode: "correct", target: record })}>{ko ? "수정" : "Correct"}</button>}{record.voidable && <button type="button" className="danger-link" onClick={() => onCorrection({ mode: "void", target: record })}>{ko ? "무효" : "Void"}</button>}{record.kind === "analysis" && record.status === "active" && !record.adopted && <button type="button" onClick={() => onAdopt(record.id)}>{ko ? "채택" : "Adopt"}</button>}{record.kind === "analysis" && record.status === "active" && !record.actual && ["G7", "G8"].includes(heat.stage) && <button type="button" onClick={() => onActual(record.id)}>{ko ? "종점 실제값" : "Set actual"}</button>}</div></td></tr>)}</tbody></table></div>
      </section>
    </main>
  );
}
