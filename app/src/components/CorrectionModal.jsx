import { useMemo } from "react";
import { WarningCircle, X } from "@phosphor-icons/react";
import { correctionImpact } from "../domain/correctionOperations.js";
import { validateCorrectionRequest } from "../domain/correctionValidation.js";
import { validationMessage } from "../domain/operationalValidation.js";
import { usePersistentDraft } from "../hooks/usePersistentDraft.js";
import { useDialogFocus } from "../hooks/useDialogFocus.js";

function localDateTimeValue(value) {
  const date = value ? new Date(value) : new Date();
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 19);
}

function isoFromLocal(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function numberOrBlank(value) {
  return value === null || value === undefined ? "" : String(value);
}

const labels = {
  material: ["자재 투입", "Material entry"],
  sample: ["샘플 채취", "Sample collection"],
  analysis: ["분석 결과", "Analysis result"],
  checkpoint: ["체크포인트", "Checkpoint"],
  reblow: ["재취련", "Reblow"],
  tap: ["출강 기록", "Tap record"],
};

const standardReasons = {
  ko: ["입력 오타", "발생 시각 오입력", "분석 결과 재확인", "중복 입력", "단계 전환 오조작", "기타 현장 사유"],
  en: ["Input typo", "Incorrect event time", "Analysis result rechecked", "Duplicate entry", "Incorrect stage transition", "Other site reason"],
};

export function CorrectionModal({ heat, target, mode, locale, onClose, onConfirm }) {
  const ko = locale === "ko";
  const payload = useMemo(() => target?.payload ?? {}, [target]);
  const sourceValues = useMemo(() => target?.kind === "analysis" ? payload.values ?? {} : {}, [payload, target?.kind]);
  const defaults = useMemo(() => ({
    occurredAt: localDateTimeValue(target?.occurredAt),
    reason: "",
    sampleId: payload.sampleId ?? target?.sampleId ?? "",
    amountKg: numberOrBlank(payload.amountKg),
    cumulativeOxygenNm3: numberOrBlank(payload.cumulativeOxygenNm3 ?? payload.processSnapshot?.cumulativeOxygenNm3),
    lanceHeightM: numberOrBlank(payload.lanceHeightM),
    oxygenFlowNm3PerMinute: numberOrBlank(payload.oxygenFlowNm3PerMinute),
    remainingMinutes: numberOrBlank(payload.remainingMinutes),
    additionalOxygenNm3: numberOrBlank(payload.additionalOxygenNm3),
    durationMinutes: numberOrBlank(payload.durationMinutes),
    method: payload.method ?? "OES",
    C: numberOrBlank(sourceValues.C), P: numberOrBlank(sourceValues.P), Mn: numberOrBlank(sourceValues.Mn), Si: numberOrBlank(sourceValues.Si), S: numberOrBlank(sourceValues.S),
    temperature: numberOrBlank(sourceValues.temperature),
  }), [payload, sourceValues, target?.occurredAt, target?.sampleId]);
  const { value: form, setValue: setForm, dirty, restored, commit, discard } = usePersistentDraft({ key: `heat-${heat.id}-correction-${mode}-${target?.id ?? target?.occurredAt ?? "record"}`, baseVersion: `${heat.events?.length ?? 0}:${heat.samples?.length ?? 0}:${heat.stageHistory?.length ?? 0}`, defaults });
  const dialogRef = useDialogFocus({ onClose });
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const impact = useMemo(() => target ? correctionImpact(heat, target, mode) : { laterEvents: 0, laterSamples: 0, laterStages: 0, predictionSnapshots: 0, total: 0 }, [heat, mode, target]);
  const type = mode === "rollback" ? "stage" : mode === "tap" ? "tap" : target?.type;
  function changes() {
    const occurredAt = form.occurredAt === localDateTimeValue(target?.occurredAt) ? target.occurredAt : isoFromLocal(form.occurredAt);
    if (type === "sample") return { occurredAt, sampleId: form.sampleId.trim() };
    if (type === "material") return { occurredAt, amountKg: Number(form.amountKg) };
    if (type === "checkpoint") return { occurredAt, cumulativeOxygenNm3: Number(form.cumulativeOxygenNm3), lanceHeightM: form.lanceHeightM === "" ? "" : Number(form.lanceHeightM), oxygenFlowNm3PerMinute: form.oxygenFlowNm3PerMinute === "" ? "" : Number(form.oxygenFlowNm3PerMinute), remainingMinutes: form.remainingMinutes === "" ? "" : Number(form.remainingMinutes) };
    if (type === "reblow") return { occurredAt, additionalOxygenNm3: Number(form.additionalOxygenNm3), durationMinutes: form.durationMinutes === "" ? "" : Number(form.durationMinutes) };
    if (type === "analysis") return { occurredAt, method: form.method.trim() || "OES", processSnapshot: { cumulativeOxygenNm3: form.cumulativeOxygenNm3 === "" ? null : Number(form.cumulativeOxygenNm3) }, values: Object.fromEntries(["C", "P", "Mn", "Si", "S", "temperature"].filter((key) => form[key] !== "").map((key) => [key, Number(form[key])])) };
    return { occurredAt };
  }

  const validation = validateCorrectionRequest(heat, target, mode, changes(), form.reason);
  const ready = validation.ok;

  const title = mode === "void" ? (ko ? "입력 기록 무효 처리" : "Void input record")
    : mode === "rollback" ? (ko ? "마지막 단계 전환 취소" : "Undo last stage transition")
      : mode === "tap" ? (ko ? "출강 기록 정정" : "Correct tap record")
        : mode === "adopt" ? (ko ? "분석 결과 채택" : "Adopt analysis result")
          : mode === "actual" ? (ko ? "종점 실제값 지정" : "Set actual endpoint result")
        : (ko ? "입력 기록 수정" : "Correct input record");

  function submit(event) {
    event.preventDefault();
    if (!ready) return;
    if (onConfirm({ changes: changes(), reason: form.reason.trim() }) === false) return;
    commit();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form ref={dialogRef} tabIndex="-1" className="event-modal correction-modal" role="dialog" aria-modal="true" aria-labelledby="correction-modal-title" onSubmit={submit}>
        <div className="modal-header"><div><span>{heat.id}</span><h2 id="correction-modal-title">{title}</h2></div><button type="button" onClick={onClose} aria-label={ko ? "닫기" : "Close"}><X /></button></div>
        <div className="correction-target"><strong>{labels[type]?.[ko ? 0 : 1] ?? target?.summaryKo ?? type}</strong><span>{target?.summaryKo ?? ""}</span></div>
        <section className="impact-preview" aria-label={ko ? "영향 미리보기" : "Impact preview"}>
          <WarningCircle weight="fill" />
          <div><strong>{ko ? "변경 영향 미리보기" : "Change impact preview"}</strong><p>{ko ? `이후 기록 ${impact.laterEvents}건, 샘플 ${impact.laterSamples}건, 단계 ${impact.laterStages}건, 예상 스냅샷 ${impact.predictionSnapshots}건을 다시 검사합니다.` : `${impact.laterEvents} later records, ${impact.laterSamples} samples, ${impact.laterStages} stages, and ${impact.predictionSnapshots} prediction snapshots will be rechecked.`}</p></div>
        </section>
        {dirty && <div className="draft-status" role="status"><strong>{restored ? (ko ? "저장되지 않은 정정 초안을 복구했습니다." : "Unsaved correction draft restored.") : (ko ? "정정 초안이 이 PC에 자동 보관됩니다." : "The correction draft is preserved automatically on this PC.")}</strong><button type="button" onClick={() => { discard(); onClose(); }}>{ko ? "초안 버리기" : "Discard draft"}</button></div>}
        {mode === "correct" || mode === "tap" ? <div className="form-grid correction-fields">
          <label className="full"><span>{ko ? "실제 발생 시각" : "Actual time"}</span><input type="datetime-local" step="1" value={form.occurredAt} onChange={(event) => set("occurredAt", event.target.value)} required /></label>
          {type === "sample" && <label className="full"><span>{ko ? "샘플 ID" : "Sample ID"}</span><input value={form.sampleId} onChange={(event) => set("sampleId", event.target.value)} required /></label>}
          {type === "material" && <label><span>{ko ? "투입량" : "Amount"} (kg)</span><input type="number" min="0.001" step="0.001" value={form.amountKg} onChange={(event) => set("amountKg", event.target.value)} required /></label>}
          {type === "checkpoint" && <><label><span>{ko ? "누적 산소" : "Cumulative oxygen"} (Nm³)</span><input type="number" min="0" value={form.cumulativeOxygenNm3} onChange={(event) => set("cumulativeOxygenNm3", event.target.value)} required /></label><label><span>{ko ? "랜스 높이" : "Lance height"} (m)</span><input type="number" min="0" step="0.1" value={form.lanceHeightM} onChange={(event) => set("lanceHeightM", event.target.value)} /></label><label><span>{ko ? "산소 유량" : "Oxygen flow"} (Nm³/min)</span><input type="number" min="0" value={form.oxygenFlowNm3PerMinute} onChange={(event) => set("oxygenFlowNm3PerMinute", event.target.value)} /></label><label><span>{ko ? "잔여시간" : "Remaining time"} (min)</span><input type="number" min="0" value={form.remainingMinutes} onChange={(event) => set("remainingMinutes", event.target.value)} /></label></>}
          {type === "reblow" && <><label><span>{ko ? "추가 산소" : "Additional oxygen"} (Nm³)</span><input type="number" min="0.001" value={form.additionalOxygenNm3} onChange={(event) => set("additionalOxygenNm3", event.target.value)} required /></label><label><span>{ko ? "지속시간" : "Duration"} (min)</span><input type="number" min="0" value={form.durationMinutes} onChange={(event) => set("durationMinutes", event.target.value)} /></label></>}
          {type === "analysis" && <><label><span>{ko ? "분석 방법" : "Method"}</span><input value={form.method} onChange={(event) => set("method", event.target.value)} /></label><label><span>{ko ? "샘플 시점 누적 산소" : "Oxygen at sample"} (Nm³)</span><input type="number" min="0" value={form.cumulativeOxygenNm3} onChange={(event) => set("cumulativeOxygenNm3", event.target.value)} /></label>{["C", "P", "Mn", "Si", "S"].map((key) => <label key={key}><span>{key} (%)</span><input type="number" min="0" max="100" step="0.001" value={form[key]} onChange={(event) => set(key, event.target.value)} /></label>)}<label><span>T (°C)</span><input type="number" min="0" max="2500" value={form.temperature} onChange={(event) => set("temperature", event.target.value)} /></label></>}
        </div> : <p className="correction-warning">{mode === "rollback" ? (ko ? "현재 단계에서 만든 기록은 삭제하지 않고 무효 상태로 보존한 뒤 이전 단계로 돌아갑니다." : "Records created in the current stage will be kept as voided before returning to the previous stage.") : mode === "adopt" ? (ko ? "선택한 분석 결과가 현재 종점 참고예상에 사용됩니다. 다른 샘플의 채택 상태는 해제됩니다." : "The selected result will be used for the current endpoint estimate and other adopted samples will be cleared.") : mode === "actual" ? (ko ? "선택한 분석 결과를 예상 정확도 검증에 사용하는 실제 종점값으로 지정합니다." : "The selected result will be used as the actual endpoint value for prediction validation.") : (ko ? "원본 기록은 삭제하지 않고 무효 상태와 사유를 보존합니다." : "The original record will be preserved with a void status and reason.")}</p>}
        <label className="correction-standard-reason"><span>{ko ? "표준 사유" : "Standard reason"}</span><select value={standardReasons[ko ? "ko" : "en"].includes(form.reason) ? form.reason : ""} onChange={(event) => set("reason", event.target.value)}><option value="">{ko ? "직접 입력" : "Type a custom reason"}</option>{standardReasons[ko ? "ko" : "en"].map((reason) => <option key={reason} value={reason}>{reason}</option>)}</select></label><label className="correction-reason"><span>{ko ? "정정·취소 사유" : "Correction reason"}</span><textarea value={form.reason} onChange={(event) => set("reason", event.target.value)} required /></label>
        {!validation.ok && <p className="field-error" role="alert">{validationMessage(validation.reason, locale)}</p>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{ko ? "닫기" : "Close"}</button><button type="submit" className={mode === "void" || mode === "rollback" ? "danger-button" : "primary"} disabled={!ready}>{ko ? "영향 확인 후 적용" : "Apply after review"}</button></div>
      </form>
    </div>
  );
}
