import { useRef, useState } from "react";
import { Archive, ArrowCounterClockwise, Database, DownloadSimple, FileXls, ShieldCheck, UploadSimple, WarningCircle, X } from "@phosphor-icons/react";
import { createBackupBlob, downloadBlob, restoreBackup } from "../reports/backup.js";
import { createJsonBackup, parseJsonBackup } from "../reports/jsonBackup.js";
import { backupStatus } from "../domain/backupStatus.js";
import { JsonRestoreDialog } from "../components/JsonRestoreDialog.jsx";
import { RecoveryPointList } from "../components/RecoveryPointList.jsx";
import { useDialogFocus } from "../hooks/useDialogFocus.js";

async function blobSha256(blob) {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function ResetConfirmDialog({ locale, t, onClose, onReset }) {
  const [busy, setBusy] = useState(false);
  const dialogRef = useDialogFocus({ onClose: busy ? undefined : onClose });
  const run = async (mode) => { setBusy(true); const ok = await onReset(mode); setBusy(false); if (ok) onClose(); };
  return <div className="modal-backdrop" role="presentation"><div ref={dialogRef} tabIndex="-1" className="event-modal" role="dialog" aria-modal="true" aria-labelledby="reset-dialog-title"><div className="modal-header"><div><span>PROTECTED RECOVERY POINT</span><h2 id="reset-dialog-title">{locale === "ko" ? "작업공간 초기화 확인" : "Confirm workspace reset"}</h2></div><button type="button" disabled={busy} onClick={onClose} aria-label={locale === "ko" ? "닫기" : "Close"}><X /></button></div><div className="lifecycle-content"><p>{locale === "ko" ? "현재 상태를 보호 복구점으로 보관한 뒤 초기화합니다. 초기화가 끝나도 복구점 목록에서 되돌릴 수 있습니다." : "The current workspace is saved as a protected recovery point before reset, so it can be restored later."}</p></div><div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={onClose}>{t("cancel")}</button><button type="button" className="secondary" disabled={busy} onClick={() => run("demo")}>{locale === "ko" ? "DEMO로 초기화" : "Reset to DEMO"}</button><button type="button" className="danger-button" disabled={busy} onClick={() => run("empty")}>{locale === "ko" ? "빈 작업으로 초기화" : "Reset empty"}</button></div></div></div>;
}

function messageText(message, locale) {
  const ko = locale === "ko";
  if (!message) return "";
  if (message.type === "json_success") return ko ? `JSON 생성·재읽기 검증 완료 · ${message.heatCount}차지 · SHA-256 ${message.sha256.slice(0, 12)}…${message.omittedRecoveryPoints ? ` · 정합성 실패 구형 복구점 ${message.omittedRecoveryPoints}개는 로컬에 유지하고 JSON에서 제외` : ""}` : `JSON created and read-verified · ${message.heatCount} heats · SHA-256 ${message.sha256.slice(0, 12)}…${message.omittedRecoveryPoints ? ` · ${message.omittedRecoveryPoints} invalid legacy recovery point(s) kept locally and omitted from JSON` : ""}`;
  if (message.type === "json_restore_success") return ko ? "검증된 JSON으로 전체 교체했습니다. 7일 안에 마지막 불러오기를 취소할 수 있습니다." : "The workspace was replaced with the verified JSON. The last restore can be undone for 7 days.";
  if (message.type === "restore_undo_success") return ko ? "마지막 JSON 불러오기를 취소하고 직전 작업공간을 복원했습니다." : "The last JSON restore was undone and the prior workspace was restored.";
  if (message.type === "zip_success") return ko ? "호환용 CSV ZIP 생성·재읽기 검증 완료" : "Compatibility CSV ZIP created and read-verified";
  if (message.type === "legacy_restore_success") return ko ? "구형 ZIP 복원을 완료했습니다." : "Legacy ZIP restore completed.";
  if (message.type === "excel_success") return ko ? "Excel 보고서를 생성했습니다." : "Excel report created.";
  if (message.type === "failure") return `${ko ? "작업 실패" : "Operation failed"}: ${message.detail}`;
  return "";
}

export function ReportsScreen({ state, storageMeta, recoveryPoints, recoveryError, locale, t, onRestore, onRestoreJson, onOperation, onReset, onUndoJsonRestore, onCreateRecovery, onProtectRecovery, onRemoveRecovery, onRestoreRecoveryPoint, canWrite = true }) {
  const jsonInput = useRef(null);
  const zipInput = useRef(null);
  const [message, setMessage] = useState(null);
  const [parsedBackup, setParsedBackup] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ko = locale === "ko";
  const external = backupStatus(state);
  const restoreMetadata = state.restoreMetadata;
  const undoAvailable = restoreMetadata?.undoUntil && new Date(restoreMetadata.undoUntil) >= new Date()
    && recoveryPoints.some((point) => point.id === restoreMetadata.safetyRecoveryPointId);

  async function saveJson() {
    setBusy(true);
    try {
      const exportState = { ...state, storageRevision: storageMeta.revision, lastSavedAt: storageMeta.lastSavedAt };
      const created = await createJsonBackup(exportState, recoveryPoints);
      downloadBlob(created.blob, created.filename);
      onOperation("json_backup_exported", { filename: created.filename, sha256: created.sha256, bytes: created.blob.size, heatCount: created.preview.summary.heatCount, readVerified: true });
      setMessage({ type: "json_success", heatCount: created.preview.summary.heatCount, sha256: created.sha256, omittedRecoveryPoints: created.preview.recoveryPointWarnings?.length ?? 0 });
      return true;
    } catch (error) {
      onOperation("json_backup_failed", { reason: error.message });
      setMessage({ type: "failure", detail: error.message });
      return false;
    } finally { setBusy(false); }
  }

  async function inspectJson(file) {
    setBusy(true);
    try {
      const parsed = await parseJsonBackup(file);
      parsed.preview.filename = file.name;
      setParsedBackup(parsed);
      setMessage(null);
    } catch (error) {
      onOperation("json_restore_validation_failed", { filename: file.name, reason: error.message });
      setMessage({ type: "failure", detail: error.message });
    } finally { setBusy(false); }
  }

  async function confirmJsonRestore(parsed) {
    const ok = await onRestoreJson(parsed);
    setMessage(ok ? { type: "json_restore_success" } : { type: "failure", detail: recoveryError || "storage_write_failed" });
    return ok;
  }

  async function saveCompatibilityZip() {
    setBusy(true);
    try {
      const at = new Date().toISOString();
      const filename = `bof-endpoint-coach-compatibility-${at.slice(0, 10)}.zip`;
      const blob = await createBackupBlob(state);
      const verified = await restoreBackup(new File([blob], filename, { type: "application/zip" }));
      const sha256 = await blobSha256(blob);
      downloadBlob(blob, filename);
      onOperation("compatibility_zip_exported", { filename, sha256, bytes: blob.size, heatCount: verified.heats.length, readVerified: true });
      setMessage({ type: "zip_success" });
    } catch (error) {
      onOperation("compatibility_zip_failed", { reason: error.message });
      setMessage({ type: "failure", detail: error.message });
    } finally { setBusy(false); }
  }

  async function restoreLegacyZip(file) {
    setBusy(true);
    try {
      const nonDemo = state.heats.some((heat) => !heat.demo);
      if (nonDemo) throw new Error("restore_requires_empty_store");
      const restored = await restoreBackup(file);
      const ok = await onRestore(restored);
      if (!ok) throw new Error("storage_write_locked");
      setMessage({ type: "legacy_restore_success" });
    } catch (error) {
      onOperation("restore_failed", { reason: error.message });
      setMessage({ type: "failure", detail: error.message });
    } finally { setBusy(false); }
  }

  async function excel() {
    setBusy(true);
    try {
      const { exportExcelReport } = await import("../reports/excel.js");
      await exportExcelReport(state);
      onOperation("excel_exported", { filename: "bof-endpoint-coach-report.xlsx" });
      setMessage({ type: "excel_success" });
    } catch (error) {
      onOperation("excel_failed", { reason: error.message });
      setMessage({ type: "failure", detail: error.message });
    } finally { setBusy(false); }
  }

  return <main className="workspace-screen reports-screen" data-testid="reports-screen">
    <div className="workspace-heading"><div><span>INDEXEDDB · JSON · RECOVERY · CSV · XLSX</span><h1>{ko ? "저장 · 복구 · 보고서" : "Storage · recovery · reports"}</h1><p>{ko ? "평상시 작업은 브라우저에 자동저장됩니다. JSON은 브라우저 삭제·PC 이동에 대비한 외부 백업이며, Excel은 열람용입니다." : "Routine work is autosaved in the browser. JSON is the external backup for browser deletion or PC transfer; Excel is for viewing."}</p></div></div>
    <section className="storage-overview panel" aria-label={ko ? "저장 상태 요약" : "Storage status summary"}>
      <div><Database weight="fill" /><span>{ko ? "브라우저 자동저장" : "Browser autosave"}</span><strong>{storageMeta.lastSavedAt ? (ko ? "완료" : "Saved") : (ko ? "첫 저장 전" : "Not saved yet")}</strong><small>{storageMeta.lastSavedAt ? `${new Date(storageMeta.lastSavedAt).toLocaleString(ko ? "ko-KR" : "en-GB")} · revision ${storageMeta.revision}` : "IndexedDB"}</small></div>
      <div className={external.required ? "needs-backup" : "backup-current"}><Archive weight="fill" /><span>{ko ? "외부 JSON 백업" : "External JSON backup"}</span><strong>{external.required ? (ko ? "백업 필요" : "Backup needed") : (ko ? "최신" : "Current")}</strong><small>{external.lastJsonAt ? new Date(external.lastJsonAt).toLocaleString(ko ? "ko-KR" : "en-GB") : (ko ? "아직 생성 안 됨" : "Not created yet")}</small></div>
      <div><ShieldCheck weight="fill" /><span>{ko ? "내부 복구점" : "Recovery points"}</span><strong>{recoveryPoints.length}</strong><small>{ko ? `${recoveryPoints.filter((point) => point.protected).length}개 보호됨` : `${recoveryPoints.filter((point) => point.protected).length} protected`}</small></div>
    </section>
    {external.required && <section className="external-backup-reminder" role="status"><WarningCircle weight="fill" /><div><strong>{ko ? "외부 백업이 현재 중요 변경을 포함하지 않습니다." : "The external backup does not include current important changes."}</strong><span>{ko ? "자동저장은 정상적으로 계속됩니다. 다만 브라우저 데이터 삭제나 PC 교체에 대비하려면 JSON을 저장하십시오." : "Browser autosave continues normally. Save JSON to protect against browser-data deletion or PC replacement."}</span></div></section>}
    <div className="json-actions"><button type="button" className="json-primary" disabled={busy} onClick={saveJson}><DownloadSimple weight="bold" /><strong>{ko ? "전체 데이터 JSON으로 저장" : "Save all data as JSON"}</strong><span>{ko ? "단일 파일 · UTF-8 · SHA-256 · 즉시 재읽기 검증" : "Single file · UTF-8 · SHA-256 · immediate read-back verification"}</span></button><button type="button" className="json-primary secondary-json" disabled={busy || !canWrite} onClick={() => jsonInput.current?.click()}><UploadSimple weight="bold" /><strong>{ko ? "JSON 백업 불러오기" : "Load JSON backup"}</strong><span>{ko ? "검사·비교 후 전체 교체 · 자동 병합 안 함" : "Verify and compare before full replace · no automatic merge"}</span></button></div>
    <input ref={jsonInput} hidden type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files[0]; event.target.value = ""; if (file) inspectJson(file); }} />
    {message && <section className={`report-status panel ${message.type === "failure" ? "failure" : "success"}`} role="status"><WarningCircle /><div><strong>{message.type === "failure" ? (ko ? "처리하지 못했습니다" : "Operation not completed") : (ko ? "작업 완료" : "Operation complete")}</strong><p>{messageText(message, locale)}</p></div></section>}
    {recoveryError && <section className="report-status panel failure" role="alert"><WarningCircle /><div><strong>{ko ? "복구 저장소 오류" : "Recovery storage error"}</strong><p>{recoveryError}</p></div></section>}
    {undoAvailable && <section className="restore-undo-banner"><ArrowCounterClockwise /><div><strong>{ko ? "마지막 JSON 불러오기 취소 가능" : "Last JSON restore can be undone"}</strong><span>{ko ? `${new Date(restoreMetadata.undoUntil).toLocaleString("ko-KR")}까지 직전 작업공간을 복원할 수 있습니다.` : `The previous workspace can be restored until ${new Date(restoreMetadata.undoUntil).toLocaleString("en-GB")}.`}</span></div><button type="button" disabled={!canWrite || busy} onClick={async () => { setBusy(true); const ok = await onUndoJsonRestore(); setBusy(false); setMessage(ok ? { type: "restore_undo_success" } : { type: "failure", detail: "restore_undo_failed" }); }}>{ko ? "마지막 불러오기 취소" : "Undo last restore"}</button></section>}
    <RecoveryPointList points={recoveryPoints} locale={locale} canWrite={canWrite} onCreate={onCreateRecovery} onProtect={onProtectRecovery} onRemove={onRemoveRecovery} onRestore={onRestoreRecoveryPoint} />
    <section className="panel compatibility-panel"><div className="panel-title"><div><h2>{ko ? "호환·열람 파일" : "Compatibility and viewing files"}</h2><span>{ko ? "기본 백업은 JSON입니다. 아래 파일은 구형 호환 또는 사람이 읽는 보고서입니다." : "JSON is the primary backup. The files below are for legacy compatibility or human-readable reports."}</span></div></div><div className="compatibility-actions"><button type="button" disabled={busy} onClick={saveCompatibilityZip}><Archive /><strong>{ko ? "호환용 CSV ZIP" : "Compatibility CSV ZIP"}</strong><span>CSV · SHA-256</span></button><button type="button" disabled={busy || !canWrite} onClick={() => zipInput.current?.click()}><ArrowCounterClockwise /><strong>{ko ? "구형 ZIP 불러오기" : "Load legacy ZIP"}</strong><span>{ko ? "빈 저장소 또는 DEMO에서만" : "Empty or DEMO workspace only"}</span></button><button type="button" disabled={busy} onClick={excel}><FileXls /><strong>{ko ? "Excel 보고서" : "Excel report"}</strong><span>{ko ? "열람·보고용 · 복원 불가" : "Viewing only · cannot restore"}</span></button></div></section>
    <input ref={zipInput} hidden type="file" accept=".zip,application/zip" onChange={(event) => { const file = event.target.files[0]; event.target.value = ""; if (file) restoreLegacyZip(file); }} />
    <div className="recovery-actions"><button className="reset-button" type="button" disabled={!canWrite || busy} onClick={() => setResetOpen(true)}>{ko ? "작업공간 초기화" : "Reset workspace"}</button></div>
    {parsedBackup && <JsonRestoreDialog parsedBackup={parsedBackup} currentState={state} currentRecoveryPoints={recoveryPoints} locale={locale} onClose={() => setParsedBackup(null)} onConfirm={confirmJsonRestore} onSaveCurrent={saveJson} />}
    {resetOpen && <ResetConfirmDialog locale={locale} t={t} onClose={() => setResetOpen(false)} onReset={onReset} />}
  </main>;
}
