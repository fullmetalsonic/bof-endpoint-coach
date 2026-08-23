function hasValue(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function formatValue(value, decimals) {
  return hasValue(value) ? Number(value).toFixed(decimals) : "–";
}

function rangeFor(row) {
  const values = [row.actual, row.prediction?.available ? row.prediction.value : null, row.prediction?.low, row.prediction?.high, row.target?.min, row.target?.max].filter(hasValue).map(Number);
  if (!values.length) return [0, 1];
  let min = Math.min(...values);
  let max = Math.max(...values);
  const baseSpan = max - min || Math.abs(max) * 0.25 || 1;
  min -= baseSpan * 0.55;
  max += baseSpan * 0.55;
  if (min > 0 && row.key !== "temperature") min = Math.max(0, min);
  return [min, max];
}

function position(value, view) {
  if (!hasValue(value)) return null;
  return Math.max(0, Math.min(100, (Number(value) - view[0]) / (view[1] - view[0]) * 100));
}

function targetLabel(target, decimals, locale, t) {
  const hasMin = hasValue(target?.min);
  const hasMax = hasValue(target?.max);
  if (hasMin && hasMax) return `${t("targetRange")} ${formatValue(target.min, decimals)} – ${formatValue(target.max, decimals)}`;
  if (hasMax) return locale === "ko" ? `목표 상한 ≤ ${formatValue(target.max, decimals)}` : `Target maximum ≤ ${formatValue(target.max, decimals)}`;
  if (hasMin) return locale === "ko" ? `목표 하한 ≥ ${formatValue(target.min, decimals)}` : `Target minimum ≥ ${formatValue(target.min, decimals)}`;
  return locale === "ko" ? "목표 미설정" : "No target";
}

const names = { C: "C", temperature: "온도", P: "P", Mn: "Mn", Si: "Si", S: "S" };
const englishNames = { ...names, temperature: "Temperature" };
const confidenceLabels = {
  medium: { ko: "문헌 신뢰도 중", en: "Literature confidence: medium" },
  low: { ko: "문헌 신뢰도 낮음", en: "Literature confidence: low" },
  very_low: { ko: "문헌 신뢰도 매우 낮음", en: "Literature confidence: very low" },
};

export function QualityBar({ row, explanation, locale, t }) {
  const target = row.target;
  const decimals = target?.decimals ?? 3;
  const view = rangeFor(row);
  const hasMin = hasValue(target?.min);
  const hasMax = hasValue(target?.max);
  const targetStart = position(hasMin ? target.min : view[0], view) ?? 0;
  const targetEnd = position(hasMax ? target.max : view[1], view) ?? 100;
  const actualPosition = position(row.actual, view);
  const predictedPosition = row.prediction?.available ? position(row.prediction.value, view) : null;
  const scenarioLow = row.prediction?.available ? position(row.prediction.low, view) : null;
  const scenarioHigh = row.prediction?.available ? position(row.prediction.high, view) : null;
  const label = locale === "ko" ? names[row.key] : englishNames[row.key];
  const sourceLabels = {
    literature_reference: locale === "ko" ? "문헌 참고" : "Literature reference",
    field_candidate_available: locale === "ko" ? "현장 후보 있음" : "Field candidate available",
    field_adjustment_applied: locale === "ko" ? "현장 보정 적용" : "Field adjustment applied",
  };
  const warningLabels = {
    confidence_low: locale === "ko" ? "문헌 신뢰도 낮음" : "Low literature confidence",
    confidence_very_low: locale === "ko" ? "문헌 신뢰도 매우 낮음" : "Very low literature confidence",
    assumed_inputs_used: locale === "ko" ? "문헌 대체 입력 사용" : "Literature fallback inputs used",
    sample_anchor_not_used: locale === "ko" ? "샘플 보정 미사용" : "No sample anchor used",
    demo_or_reference_profile: locale === "ko" ? "DEMO·가상 기준" : "DEMO or synthetic reference",
  };
  const signed = (value) => hasValue(value) ? `${Number(value) >= 0 ? "+" : ""}${formatValue(value, decimals)}` : "–";
  return (
    <div className="quality-row-block">
    <div className="quality-row">
      <div className="quality-name"><strong>{label}</strong><span>({target?.unit ?? "–"})</span></div>
      <div className="quality-number"><span>{t("currentActual")}</span><strong>{formatValue(row.actual, decimals)}</strong></div>
      <div className="quality-number estimate"><span>{t("endpointEstimate")}</span><strong>{row.prediction?.available ? formatValue(row.prediction.value, decimals) : "–"}</strong><small>{row.prediction?.available ? t(row.predictionState) : t("noFormula")}</small>{row.prediction?.available && <small>{formatValue(row.prediction.low, decimals)}–{formatValue(row.prediction.high, decimals)}</small>}{explanation?.available && <small className={`prediction-source ${explanation.sourceStage}`}>{sourceLabels[explanation.sourceStage]}</small>}{row.prediction?.available && row.prediction.confidence && <small className={`confidence-label ${row.prediction.confidence}`}>{confidenceLabels[row.prediction.confidence]?.[locale] ?? row.prediction.confidence}</small>}</div>
      <div className="quality-track-wrap">
        <div className="range-labels"><span>{hasMin ? `${t("min")} ${formatValue(target.min, decimals)}` : ""}</span><strong>{targetLabel(target, decimals, locale, t)}</strong><span>{hasMax ? `${t("max")} ${formatValue(target.max, decimals)}` : ""}</span></div>
        <div className="quality-track">
          {(hasMin || hasMax) && <span className="target-zone" style={{ left: `${targetStart}%`, width: `${Math.max(0, targetEnd - targetStart)}%` }} />}
          {scenarioLow !== null && scenarioHigh !== null && <span className="scenario-zone" title={t("literatureScenarioRange")} style={{ left: `${Math.min(scenarioLow, scenarioHigh)}%`, width: `${Math.abs(scenarioHigh - scenarioLow)}%` }} />}
          {hasMin && <span className="limit-line" style={{ left: `${targetStart}%` }} />}
          {hasMax && <span className="limit-line" style={{ left: `${targetEnd}%` }} />}
          {actualPosition !== null && <span className={`value-dot actual ${row.actualState}`} style={{ left: `${actualPosition}%` }}><b>{formatValue(row.actual, decimals)}</b></span>}
          {predictedPosition !== null && <span className={`value-dot predicted ${row.predictionState}`} style={{ left: `${predictedPosition}%` }}><b>{formatValue(row.prediction.value, decimals)}</b></span>}
        </div>
      </div>
    </div>
    {explanation?.available && <details className="quality-explanation"><summary>{locale === "ko" ? `${label} 예상 근거 보기` : `Show ${label} estimate basis`}</summary><div className="explanation-grid"><div><span>{locale === "ko" ? "문헌 최초예상" : "Literature baseline"}</span><strong>{formatValue(explanation.literatureBase, decimals)} {explanation.unit}</strong></div><div><span>{locale === "ko" ? "최신 샘플 보정" : "Latest sample adjustment"}</span><strong>{signed(explanation.sampleAdjustment)} {explanation.unit}</strong><small>{explanation.sampleAt ? new Date(explanation.sampleAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-GB") : (locale === "ko" ? "샘플 미사용" : "No sample used")}</small></div><div><span>{locale === "ko" ? "승인 계수 보정" : "Approved coefficient offset"}</span><strong>{signed(explanation.calibrationOffset)} {explanation.unit}</strong><small>{explanation.coefficientVersionId ?? "–"}</small></div><div><span>{locale === "ko" ? "최종 참고예상" : "Final reference estimate"}</span><strong>{formatValue(explanation.finalValue, decimals)} {explanation.unit}</strong><small>{formatValue(explanation.range.low, decimals)}–{formatValue(explanation.range.high, decimals)}</small></div><div><span>{locale === "ko" ? "학습 비교군" : "Learning group"}</span><strong>{explanation.currentRun ? `${explanation.currentRun.heatCount}${locale === "ko" ? "차지" : " heats"}` : (locale === "ko" ? "유효 현장 실행 없음" : "No eligible field run")}</strong><small>{explanation.groupKey}</small></div><div><span>{locale === "ko" ? "문헌 출처·주의" : "Sources · cautions"}</span><strong>{explanation.sourceIds.join(", ") || "–"}</strong><small>{explanation.warnings.map((warning) => warningLabels[warning] ?? warning).join(" · ") || (locale === "ko" ? "추가 경고 없음" : "No additional warnings")}</small></div></div></details>}
    </div>
  );
}
