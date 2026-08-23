import { useMemo, useState } from "react";
import { ArrowRight, Database, Flask, Funnel, Lifebuoy, TrendUp, WarningCircle } from "@phosphor-icons/react";
import { buildResidualLedger } from "../calibration/residualLedger.js";
import { buildStateCalibrationRecommendations } from "../calibration/stateRecommendations.js";
import { learningEligibilitySummary } from "../calibration/trainingRun.js";
import { TrainingRunTable } from "../components/TrainingRunTable.jsx";

const STAGE_LABELS = {
  synthetic_only: ["DEMO 전용 · 현장 적용 금지", "DEMO only · not field eligible"],
  ledger_only: ["오차 기록 단계 (1–9)", "Residual ledger (1–9)"],
  bias_direction: ["편향 방향 참고 (10–29)", "Bias direction (10–29)"],
  provisional_candidate: ["임시 추천 후보 (30–49)", "Provisional candidate (30–49)"],
  validation_set_pending: ["검증표본 대기 (50–69)", "Waiting for validation set (50–69)"],
  validation_ready: ["독립 검증 가능 (70+)", "Independent validation ready (70+)"],
};

const REASON_LABELS = {
  synthetic_or_demo: ["DEMO·가상 기준", "DEMO or synthetic reference"],
  cancelled_heat: ["취소 차지", "Cancelled heat"],
  heat_not_completed: ["조업 미완료", "Heat not completed"],
  endpoint_prediction_missing: ["종점 예상 없음", "Endpoint prediction missing"],
  confirmed_endpoint_missing: ["확정 종점 미지정", "Confirmed endpoint missing"],
  comparable_values_missing: ["비교 가능한 성분 없음", "No comparable values"],
};

function format(value, element) {
  if (!Number.isFinite(Number(value))) return "–";
  return Number(value).toFixed(element === "temperature" ? 1 : 5);
}

function elementLabel(element, locale) {
  if (element === "temperature") return locale === "ko" ? "온도" : "Temperature";
  return element;
}

