import { useState } from "react";
import { ArrowCounterClockwise, LockKey, LockKeyOpen, Trash } from "@phosphor-icons/react";
import { validatePortableRecoveryPoint } from "../domain/jsonBackupSchema.js";

function formatDate(value, locale) {
  return new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-GB", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
}

export function RecoveryPointList({ points, locale, canWrite, onCreate, onProtect, onRemove, onRestore }) {
  const [armed, setArmed] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const ko = locale === "ko";

  async function execute(id, action) {
    setBusyId(id);
    await action();
    setBusyId(null);
    setArmed(null);
  }

  return <section className="panel recovery-panel">
    <div className="panel-title"><div><h2>{ko ? "내부 복구점" : "Internal recovery points"}</h2><span>{ko ? "중요 작업 전 자동 생성 · 일반 20개/30일 · 보호 항목 유지" : "Created before important changes · 20/30-day rotation · protected points retained"}</span></div><button type="button" className="table-action" disabled={!canWrite} onClick={() => onCreate(false)}>{ko ? "현재 상태 복구점 만들기" : "Create recovery point"}</button></div>
    <div className="table-scroll"><table><thead><tr><th>{ko ? "시각·이유" : "Time · reason"}</th><th>{ko ? "작업자" : "Operator"}</th><th>{ko ? "차지" : "Heats"}</th><th>{ko ? "저장 revision" : "Storage revision"}</th><th>{ko ? "보호" : "Protection"}</th><th>{ko ? "작업" : "Actions"}</th></tr></thead><tbody>
      {points.slice(0, 30).map((point) => {
        const portability = validatePortableRecoveryPoint(point);
        return <tr key={point.id}><td><strong>{locale === "ko" ? point.labelKo : point.labelEn}</strong><small>{formatDate(point.createdAt, locale)} · {point.reason}</small>{!portability.valid && <small className="validation-error">{ko ? "구형 정합성 오류 · 복원 및 외부 백업 제외" : "Legacy integrity error · restore/export disabled"}</small>}</td><td>{point.operator || "–"}</td><td>{point.summary?.activeHeatCount ?? 0} / {point.summary?.completedHeatCount ?? 0}<small>{ko ? "진행 / 완료" : "active / completed"}</small></td><td>{point.sourceRevision}</td><td><button type="button" className="icon-table-action" disabled={!canWrite || busyId === point.id} onClick={() => execute(point.id, () => onProtect(point.id, !point.protected))} aria-label={point.protected ? (ko ? "보호 해제" : "Unprotect") : (ko ? "자동 정리에서 보호" : "Protect from rotation")}>{point.protected ? <LockKey weight="fill" /> : <LockKeyOpen />}{point.protected ? (ko ? "보호됨" : "Protected") : (ko ? "일반" : "Rotating")}</button></td><td><div className="recovery-row-actions">{armed?.id === point.id && armed.action === "restore" ? <button type="button" className="danger-button compact" disabled={busyId === point.id || !portability.valid} onClick={() => execute(point.id, () => onRestore(point.id))}>{ko ? "복원 확인" : "Confirm restore"}</button> : <button type="button" className="table-action" disabled={!canWrite || busyId === point.id || !portability.valid} onClick={() => setArmed({ id: point.id, action: "restore" })}><ArrowCounterClockwise />{ko ? "복원" : "Restore"}</button>}{armed?.id === point.id && armed.action === "delete" ? <button type="button" className="danger-button compact" disabled={busyId === point.id} onClick={() => execute(point.id, () => onRemove(point.id))}>{ko ? "삭제 확인" : "Confirm delete"}</button> : <button type="button" className="icon-only-action" disabled={!canWrite || busyId === point.id} onClick={() => setArmed({ id: point.id, action: "delete" })} aria-label={ko ? "복구점 삭제" : "Delete recovery point"}><Trash /></button>}</div></td></tr>;
      })}
      {!points.length && <tr><td colSpan="6">{ko ? "아직 복구점이 없습니다. 단계 전환·전체 불러오기·계수 변경 전에 자동 생성됩니다." : "No recovery points yet. They are created before stage transitions, full restores, and coefficient changes."}</td></tr>}
    </tbody></table></div>
  </section>;
}
