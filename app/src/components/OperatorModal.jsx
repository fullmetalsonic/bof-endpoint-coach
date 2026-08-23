import { useState } from "react";
import { UserCircle, X } from "@phosphor-icons/react";
import { useDialogFocus } from "../hooks/useDialogFocus.js";

export function OperatorModal({ initialName = "", locale, firstRun = false, onClose, onSave }) {
  const [displayName, setDisplayName] = useState(initialName);
  const ready = displayName.trim().length > 0;
  const ko = locale === "ko";
  const dialogRef = useDialogFocus({ onClose, closeOnEscape: !firstRun });
  return (
    <div className="modal-backdrop" role="presentation">
      <form ref={dialogRef} tabIndex="-1" className="event-modal operator-modal" role="dialog" aria-modal="true" aria-label={ko ? "작업자 설정 대화상자" : "Operator settings dialog"} onSubmit={(event) => { event.preventDefault(); if (ready) onSave({ displayName: displayName.trim(), mode: "empty" }); }}>
        <div className="modal-header"><div><span>LOCAL OPERATOR</span><h2 id="operator-modal-title">{firstRun ? (ko ? "처음 사용할 작업자 설정" : "First-use operator setup") : (ko ? "작업자 이름 수정" : "Edit operator name")}</h2></div>{!firstRun && <button type="button" onClick={onClose} aria-label={ko ? "닫기" : "Close"}><X /></button>}</div>
        <div className="operator-content">
          <UserCircle />
          <p>{ko ? "로그인이 아닙니다. 이 PC에서 입력한 기록과 단계 전환에 표시할 이름입니다." : "This is not a login. The name is stored with entries and stage transitions on this PC."}</p>
          <label><span>{ko ? "작업자 이름" : "Operator name"}</span><input autoFocus value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={ko ? "예: 김철수" : "e.g. Alex Kim"} required /></label>
          {firstRun && <><div className="onboarding-choice-grid"><div><strong>{ko ? "DEMO로 체험" : "Try DEMO"}</strong><span>{ko ? "공개 문헌 기반 합성 차지로 버튼·단계·정정 흐름을 연습합니다. 실제 회사 데이터가 아닙니다." : "Practice buttons, stages, and corrections with synthetic public-literature data. It is not company data."}</span></div><div><strong>{ko ? "빈 작업으로 시작" : "Start empty"}</strong><span>{ko ? "차지 없이 시작해 기준 정보를 확인한 뒤 작업자가 실제 값을 직접 입력합니다." : "Start with no heat, review settings, then manually enter actual values."}</span></div></div><p className="operator-required" role="status">{ready ? (ko ? "이름이 준비되었습니다. 시작 방식을 선택하십시오." : "Name ready. Choose a start mode.") : (ko ? "작업자 이름을 입력하면 두 시작 버튼을 사용할 수 있습니다." : "Enter an operator name to enable both start buttons.")}</p></>}
        </div>
        <div className="modal-actions">
          {!firstRun && <button type="button" className="secondary" onClick={onClose}>{ko ? "취소" : "Cancel"}</button>}
          {firstRun && <button type="button" className="secondary" disabled={!ready} onClick={() => onSave({ displayName: displayName.trim(), mode: "demo" })}>{ko ? "DEMO로 체험" : "Try DEMO"}</button>}
          <button type="submit" className="primary" disabled={!ready}>{firstRun ? (ko ? "빈 작업으로 시작" : "Start empty") : (ko ? "저장" : "Save")}</button>
        </div>
      </form>
    </div>
  );
}
