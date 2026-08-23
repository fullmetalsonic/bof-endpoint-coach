import { BookOpenText, CheckCircle, Info, WarningCircle } from "@phosphor-icons/react";

const stageRows = [
  ["G0", "장입", "Charge", "용선·스크랩·초기 부원료와 계획 산소 등 기초값을 확인", "Review hot metal, scrap, initial flux, and planned oxygen."],
  ["G1", "송풍 시작", "Blow start", "송풍 시작 시각과 첫 누적 산소·랜스·유량을 기록", "Record actual blow-start time, oxygen, lance height, and flow."],
  ["G2", "용해 초기", "Early blow", "초기 조업값을 갱신하고 필요 시 샘플 채취", "Update early-blow values and record sampling when it occurs."],
  ["G3", "용해 중기", "Mid blow", "샘플·분석·체크포인트를 실제 발생 순서대로 기록", "Record samples, analyses, and checkpoints in actual order."],
  ["G4", "용해 후기", "Late blow", "후기 샘플과 분석값으로 종점 참고예상을 갱신", "Update the endpoint reference with late-blow sample results."],
  ["G5", "정련", "Refining", "C와 온도가 있는 채택 샘플로 출강 검토 준비", "Prepare tap review using an adopted sample with C and temperature."],
  ["G6", "출강 검토", "Tap review", "최종 샘플·분석과 현장 기준을 확인한 뒤 출강 기록", "Review the final sample, analysis, and site criteria before tapping."],
  ["G7", "출강", "Tapping", "후처리 자재·최종 분석이 있으면 기록", "Record post-treatment material and final analysis when available."],
  ["G8", "후처리", "Post-treatment", "입력과 정정 이력을 확인한 완료 상태", "Review the event and correction ledger for the completed heat."],
];

const termRows = [
  ["차지(Heat)", "Heat", "한 번의 전로 조업 단위. 차지 번호는 중복되지 않는 식별값입니다.", "One BOF operating batch. Its heat number must be unique."],
  ["용선", "Hot metal", "전로에 장입하는 액체 선철입니다. 질량과 초기 성분·온도를 입력합니다.", "Liquid iron charged to the converter; enter mass, chemistry, and temperature."],
  ["스크랩", "Scrap", "냉각재이자 철원으로 투입하는 고철입니다. 질량과 대표 C 값을 입력합니다.", "Solid iron feed and coolant; enter its mass and representative C."],
  ["초기 부원료", "Initial flux", "G0에서 이미 투입된 flux 계열 부원료의 합계 질량입니다. 재료별 실제 투입은 자재 투입 기록에 남깁니다.", "Total flux already charged at G0; record each later addition as a material event."],
  ["계획 총 산소", "Planned total oxygen", "현재 차지에서 종점까지 공급할 것으로 계획한 산소의 총량입니다.", "Total oxygen planned through the endpoint of this heat."],
  ["누적 산소", "Cumulative oxygen", "해당 시각까지 실제로 공급된 산소량입니다. 계획 총 산소보다 시간이 지나며 증가합니다.", "Actual oxygen supplied up to the event time; it should increase during the blow."],
  ["랜스 높이", "Lance height", "현장 기준점에서 산소 랜스까지의 거리입니다. 기준점은 사업소 표준을 따릅니다.", "Distance from the site-defined reference point to the oxygen lance."],
  ["채택 분석", "Adopted analysis", "여러 분석 중 현재 종점 참고예상의 기준으로 선택한 분석입니다.", "The selected analysis used as the basis for the current endpoint reference."],
  ["종점 실제값", "Actual endpoint", "출강 후 예측 오차 비교에 사용할 확정 분석입니다. 채택 분석과 용도가 다릅니다.", "Confirmed post-tap analysis used to compare prediction error."],
  ["계수 버전", "Coefficient version", "예상 계산에 실제 사용된 문헌값과 보정 오프셋의 묶음입니다. 변경·복구할 때마다 새 버전이 생깁니다.", "The literature values and correction offsets actually used by a prediction. Each save or restore creates a new version."],
  ["오차(잔차)", "Residual", "실측값에서 예상값을 뺀 값입니다. 양수면 실측이 예상보다 높고, 음수면 낮습니다.", "Actual minus predicted. Positive means the actual is higher; negative means it is lower."],
  ["추천 후보", "Correction candidate", "같은 강종·설비·계수버전의 오차를 모아 만든 검토용 보정값입니다. 자동 적용되지 않습니다.", "A review-only correction built from residuals for the same grade, equipment, and coefficient version. It is never auto-applied."],
  ["Data Ledger", "Data Ledger", "입력·분석·계산의 최신성, 저장 상태, 적용 계수와 미완료 확인 항목을 모은 상태판입니다.", "Status panel for input freshness, storage, coefficients, and pending checks."],
];

const unitRows = [
  ["kg / t / g", "질량. 1 t = 1,000 kg, 1 kg = 1,000 g이며 내부 계산은 kg로 환산합니다.", "Mass. 1 t = 1,000 kg and 1 kg = 1,000 g; calculations use kg."],
  ["% / wt% / ppm", "질량 농도. %와 wt%는 같은 비율로 취급하며 1% = 10,000 ppm입니다.", "Mass concentration. % and wt% are equivalent; 1% = 10,000 ppm."],
  ["°C", "섭씨 온도입니다.", "Temperature in degrees Celsius."],
  ["Nm³", "정해진 표준 상태로 환산한 기체 체적입니다. 실제 배관 체적 m³와 구분합니다.", "Gas volume normalized to specified standard conditions, not actual pipe m³."],
  ["Nm³/min", "1분당 표준 상태 산소 유량입니다.", "Normalized oxygen volume supplied per minute."],
  ["m", "미터. 랜스 높이는 현장 기준점을 먼저 확인해야 합니다.", "Metres; confirm the site reference point used for lance height."],
  ["min", "분. 예상 소요시간·잔여시간·재취련 시간을 뜻합니다.", "Minutes used for duration, remaining time, or reblow time."],
];

