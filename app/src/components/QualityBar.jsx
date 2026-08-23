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

export function QualityBar({ row, locale, t }) {
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
  return (
    <div className="quality-row">
      <div className="quality-name"><strong>{label}</strong><span>({target?.unit ?? "–"})</span></div>
      <div className="quality-number"><span>{t("currentActual")}</span><strong>{formatValue(row.actual, decimals)}</strong></div>
      <div className="quality-number estimate"><span>{t("endpointEstimate")}</span><strong>{row.prediction?.available ? formatValue(row.prediction.value, decimals) : "–"}</strong><small>{row.prediction?.available ? t(row.predictionState) : t("noFormula")}</small>{row.prediction?.available && <small>{formatValue(row.prediction.low, decimals)}–{formatValue(row.prediction.high, decimals)}</small>}{row.prediction?.available && row.prediction.confidence && <small className={`confidence-label ${row.prediction.confidence}`}>{confidenceLabels[row.prediction.confidence]?.[locale] ?? row.prediction.confidence}</small>}</div>
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
  );
}