export function LearningScreen({ state, locale, canWrite, onBringCandidate, onOpenRecoveryCard }) {
  const [elementFilter, setElementFilter] = useState("all");
  const ledger = useMemo(() => buildResidualLedger(state), [state]);
  const recommendations = useMemo(() => buildStateCalibrationRecommendations(state, ledger), [state, ledger]);
  const eligibility = useMemo(() => learningEligibilitySummary(state), [state]);
  const visibleRows = elementFilter === "all" ? ledger : ledger.filter((row) => row.element === elementFilter);
  const currentRuns = state.trainingRuns?.filter((run) => run.status === "current") ?? [];
  const staleRuns = state.trainingRuns?.filter((run) => run.status === "stale") ?? [];
  const ko = locale === "ko";

  return <main className="workspace-screen learning-screen" data-testid="learning-screen">
    <div className="workspace-heading"><div><span>LITERATURE MODEL → RESIDUAL DATA → REVIEWED CORRECTION</span><h1>{ko ? "학습 · 계수 추천" : "Learning · coefficient recommendations"}</h1><p>{ko ? "완료 차지의 종점 예상과 확정 실측 차이를 재현 가능한 데이터셋으로 고정해 보정 후보를 만듭니다. 추천값은 자동 적용되지 않습니다." : "Completed-heat residuals are frozen into reproducible datasets to create correction candidates. Recommendations are never auto-applied."}</p></div><button type="button" className="recovery-card-entry-button" onClick={onOpenRecoveryCard}><Lifebuoy /><strong>{ko ? "보정계수 비상복구 카드" : "Coefficient recovery card"}</strong><span>{ko ? "핵심 6개 · 상세 최대 24개" : "Core 6 · detailed up to 24"}</span></button></div>

    <section className="learning-flow panel" aria-label={ko ? "학습 흐름" : "Learning flow"}><div><Flask /><strong>{ko ? "문헌 모델" : "Literature model"}</strong><span>BOF-REF-CALC 0.3.0</span></div><ArrowRight /><div><Funnel /><strong>{ko ? "학습 적격" : "Eligible heats"}</strong><span>{eligibility.eligibleHeatCount} / {eligibility.heatCount}</span></div><ArrowRight /><div><Database /><strong>{ko ? "오차 대장" : "Residual ledger"}</strong><span>{ledger.length} {ko ? "성분 행" : "element rows"}</span></div><ArrowRight /><div><TrendUp /><strong>{ko ? "현재 학습 실행" : "Current runs"}</strong><span>{currentRuns.length}</span></div></section>

    <section className="learning-health-grid" aria-label={ko ? "학습 데이터 상태" : "Learning data status"}>
      <div className="panel"><span>{ko ? "학습 적격 완료 차지" : "Eligible completed heats"}</span><strong>{eligibility.eligibleHeatCount}</strong><small>{ko ? "실제·완료·종점 확정·예상 있음" : "Field · completed · confirmed · predicted"}</small></div>
      <div className="panel"><span>{ko ? "제외 차지" : "Excluded heats"}</span><strong>{eligibility.excludedHeatCount}</strong><small>{Object.entries(eligibility.reasonCounts).map(([reason, count]) => `${REASON_LABELS[reason]?.[ko ? 0 : 1] ?? reason} ${count}`).join(" · ") || "–"}</small></div>
      <div className="panel"><span>{ko ? "현재 / 오래된 실행" : "Current / stale runs"}</span><strong>{currentRuns.length} / {staleRuns.length}</strong><small>{ko ? "원본 정정 시 기존 실행 보존" : "Prior runs retained after source corrections"}</small></div>
      <div className="panel"><span>{ko ? "현장 승인 가능한 후보" : "Field-approvable candidates"}</span><strong>{recommendations.filter((item) => item.eligibleForApproval).length}</strong><small>{ko ? "70행 이상·최신 20행 독립검증 개선" : "70+ rows · latest 20 holdout improved"}</small></div>
    </section>

    <div className="learning-warning"><WarningCircle weight="fill" /><span>{ko ? "DEMO·가상 기준 행은 학습 흐름 확인용이며 현장 승인 추천에 포함되지 않습니다. 충분한 실제 데이터가 쌓여도 작업자가 검토·승인하기 전에는 계수에 적용되지 않습니다." : "DEMO and synthetic-reference rows only demonstrate the learning flow and are excluded from field approval. Even with enough field data, no coefficient changes until an operator reviews and approves them."}</span></div>

    <div className="learning-grid"><section className="panel"><div className="panel-title"><h2>{ko ? "계수 추천 후보" : "Coefficient candidates"}</h2></div><div className="table-scroll"><table><thead><tr><th>{ko ? "그룹/성분" : "Group / element"}</th><th>{ko ? "데이터 단계" : "Data stage"}</th><th>{ko ? "현재" : "Current"}</th><th>{ko ? "추천" : "Candidate"}</th><th>{ko ? "검증 MAE" : "Validation MAE"}</th><th>{ko ? "처리" : "Action"}</th></tr></thead><tbody>
      {recommendations.map((item) => <tr key={item.id}><td><strong>{elementLabel(item.element, locale)}</strong><small>{item.groupKey}</small></td><td><span className={`learning-stage ${item.stage}`}>{STAGE_LABELS[item.stage][ko ? 0 : 1]}</span><small>{item.trainingCount}+{item.validationCount}{!item.versionCurrent ? ` · ${ko ? "과거 계수 버전" : "historical coefficient version"}` : ""}</small></td><td>{format(item.currentOffset, item.element)} {item.unit}</td><td>{format(item.candidateOffset, item.element)} {item.unit}<small>Δ {format(item.recommendedDelta, item.element)}</small></td><td>{item.validationCount ? `${format(item.validationBaseline.mae, item.element)} → ${format(item.validationCandidate.mae, item.element)}` : "–"}</td><td><button type="button" className="table-action" disabled={!canWrite || item.synthetic || !item.versionCurrent || item.count < 30} onClick={() => onBringCandidate({ ...item, coefficientId: ledger.find((row) => row.groupKey === item.groupKey)?.coefficientId })}>{ko ? "설정 초안으로" : "To settings draft"}</button></td></tr>)}
      {!recommendations.length && <tr><td colSpan="6">{ko ? "완료 차지에서 ‘확정 종점 분석’을 지정하면 오차와 추천 근거가 생성됩니다." : "Set a confirmed endpoint analysis on a completed heat to create residual and recommendation evidence."}</td></tr>}
    </tbody></table></div></section>

      <section className="panel residual-panel"><div className="panel-title"><h2>{ko ? "종점 오차 대장" : "Endpoint residual ledger"}</h2><select value={elementFilter} onChange={(event) => setElementFilter(event.target.value)}><option value="all">{ko ? "전체 성분" : "All elements"}</option>{["C", "temperature", "P", "Mn", "Si", "S"].map((key) => <option key={key} value={key}>{elementLabel(key, locale)}</option>)}</select></div><div className="table-scroll"><table><thead><tr><th>{ko ? "차지" : "Heat"}</th><th>{ko ? "성분" : "Item"}</th><th>{ko ? "예상" : "Predicted"}</th><th>{ko ? "실측" : "Actual"}</th><th>{ko ? "오차(실측-예상)" : "Residual (actual-predicted)"}</th><th>{ko ? "계수 버전" : "Coefficient version"}</th></tr></thead><tbody>{visibleRows.slice(-200).reverse().map((row) => <tr key={row.id}><td>{row.heatId}{row.synthetic && <small>DEMO</small>}</td><td>{elementLabel(row.element, locale)}</td><td>{format(row.predicted, row.element)}</td><td>{format(row.actual, row.element)}</td><td className={row.residual > 0 ? "positive-residual" : row.residual < 0 ? "negative-residual" : ""}>{format(row.residual, row.element)} {row.unit}</td><td>{row.coefficientVersionId}</td></tr>)}{!visibleRows.length && <tr><td colSpan="6">{ko ? "기록 없음" : "No records"}</td></tr>}</tbody></table></div></section>
    </div>
    <TrainingRunTable runs={state.trainingRuns ?? []} locale={locale} />
  </main>;
}
