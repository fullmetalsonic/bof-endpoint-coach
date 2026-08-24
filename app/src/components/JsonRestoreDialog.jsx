import { useState } from "react";
import { ShieldCheck, WarningCircle, X } from "@phosphor-icons/react";
import { jsonBackupSummary } from "../reports/jsonBackup.js";
import { useDialogFocus } from "../hooks/useDialogFocus.js";

function summaryRows(summary, locale) {
  return [
    [locale === "ko" ? "전체 차지" : "All heats", summary.heatCount],
    [locale === "ko" ? "진행 차지" : "Active heats", summary.activeHeatCount],
    [locale === "ko" ? "완료 차지" : "Completed heats", summary.completedHeatCount],
    [locale === "ko" ? "실제 / DEMO" : "Field / DEMO", `${summary.fieldHeatCount} / ${summary.demoHeatCount}`],
    [locale === "ko" ? "조업 이벤트" : "Process events", summary.eventCount],
    [locale === "ko" ? "확정 오차 행" : "Residual rows", summary.residualCount],
    [locale === "ko" ? "학습 실행" : "Training runs", summary.trainingRunCount],
    [locale === "ko" ? "투입 계획 / 코치안" : "Addition plans / proposals", `${summary.additionPlanCount ?? 0} / ${summary.additionProposalCount ?? 0}`],
    [locale === "ko" ? "투입 효과 근거" : "Addition evidence", summary.additionEvidenceCount ?? 0],
    [locale === "ko" ? "투입계수 버전" : "Addition-model versions", summary.additionModelVersionCount ?? 0],
    [locale === "ko" ? "복구점" : "Recovery points", summary.recoveryPointCount],
  ];
}

export function JsonRestoreDialog({ parsedBackup, currentState, currentRecoveryPoints, locale, onClose, onConfirm, onSaveCurrent }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const dialogRef = useDialogFocus({ onClose: busy ? undefined : onClose });
  const current = jsonBackupSummary(currentState, currentRecoveryPoints);
  const incoming = parsedBackup.preview.summary;
  const ko = locale === "ko";

  async function confirm() {
    setBusy(true);
    const ok = await onConfirm(parsedBackup);
    setBusy(false);
    if (ok) onClose();
  }

  return <div className="modal-backdrop" role="presentation"><div ref={dialogRef} tabIndex="-1" className="event-modal json-restore-dialog" role="dialog" aria-modal="true" aria-labelledby="json-restore-title">
    <div className="modal-header"><div><span>VERIFIED FULL RESTORE</span><h2 id="json-restore-title">{ko ? "JSON 백업 전체 불러오기" : "Full JSON backup restore"}</h2></div><button type="button" disabled={busy} onClick={onClose} aria-label={ko ? "닫기" : "Close"}><X /></button></div>
    <div className="restore-verification"><ShieldCheck weight="fill" /><div><strong>{ko ? "파일 검증 통과" : "File verification passed"}</strong><span>SHA-256 {parsedBackup.sha256.slice(0, 16)}… · schema {parsedBackup.preview.schemaVersion} · app {parsedBackup.preview.appVersion}</span></div></div>
    <div className="restore-compare">
      <section><h3>{ko ? "현재 작업공간" : "Current workspace"}</h3><dl>{summaryRows(current, locale).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section>
      <section><h3>{ko ? "불러올 백업" : "Incoming backup"}</h3><dl>{summaryRows(incoming, locale).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p>{new Date(parsedBackup.preview.createdAt).toLocaleString(ko ? "ko-KR" : "en-GB")} · {parsedBackup.preview.operatorName || (ko ? "작업자 미입력" : "Operator not set")}</p></section>
    </div>
    <div className="restore-warning"><WarningCircle weight="fill" /><p>{ko ? "자동 병합하지 않고 현재 작업공간 전체를 교체합니다. 적용 직전 현재 상태를 보호 복구점으로 남기며 7일 동안 ‘마지막 불러오기 취소’를 사용할 수 있습니다." : "This does not merge data; it replaces the whole workspace. A protected recovery point is created first, and the last restore can be undone for 7 days."}</p></div>
    <label className="restore-arm"><input type="checkbox" checked={armed} onChange={(event) => setArmed(event.target.checked)} /><span>{ko ? "현재 데이터와 백업의 차이를 확인했으며 전체 교체를 진행합니다." : "I reviewed the differences and want to replace the full workspace."}</span></label>
    <div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>{ko ? "취소" : "Cancel"}</button><button type="button" className="secondary" disabled={busy} onClick={onSaveCurrent}>{ko ? "현재 데이터 JSON 저장" : "Save current JSON"}</button><button type="button" className="danger-button" disabled={busy || !armed} onClick={confirm}>{busy ? (ko ? "교체 중…" : "Replacing…") : (ko ? "검증된 백업으로 전체 교체" : "Replace with verified backup")}</button></div>
  </div></div>;
}
