import { calculateSampleResiduals } from "../calculation/chemistry/sampleResiduals.js";

const ITEM_LABELS = { C: "C", temperature: "온도", P: "P", Mn: "Mn", Si: "Si", S: "S" };

function format(value, element) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(element === "temperature" ? 1 : 4) : "–";
}

export function SampleResidualPanel({ heat, settings, calculation, locale }) {
  const rows = calculateSampleResiduals(heat, settings, calculation);
  const visible = rows.slice(-24).reverse();
  return (
    <section className="sample-residual-panel panel">
      <div className="panel-title"><h2>{locale === "ko" ? "중간 샘플 모델 오차" : "Intermediate sample model residuals"}</h2><span>{locale === "ko" ? "오차 = 실측 − 문헌 궤적값 · 채택 샘플만 종점 재고정" : "Residual = actual − literature trajectory · only adopted sample re-anchors endpoint"}</span></div>
      <div className="table-scroll"><table><thead><tr><th>{locale === "ko" ? "시각/샘플" : "Time / sample"}</th><th>{locale === "ko" ? "산소 진행률" : "Oxygen progress"}</th><th>{locale === "ko" ? "항목" : "Item"}</th><th>{locale === "ko" ? "궤적 기대값" : "Trajectory value"}</th><th>{locale === "ko" ? "실측" : "Actual"}</th><th>{locale === "ko" ? "오차" : "Residual"}</th><th>{locale === "ko" ? "종점 반영" : "Endpoint anchor"}</th></tr></thead><tbody>{visible.map((row) => <tr key={row.id}><td>{new Date(row.analyzedAt).toLocaleTimeString(locale === "ko" ? "ko-KR" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}<small>{row.sampleId}</small></td><td>{(row.progress * 100).toFixed(1)}%<small>{row.oxygenNm3.toLocaleString()} Nm³</small></td><td><strong>{locale === "ko" ? ITEM_LABELS[row.element] : row.element === "temperature" ? "Temperature" : row.element}</strong></td><td>{format(row.modeled, row.element)}</td><td>{format(row.actual, row.element)}</td><td className={row.residual > 0 ? "positive-residual" : row.residual < 0 ? "negative-residual" : ""}>{row.residual > 0 ? "+" : ""}{format(row.residual, row.element)}</td><td>{row.adopted ? (locale === "ko" ? "반영" : "Applied") : (locale === "ko" ? "비교만" : "Compare only")}</td></tr>)}{visible.length === 0 && <tr><td colSpan="7">{locale === "ko" ? "누적 산소가 기록된 분석 결과를 입력하면 여기에서 기대값과 실측 오차를 비교합니다." : "Enter an analysis with cumulative oxygen to compare trajectory and actual values here."}</td></tr>}</tbody></table></div>
    </section>
  );
}
