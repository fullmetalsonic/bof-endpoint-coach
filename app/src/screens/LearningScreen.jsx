import { useMemo, useState } from "react";
import { ArrowRight, Database, Flask, TrendUp, WarningCircle } from "@phosphor-icons/react";
import { buildResidualLedger } from "../calibration/residualLedger.js";
import { buildCalibrationRecommendations } from "../calibration/recommendation.js";

const STAGE_LABELS = {
  synthetic_only: ["DEMO 전용 · 현장 적용 금지", "DEMO only · not field eligible"],
  ledger_only: ["오차 기록 단계 (1–9)", "Residual ledger (1–9)"],
  bias_direction: ["편향 방향 참고 (10–29)", "Bias direction (10–29)"],
  provisional_candidate: ["임시 추천 후보 (30–49)", "Provisional candidate (30–49)"],
  validation_set_pending: ["검증표본 대기 (50–69)", "Waiting for validation set (50–69)"],
  validation_ready: ["독립 검증 가능 (70+)", "Independent validation ready (70+)"],
};

function format(value, element) {
  if (!Number.isFinite(Number(value))) return "–";
  return Number(value).toFixed(element === "temperature" ? 1 : 5);
}

function elementLabel(element, locale) {
  if (element === "temperature") return locale === "ko" ? "온도" : "Temperature";
  return element;
}

export function LearningScreen({ state, locale, canWrite, onBringCandidate }) {
  const [elementFilter, setElementFilter] = useState("all");
  const ledger = useMemo(() => buildResidualLedger(state), [state]);
  const coefficient = state.settings.coefficientProfiles[0];
  const recommendations = useMemo(() => buildCalibrationRecommendations(ledger, coefficient?.calibrationOffsets, coefficient?.versionId), [ledger, coefficient]);
  const visibleRows = elementFilter === "all" ? ledger : ledger.filter((row) => row.element === elementFilter);
  return (
    <main className="workspace-screen learning-screen" data-testid="learning-screen">
      <div className="workspace-heading"><div><span>Literature model → residual ledger → reviewed correction</span><h1>{locale === "ko" ? "학습 · 계수 추천" : "Learning · coefficient recommendations"}</h1><p>{locale === "ko" ? "완료 차지의 종점 예상과 확정 실측 차이를 축적해 보정 오프셋 후보를 만듭니다. 추천값은 자동 적용되지 않습니다." : "Accumulates the gap between endpoint estimates and confirmed actual results, then creates a reviewed offset candidate. Recommendations are never auto-applied."}</p></div></div>
      <section className="learning-flow panel" aria-label={locale === "ko" ? "학습 흐름" : "Learning flow"}><div><Flask /><strong>{locale === "ko" ? "문헌 모델" : "Literature model"}</strong><span>{coefficient?.versionId}</span></div><ArrowRight /><div><Database /><strong>{locale === "ko" ? "오차 대장" : "Residual ledger"}</strong><span>{ledger.length} {locale === "ko" ? "성분 행" : "element rows"}</span></div><ArrowRight /><div><TrendUp /><strong>{locale === "ko" ? "추천 후보" : "Candidates"}</strong><span>{recommendations.filter((item) => item.stage !== "ledger_only").length}</span></div></section>
      <div className="learning-grid">
        <section className="panel"><div className="panel-title"><h2>{locale === "ko" ? "계수 추천 후보" : "Coefficient candidates"}</h2></div><div className="learning-warning"><WarningCircle weight="fill" /><span>{locale === "ko" ? "실제 조업값이 아닌 DEMO 행은 현장 승인 추천에 포함되지 않습니다. 70개 이상일 때 마지막 20개를 독립 검증에 사용합니다." : "DEMO rows are excluded from field approval. At 70+ rows, the latest 20 are held out for independent validation."}</span></div><div className="table-scroll"><table><thead><tr><th>{locale === "ko" ? "그룹/성분" : "Group / element"}</th><th>{locale === "ko" ? "단계" : "Stage"}</th><th>{locale === "ko" ? "현재" : "Current"}</th><th>{locale === "ko" ? "추천" : "Candidate"}</th><th>{locale === "ko" ? "검증 MAE" : "Validation MAE"}</th><th>{locale === "ko" ? "처리" : "Action"}</th></tr></thead><tbody>{recommendations.map((item) => <tr key={item.id}><td><strong>{elementLabel(item.element, locale)}</strong><small>{item.groupKey}</small></td><td><span className={`learning-stage ${item.stage}`}>{STAGE_LABELS[item.stage][locale === "ko" ? 0 : 1]}</span><small>{item.trainingCount}+{item.validationCount}{!item.versionCurrent ? ` · ${locale === "ko" ? "과거 계수 버전" : "historical coefficient version"}` : ""}</small></td><td>{format(item.currentOffset, item.element)} {item.unit}</td><td>{format(item.candidateOffset, item.element)} {item.unit}<small>Δ {format(item.recommendedDelta, item.element)}</small></td><td>{item.validationCount ? `${format(item.validationBaseline.mae, item.element)} → ${format(item.validationCandidate.mae, item.element)}` : "–"}</td><td><button type="button" className="table-action" disabled={!canWrite || item.synthetic || !item.versionCurrent || item.count < 30} onClick={() => onBringCandidate({ ...item, coefficientId: coefficient.id })}>{locale === "ko" ? "설정 초안으로" : "To settings draft"}</button></td></tr>)}{recommendations.length === 0 && <tr><td colSpan="6">{locale === "ko" ? "완료 차지에서 ‘확정 종점 분석’을 지정하면 오차가 여기에 쌓입니다." : "Set a confirmed endpoint analysis on a completed heat to build this ledger."}</td></tr>}</tbody></table></div></section>
        <section className="panel residual-panel"><div className="panel-title"><h2>{locale === "ko" ? "종점 오차 대장" : "Endpoint residual ledger"}</h2><select value={elementFilter} onChange={(event) => setElementFilter(event.target.value)}><option value="all">{locale === "ko" ? "전체 성분" : "All elements"}</option>{["C", "temperature", "P", "Mn", "Si", "S"].map((key) => <option key={key} value={key}>{elementLabel(key, locale)}</option>)}</select></div><div className="table-scroll"><table><thead><tr><th>{locale === "ko" ? "차지" : "Heat"}</th><th>{locale === "ko" ? "성분" : "Item"}</th><th>{locale === "ko" ? "예상" : "Predicted"}</th><th>{locale === "ko" ? "실측" : "Actual"}</th><th>{locale === "ko" ? "오차(실측-예상)" : "Residual (actual-predicted)"}</th><th>{locale === "ko" ? "계수 버전" : "Coefficient version"}</th></tr></thead><tbody>{visibleRows.slice(-200).reverse().map((row) => <tr key={row.id}><td>{row.heatId}{row.synthetic && <small>DEMO</small>}</td><td>{elementLabel(row.element, locale)}</td><td>{format(row.predicted, row.element)}</td><td>{format(row.actual, row.element)}</td><td className={row.residual > 0 ? "positive-residual" : row.residual < 0 ? "negative-residual" : ""}>{format(row.residual, row.element)} {row.unit}</td><td>{row.coefficientVersionId}</td></tr>)}{visibleRows.length === 0 && <tr><td colSpan="6">{locale === "ko" ? "기록 없음" : "No records"}</td></tr>}</tbody></table></div></section>
      </div>
    </main>
  );
}
