import { useMemo, useState } from "react";
import { X } from "@phosphor-icons/react";
import { getNextStage } from "../domain/processStages.js";

function localDateTimeValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function StageTransitionModal({ heat, locale, onClose, onSave }) {
  const next = getNextStage(heat.stage);
  const defaults = useMemo(() => ({ occurredAt: localDateTimeValue(), cumulativeOxygenNm3: heat.process?.cumulativeOxygenNm3 ?? "", lanceHeightM: heat.process?.lanceHeightM ?? "", oxygenFlowNm3PerMinute: heat.process?.oxygenFlowNm3PerMinute ?? "", note: "" }), [heat]);
  const [form, setForm] = useState(defaults);
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const ko = locale === "ko";
  if (!next) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="event-modal" role="dialog" aria-modal="true" onSubmit={(event) => { event.preventDefault(); onSave({ ...form, occurredAt: new Date(form.occurredAt).toISOString() }); onClose(); }}>
        <div className="modal-header"><div><span>{heat.id} · {heat.stage} → {next.code}</span><h2>{ko ? `${next.labelKo} 단계로 전환` : `Advance to ${next.labelEn}`}</h2></div><button type="button" onClick={onClose}><X /></button></div>
        <div className="form-grid">
          <label className="full"><span>{ko ? "실제 전환 시각" : "Actual transition time"}</span><input type="datetime-local" value={form.occurredAt} onChange={(event) => set("occurredAt", event.target.value)} required /></label>
          <label><span>{ko ? "누적 산소량" : "Cumulative oxygen"} (Nm³)</span><input type="number" min="0" value={form.cumulativeOxygenNm3} onChange={(event) => set("cumulativeOxygenNm3", event.target.value)} /></label>
          <label><span>{ko ? "랜스 높이" : "Lance height"} (m)</span><input type="number" min="0" step="0.01" value={form.lanceHeightM} onChange={(event) => set("lanceHeightM", event.target.value)} /></label>
          <label><span>{ko ? "산소 유량" : "Oxygen flow"} (Nm³/min)</span><input type="number" min="0" value={form.oxygenFlowNm3PerMinute} onChange={(event) => set("oxygenFlowNm3PerMinute", event.target.value)} /></label>
          <label><span>{ko ? "전환 메모" : "Transition note"}</span><input value={form.note} onChange={(event) => set("note", event.target.value)} /></label>
        </div>
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{ko ? "취소" : "Cancel"}</button><button type="submit" className="primary">{ko ? "단계 전환 기록" : "Record transition"}</button></div>
      </form>
    </div>
  );
}
