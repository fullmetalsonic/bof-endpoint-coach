import { useState } from "react";
import { UserCircle, X } from "@phosphor-icons/react";

export function OperatorModal({ initialName = "", locale, firstRun = false, onClose, onSave }) {
  const [displayName, setDisplayName] = useState(initialName);
  const ready = displayName.trim().length > 0;
  const ko = locale === "ko";
  return (
    <div className="modal-backdrop" role="presentation">
      <form className="event-modal operator-modal" role="dialog" aria-modal="true" onSubmit={(event) => { event.preventDefault(); if (ready) onSave({ displayName: displayName.trim(), mode: "empty" }); }}>
        <div className="modal-header"><div><span>LOCAL OPERATOR</span><h2>{firstRun ? (ko ? "처음 사용할 작업자 설정" : "First-use operator setup") : (ko ? "작업자 이름 수정" : "Edit operator name")}</h2></div>{!firstRun && <button type="button" onClick={onClose} aria-label={ko ? "닫기" : "Close"}><X /></button>}</div>
        <div className="operator-content">
          <UserCircle />
          <p>{ko ? "로그인이 아닙니다. 이 PC에서 입력한 기록과 단계 전환에 표시할 이름입니다." : "This is not a login. The name is stored with entries and stage transitions on this PC."}</p>
          <label><span>{ko ? "작업자 이름" : "Operator name"}</span><input autoFocus value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={ko ? "예: 김철수" : "e.g. Alex Kim"} required /></label>
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
