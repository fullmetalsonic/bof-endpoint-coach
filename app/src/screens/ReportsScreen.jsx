import { useRef, useState } from "react";
import { Archive, FileXls, ArrowCounterClockwise, WarningCircle, X } from "@phosphor-icons/react";
import { createBackupBlob, downloadBlob, restoreBackup } from "../reports/backup.js";

export function ReportsScreen({ state, recovery, locale, t, onRestore, onOperation, onReset, onRestoreRecovery }) {
  const fileInput = useRef(null);
  const [message, setMessage] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function backup() {
    setBusy(true);
    try {
      const at = new Date().toISOString();
      const filename = `bof-endpoint-coach-backup-${at.slice(0, 10)}.zip`;
      const backupState = { ...state, operationLog: [...(state.operationLog ?? []), { id: `LOG-${crypto.randomUUID()}`, type: "backup_exported", at, filename }] };
      const blob = await createBackupBlob(backupState);
      downloadBlob(blob, filename);
      onOperation("backup_exported", { filename });
      setMessage(locale === "ko" ? "CSV 백업 묶음을 생성했습니다." : "CSV backup package created.");
    } catch (error) {
      onOperation("backup_failed", { reason: error.message });
      setMessage(`${locale === "ko" ? "백업 실패" : "Backup failed"}: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }
  async function restore(file) {
    setBusy(true);
    try {
      const nonDemo = state.heats.some((heat) => !heat.demo);
      if (nonDemo) throw new Error("restore_requires_empty_store");
      const restored = await restoreBackup(file);
      onRestore(restored);
      setMessage(locale === "ko" ? "해시 검증 후 전체 복원을 완료했습니다." : "Full restore completed after hash verification.");
    } catch (error) {
      onOperation("restore_failed", { reason: error.message });
      setMessage(`${locale === "ko" ? "복원 실패" : "Restore failed"}: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }
  async function excel() {
    setBusy(true);
    try {
      const { exportExcelReport } = await import("../reports/excel.js");
      await exportExcelReport(state);
      onOperation("excel_exported", { filename: "bof-endpoint-coach-report.xlsx" });
      setMessage(locale === "ko" ? "Excel 보고서를 생성했습니다." : "Excel report created.");
    } catch (error) {
      onOperation("excel_failed", { reason: error.message });
      setMessage(`${locale === "ko" ? "Excel 생성 실패" : "Excel export failed"}: ${error.message}`);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="workspace-screen reports-screen" data-testid="reports-screen">
      <div className="workspace-heading"><div><span>CSV · XLSX</span><h1>{t("reportsTitle")}</h1><p>{t("reportHelp")}</p></div></div>
      <div className="report-grid">
        <button type="button" disabled={busy} onClick={backup}><Archive /><strong>{t("exportBackup")}</strong><span>ZIP · UTF-8 CSV · SHA-256</span></button>
        <button type="button" disabled={busy} onClick={() => fileInput.current?.click()}><ArrowCounterClockwise /><strong>{t("restoreBackup")}</strong><span>{locale === "ko" ? "가상 데모 또는 빈 저장소에서만" : "Demo or empty store only"}</span></button>
        <button type="button" disabled={busy} onClick={excel}><FileXls /><strong>{t("exportExcel")}</strong><span>XLSX · Heat summary · Events · Analysis</span></button>
      </div>
      <input ref={fileInput} hidden type="file" accept=".zip" onChange={(event) => { const file = event.target.files[0]; event.target.value = ""; if (file) restore(file); }} />
      <section className="report-status panel"><WarningCircle /><div><strong>{t("validationWarning")}</strong><p>{message || (locale === "ko" ? "아직 실행한 파일 작업이 없습니다." : "No file operation has run yet.")}</p></div></section>
      <div className="recovery-actions"><button className="reset-button" type="button" onClick={() => setResetOpen(true)}>{locale === "ko" ? "작업공간 초기화" : "Reset workspace"}</button>{recovery?.state && <button className="secondary-button" type="button" onClick={onRestoreRecovery}>{locale === "ko" ? `직전 상태 복구 (${new Date(recovery.savedAt).toLocaleString("ko-KR")})` : "Restore previous workspace"}</button>}</div>
      {resetOpen && <div className="modal-backdrop" role="presentation"><div className="event-modal" role="dialog" aria-modal="true"><div className="modal-header"><div><span>RECOVERY SNAPSHOT</span><h2>{locale === "ko" ? "작업공간 초기화 확인" : "Confirm workspace reset"}</h2></div><button type="button" onClick={() => setResetOpen(false)}><X /></button></div><div className="lifecycle-content"><p>{locale === "ko" ? "현재 상태를 복구 슬롯에 한 번 보관한 뒤 초기화합니다. 원하는 시작 상태를 선택하십시오." : "The current state is saved once in the recovery slot before reset. Choose the new starting state."}</p></div><div className="modal-actions"><button type="button" className="secondary" onClick={() => setResetOpen(false)}>{t("cancel")}</button><button type="button" className="secondary" onClick={() => { onReset("demo"); setResetOpen(false); }}>{locale === "ko" ? "DEMO로 초기화" : "Reset to DEMO"}</button><button type="button" className="danger-button" onClick={() => { onReset("empty"); setResetOpen(false); }}>{locale === "ko" ? "빈 작업으로 초기화" : "Reset empty"}</button></div></div></div>}
    </main>
  );
}
