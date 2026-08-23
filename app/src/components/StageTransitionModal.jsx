import { useMemo } from "react";
import { X } from "@phosphor-icons/react";
import { getNextStage } from "../domain/processStages.js";
import { validateStageTransitionInput, validationMessage } from "../domain/operationalValidation.js";
import { FieldLabel } from "./FieldLabel.jsx";
import { usePersistentDraft } from "../hooks/usePersistentDraft.js";
import { useDialogFocus } from "../hooks/useDialogFocus.js";
import { TermHelp } from "./TermHelp.jsx";

function localDateTimeValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
}

export function StageTransitionModal({ heat, locale, onClose, onSave }) {
  const next = getNextStage(heat.stage);
  const defaults = useMemo(() => ({ occurredAt: localDateTimeValue(), cumulativeOxygenNm3: heat.process?.cumulativeOxygenNm3 ?? "", lanceHeightM: heat.process?.lanceHeightM ?? "", oxygenFlowNm3PerMinute: heat.process?.oxygenFlowNm3PerMinute ?? "", note: "" }), [heat]);
  const { value: form, setValue: setForm, dirty, restored, commit, discard } = usePersistentDraft({ key: `heat-${heat.id}-stage-${heat.stage}`, baseVersion: `${heat.stage}:${heat.stageHistory?.length ?? 0}`, defaults });
  const dialogRef = useDialogFocus({ onClose });
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const ko = locale === "ko";
  const normalizedForm = { ...form, occurredAt: form.occurredAt ? new Date(form.occurredAt).toISOString() : "" };
  const validation = validateStageTransitionInput(heat, normalizedForm);
  if (!next) return null;
  return (
    <div className="modal-backdrop" role="presentation">
      <form ref={dialogRef} tabIndex="-1" className="event-modal" role="dialog" aria-modal="true" aria-labelledby="stage-transition-title" onSubmit={(event) => { event.preventDefault(); if (!validation.ok || onSave(normalizedForm) === false) return; commit(); onClose(); }}>
        <div className="modal-header"><div><span>{heat.id} · {heat.stage} → {next.code}</span><h2 id="stage-transition-title">{ko ? `${next.labelKo} 단계로 전환` : `Advance to ${next.labelEn}`}</h2></div><button type="button" onClick={onClose} aria-label={ko ? "닫기" : "Close"}><X /></button></div>
        <div className="form-guidance"><strong>{ko ? "단계 전환 입력" : "Stage transition input"}</strong><span>{ko ? "실제 전환 시각은 필수입니다. 당시 확인 가능한 조업값을 함께 기록하면 시간 경과형 참고예상이 갱신됩니다." : "Actual transition time is required. Add available operating values so the time-based estimate can update."}</span></div>
        {dirty && <div className="draft-status" role="status"><strong>{restored ? (ko ? "저장되지 않은 초안을 복구했습니다." : "Unsaved draft restored.") : (ko ? "작성 중 초안이 이 PC에 자동 보관됩니다." : "This draft is preserved automatically on this PC.")}</strong><button type="button" onClick={() => { discard(); onClose(); }}>{ko ? "초안 버리기" : "Discard draft"}</button></div>}
        <div className="form-grid">
          <label className="full"><FieldLabel kind="required" locale={locale}>{ko ? "실제 전환 시각" : "Actual transition time"}</FieldLabel><input type="datetime-local" step="1" value={form.occurredAt} onChange={(event) => set("occurredAt", event.target.value)} required /></label>
          <label><FieldLabel kind="recommended" locale={locale}>{ko ? "누적 산소량" : "Cumulative oxygen"} (Nm³)</FieldLabel><input type="number" min="0" value={form.cumulativeOxygenNm3} onChange={(event) => set("cumulativeOxygenNm3", event.target.value)} /></label>
          <label><FieldLabel kind="recommended" locale={locale}>{ko ? "랜스 높이" : "Lance height"} (m)</FieldLabel><input type="number" min="0" step="0.01" value={form.lanceHeightM} onChange={(event) => set("lanceHeightM", event.target.value)} /></label>
          <label><FieldLabel kind="recommended" locale={locale}>{ko ? "산소 유량" : "Oxygen flow"} (Nm³/min)</FieldLabel><input type="number" min="0" value={form.oxygenFlowNm3PerMinute} onChange={(event) => set("oxygenFlowNm3PerMinute", event.target.value)} /></label>
          <label><FieldLabel kind="optional" locale={locale}>{ko ? "전환 메모" : "Transition note"}</FieldLabel><input value={form.note} onChange={(event) => set("note", event.target.value)} /></label>
        </div>
        <TermHelp locale={locale} items={[
          { term: ko ? "실제 전환 시각" : "Actual transition time", ko: "화면을 누른 시각이 아니라 공정이 실제로 다음 단계로 바뀐 시각입니다. 기본 현재 시각을 필요하면 수정합니다.", en: "The actual process transition time, not merely the time the button was clicked. Edit the current-time default when needed." },
          { term: "Nm³ / Nm³/min", ko: "전환 시점까지 누적된 표준 상태 산소량 / 그 시점의 산소 유량입니다.", en: "Normalized oxygen accumulated by the transition / oxygen flow at that moment." },
          { term: ko ? "랜스 높이" : "Lance height", ko: "전환 시점의 실제값입니다. 측정 기준점과 허용 범위는 현장 표준을 따릅니다.", en: "Actual value at transition. Use the site-defined reference point and limits." },
        ]} />
        {!validation.ok && <p className="modal-validation" role="alert">{validationMessage(validation.reason, locale)}</p>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{ko ? "취소" : "Cancel"}</button><button type="submit" className="primary" disabled={!validation.ok}>{ko ? `${next.code} ${next.labelKo} 기록하고 이동` : `Record and move to ${next.code}`}</button></div>
      </form>
    </div>
  );
}