export function HelpScreen({ locale, onStart, onSettings }) {
  const ko = locale === "ko";
  return (
    <main className="workspace-screen help-screen" data-testid="help-screen">
      <div className="workspace-heading">
        <div><span>FIRST-USE GUIDE</span><h1>{ko ? "처음 사용하는 분을 위한 화면 도움말" : "First-use screen guide"}</h1><p>{ko ? "명칭과 단위를 확인한 뒤 중앙의 파란 안내를 따라 실제 발생 시각과 값만 기록하십시오." : "Check terms and units, then follow the central blue guidance and record only actual times and values."}</p></div>
        <div className="help-heading-actions"><button type="button" className="secondary-button" onClick={onSettings}>{ko ? "1. 기준 정보 확인" : "1. Review settings"}</button><button type="button" className="primary-button" onClick={onStart}>{ko ? "2. 대시보드로 이동" : "2. Open dashboard"}</button></div>
      </div>
      <section className="panel help-start">
        <BookOpenText />
        <div><h2>{ko ? "처음에는 이 순서로 확인" : "Start in this order"}</h2><ol><li>{ko ? "DEMO는 조작 연습용 합성 데이터, 빈 작업은 실제 수동 입력용입니다." : "DEMO is synthetic practice data; Empty workspace is for manual input."}</li><li>{ko ? "기준 정보에서 강종 목표·재료 단위·설비·계수 상태를 확인합니다." : "Review grade targets, material units, equipment, and coefficient status."}</li><li>{ko ? "신규 차지의 계산 핵심 6개 값을 채우고, 이후 중앙 ‘현재 해야 할 일’을 따릅니다." : "Fill the six calculation-core fields, then follow Do this now."}</li><li>{ko ? "잘못 입력하면 원본을 지우지 말고 전체 이력·정정에서 수정 또는 무효 처리합니다." : "Correct or void mistakes in the full timeline instead of deleting originals."}</li></ol></div>
      </section>
      <div className="help-grid">
        <section className="panel"><div className="panel-title"><h2>{ko ? "G0~G8 단계" : "G0–G8 stages"}</h2></div><div className="table-scroll"><table className="help-table"><thead><tr><th>{ko ? "단계" : "Stage"}</th><th>{ko ? "명칭" : "Name"}</th><th>{ko ? "기록 목적" : "Purpose"}</th></tr></thead><tbody>{stageRows.map(([code, nameKo, nameEn, meaningKo, meaningEn]) => <tr key={code}><td><strong>{code}</strong></td><td>{ko ? nameKo : nameEn}</td><td>{ko ? meaningKo : meaningEn}</td></tr>)}</tbody></table></div></section>
        <section className="panel"><div className="panel-title"><h2>{ko ? "자주 보는 명칭" : "Common terms"}</h2></div><dl className="help-definition-list">{termRows.map(([termKo, termEn, meaningKo, meaningEn]) => <div key={termKo}><dt>{ko ? termKo : termEn}</dt><dd>{ko ? meaningKo : meaningEn}</dd></div>)}</dl></section>
        <section className="panel"><div className="panel-title"><h2>{ko ? "단위와 환산" : "Units and conversion"}</h2></div><dl className="help-definition-list">{unitRows.map(([term, meaningKo, meaningEn]) => <div key={term}><dt>{term}</dt><dd>{ko ? meaningKo : meaningEn}</dd></div>)}</dl></section>
        <section className="panel"><div className="panel-title"><h2>{ko ? "표시를 읽는 법" : "How to read the display"}</h2></div><ul className="help-status-list"><li><CheckCircle weight="fill" /><span>{ko ? "녹색: 강종 목표 범위 또는 정상 완료 상태" : "Green: grade target range or completed state"}</span></li><li><WarningCircle weight="fill" /><span>{ko ? "주황·빨강: 확인 필요 또는 목표 이탈. 자동 출강 판단이 아닙니다." : "Amber/red: check required or outside target; never an automatic tap decision."}</span></li><li><Info weight="fill" /><span>{ko ? "회색 버튼: 현재 단계에서 사용할 수 없습니다. 버튼 안의 사용 가능 단계를 확인합니다." : "Gray button: unavailable at this stage; read the availability note inside it."}</span></li><li><Info weight="fill" /><span>{ko ? "검은 점은 최신 실측, 흰 점은 종점 참고예상, 녹색 선은 목표 범위입니다." : "Black is latest actual, white is endpoint estimate, and green is target range."}</span></li></ul></section>
      </div>
      <div className="settings-warning help-boundary">{ko ? "C·온도·P·Mn·Si·S는 공개 문헌 시나리오 기반 참고예상입니다. 항목별 문헌 신뢰도가 다르며 실제 현장 정확도는 아직 검증되지 않았습니다. 설비 제어·안전 인터록·출강 승인과 취련사의 판단을 대체하지 않습니다." : "C, temperature, P, Mn, Si, and S are public-literature scenario reference estimates. Literature confidence differs by item, and plant accuracy has not yet been validated. This does not replace controls, interlocks, tap authorization, or operator judgment."}</div>
    </main>
  );
}
