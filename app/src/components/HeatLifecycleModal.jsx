import { useState } from "react";
import { X } from "@phosphor-icons/react";
import { useDialogFocus } from "../hooks/useDialogFocus.js";

export function HeatLifecycleModal({ heat, action, locale, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const ko = locale === "ko";
  const labels = {
    delete: [ko ? "차지 삭제" : "Delete heat", ko ? "이 차지의 입력 이력을 이 PC에서 삭제합니다." : "Remove this heat and its local entries."],
    cancel: [ko ? "차지 취소" : "Cancel heat", ko ? "조업이 중단된 차지로 남깁니다. 취소 사유를 입력하십시오." : "Keep this as a cancelled heat. Enter a reason."],
    archive: [ko ? "차지 보관" : "Archive heat", ko ? "완료 목록에서 보관 상태로 이동합니다." : "Move the closed heat to archived status."],
  };
  const [title, description] = labels[action];
  const ready = action !== "cancel" || reason.trim();
  const dialogRef = useDialogFocus({ onClose });
  return (
    <div className="modal-backdrop" role="presentation"><form ref={dialogRef} tabIndex="-1" className="event-modal lifecycle-modal" role="dialog" aria-modal="true" aria-labelledby="lifecycle-modal-title" onSubmit={(event) => { event.preventDefault(); if (ready) onConfirm(reason.trim()); }}>
      <div className="modal-header"><div><span>{heat.id}</span><h2 id="lifecycle-modal-title">{title}</h2></div><button type="button" onClick={onClose} aria-label={ko ? "닫기" : "Close"}><X /></button></div>
      <div className="lifecycle-content"><p>{description}</p>{action === "cancel" && <label><span>{ko ? "취소 사유" : "Cancellation reason"}</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} required /></label>}</div>
      <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{ko ? "돌아가기" : "Back"}</button><button type="submit" className={action === "delete" ? "danger-button" : "primary"} disabled={!ready}>{title}</button></div>
    </form></div>
  );
}
