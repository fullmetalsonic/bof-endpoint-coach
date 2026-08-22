import { useMemo, useState } from "react";
import { X } from "@phosphor-icons/react";
import { getNextStage } from "../domain/processStages.js";
import { validateStageTransitionInput, validationMessage } from "../domain/operationalValidation.js";
import { FieldLabel } from "./FieldLabel.jsx";

function localDateTimeValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

export function StageTransitionModal({ heat, locale, onClose, onSave }) {
  const next = getNextStage(heat.stage);
  const defaults = useMemo(() => ({ occurredAt: localDateTimeValue(), cumulativeOxygenNm3: heat.process?.cumulativeOxygenNm3 ?? "", lanceHeightM: heat.process?.lanceHeightM ?? "", oxygenFlowNm3PerMinute: heat.process?.oxygenFlowNm3PerMinute ?? "", note: "" }), [heat]);
  const [form, setForm] = useState(defaults);
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const ko = locale === "ko";
  const normalizedForm = { ...form, occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : "" };
  const validation = validateStageTransitionInput(heat, normalizedForm);
  if (!next) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="event-modal" role="dialog" aria-modal="true" onSubmit={(event) => { event.preventDefault(); if (!validation.ok) return; onSave(normalizedForm); onClose(); }}>
        <div className="modal-header"><div><span>{heat.id} · {heat.stage} → {next.code}</span><h2>{ko ? `${next.labelKo} 단계로 전환` : `Advance to ${next.labelEn}`}</h2></div><button type="button" onClick={onClose}><X /></button></div>
        <div className="form-guidance"><strong>{ko ? "단계 전환 입력" : "Stage transition input"}</strong><span>{ko ? "실제 전환 시각은 필수입니다. 당시 확인 가능한 조업값을 함께 기록하면 시간 경과형 참고예상이 갱신됩니다." : "Actual transition time is required. Add available operating values so the time-based estimate can update."}</span></div>
        <div className="form-grid">
          <label className="full"><FieldLabel kind="required" locale={locale}>{ko ? "실제 전환 시각" : "Actual transition time"}</FieldLabel><input type="datetime-local" step="1" value={form.occurredAt} onChange={(event) => set("occurredAt", event.target.value)} required /></label>
          <label><FieldLabel kind="recommended" locale={locale}>{ko ? "누적 산소량" : "Cumulative oxygen"} (Nm³)</FieldLabel><input type="number" min="0" value={form.cumulativeOxygenNm3} onChange={(event) => set("cumulativeOxygenNm3", event.target.value)} /></label>
          <label><FieldLabel kind="recommended" locale={locale}>{ko ? "랜스 높이" : "Lance height"} (m)</FieldLabel><input type="number" min="0" step="0.01" value={form.lanceHeightM} onChange={(event) => set("lanceHeightM", event.target.value)} /></label>
          <label><FieldLabel kind="recommended" locale={locale}>{ko ? "산소 유량" : "Oxygen flow"} (Nm³/min)</FieldLabel><input type="number" min="0" value={form.oxygenFlowNm3PerMinute} onChange={(event) => set("oxygenFlowNm3PerMinute", event.target.value)} /></label>
          <label><FieldLabel kind="optional" locale={locale}>{ko ? "전환 메모" : "Transition note"}</FieldLabel><input value={form.note} onChange={(event) => set("note", event.target.value)} /></label>
        </div>
        {!validation.ok && <p className="modal-validation" role="alert">{validationMessage(validation.reason, locale)}</p>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{ko ? "취소" : "Cancel"}</button><button type="submit" className="primary" disabled={!validation.ok}>{ko ? `${next.code} ${next.labelKo} 기록하고 이동` : `Record and move to ${next.code}`}</button></div>
      </form>
    </div>
  );
}
