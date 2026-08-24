import { FieldLabel } from "../FieldLabel.jsx";
import { DISSOLVED_OXYGEN_NOTE_MAX_LENGTH, DISSOLVED_OXYGEN_SOURCES, dissolvedOxygenSourceLabel } from "../../domain/measurements/dissolvedOxygen.js";
import { CaretDown } from "@phosphor-icons/react";

export function OptionalDissolvedOxygenSection({ locale, valuePpm, source, note, onChange }) {
  const ko = locale === "ko";
  const recorded = valuePpm !== "" && valuePpm !== null && valuePpm !== undefined;
  const zeroWarning = recorded && Number(valuePpm) === 0;

  return (
    <details className="optional-measurement-section full" open={recorded ? true : undefined}>
      <summary>
        <CaretDown aria-hidden="true" />
        <span className="optional-measurement-heading"><strong>{ko ? "추가 측정값" : "Additional measurement"}</strong><em>{ko ? "선택" : "Optional"}</em></span>
        <span className="optional-measurement-copy">{ko ? "용존산소 값이 있을 때만 입력 · 비워두고 저장 가능" : "Enter only when dissolved oxygen is available · blank is allowed"}</span>
        <span className={`optional-measurement-state ${recorded ? "recorded" : "not-recorded"}`}>{recorded ? `[O] ${valuePpm} ppm` : (ko ? "미측정" : "Not measured")}</span>
      </summary>
      <div className="optional-measurement-body">
        <p className="optional-measurement-notice"><strong>{ko ? "기록 전용" : "Record only"}</strong>{ko ? "현재 종점예상·투입 코치·단계 진행에는 사용하지 않습니다." : "This does not affect endpoint estimates, addition recommendations, or stage progress."}</p>
        <div className="optional-measurement-fields">
          <label>
            <FieldLabel kind="optional" locale={locale}>{ko ? "용존산소 [O]" : "Dissolved oxygen [O]"}</FieldLabel>
            <div className="input-with-fixed-unit"><input type="number" min="0" step="0.1" value={valuePpm} onChange={(event) => onChange("valuePpm", event.target.value)} aria-describedby="dissolved-oxygen-help" /><span>ppm</span></div>
          </label>
          <label>
            <FieldLabel kind="optional" locale={locale}>{ko ? "측정 출처" : "Measurement source"}</FieldLabel>
            <select value={source} onChange={(event) => onChange("source", event.target.value)} disabled={!recorded}>
              <option value="">{ko ? "미상/미입력" : "Unknown / not entered"}</option>
              {DISSOLVED_OXYGEN_SOURCES.map((item) => <option key={item} value={item}>{dissolvedOxygenSourceLabel(item, locale)}</option>)}
            </select>
          </label>
          <label className="full">
            <FieldLabel kind="optional" locale={locale}>{ko ? "측정 메모" : "Measurement note"}</FieldLabel>
            <input value={note} maxLength={DISSOLVED_OXYGEN_NOTE_MAX_LENGTH} onChange={(event) => onChange("note", event.target.value)} disabled={!recorded} placeholder={ko ? "장비명이나 특이사항이 있을 때만 입력" : "Only when equipment or an exception should be noted"} />
          </label>
        </div>
        <p id="dissolved-oxygen-help" className="optional-measurement-help">{ko ? "용강 안에 녹아 있는 산소 농도입니다. 취련 중 공급한 누적 산소량(Nm³)과는 다른 값입니다." : "This is oxygen dissolved in the steel bath. It differs from cumulative supplied oxygen (Nm³)."}</p>
        {zeroWarning && <p className="optional-measurement-warning" role="status">{ko ? "0 ppm을 측정값으로 저장합니다. 측정하지 않은 경우에는 값을 비우십시오." : "0 ppm will be saved as a measured value. Clear it when no measurement was taken."}</p>}
      </div>
    </details>
  );
}
