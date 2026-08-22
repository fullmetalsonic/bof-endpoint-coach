import { useRef, useState } from "react";
import { Archive, FileXls, ArrowCounterClockwise, WarningCircle } from "@phosphor-icons/react";
import { createBackupBlob, downloadBlob, restoreBackup } from "../reports/backup.js";

export function ReportsScreen({ state, locale, t, onRestore, onOperation, onReset }) {
  const fileInput = useRef(null);
  const [message, setMessage] = useState("");
  async function backup() {
    const at = new Date().toISOString();
    const filename = `bof-endpoint-coach-backup-${at.slice(0, 10)}.zip`;
    const backupState = { ...state, operationLog: [...(state.operationLog ?? []), { id: `LOG-${crypto.randomUUID()}`, type: "backup_exported", at, filename }] };
    const blob = await createBackupBlob(backupState);
    downloadBlob(blob, filename);
    onOperation("backup_exported", { filename });
    setMessage(locale === "ko" ? "CSV 백업 묶음을 생성했습니다." : "CSV backup package created.");
  }
  async function restore(file) {
    try {
      const nonDemo = state.heats.some((heat) => !heat.id.startsWith("DEMO-"));
      if (nonDemo) throw new Error("restore_requires_empty_store");
      const restored = await restoreBackup(file);
      onRestore(restored);
      setMessage(locale === "ko" ? "해시 검증 후 전체 복원을 완료했습니다." : "Full restore completed after hash verification.");
    } catch (error) {
      onOperation("restore_failed", { reason: error.message });
      setMessage(`${locale === "ko" ? "복원 실패" : "Restore failed"}: ${error.message}`);
    }
  }
  async function excel() {
    const { exportExcelReport } = await import("../reports/excel.js");
    await exportExcelReport(state);
    onOperation("excel_exported", { filename: "bof-endpoint-coach-report.xlsx" });
    setMessage(locale === "ko" ? "Excel 보고서를 생성했습니다." : "Excel report created.");
  }
  return (
    <main className="workspace-screen reports-screen" data-testid="reports-screen">
      <div className="workspace-heading"><div><span>CSV · XLSX</span><h1>{t("reportsTitle")}</h1><p>{t("reportHelp")}</p></div></div>
      <div className="report-grid">
        <button type="button" onClick={backup}><Archive /><strong>{t("exportBackup")}</strong><span>ZIP · UTF-8 CSV · SHA-256</span></button>
        <button type="button" onClick={() => fileInput.current?.click()}><ArrowCounterClockwise /><strong>{t("restoreBackup")}</strong><span>{locale === "ko" ? "가상 데모 또는 빈 저장소에서만" : "Demo or empty store only"}</span></button>
        <button type="button" onClick={excel}><FileXls /><strong>{t("exportExcel")}</strong><span>XLSX · Heat summary · Events · Analysis</span></button>
      </div>
      <input ref={fileInput} hidden type="file" accept=".zip" onChange={(event) => event.target.files[0] && restore(event.target.files[0])} />
      <section className="report-status panel"><WarningCircle /><div><strong>{t("validationWarning")}</strong><p>{message || (locale === "ko" ? "아직 실행한 파일 작업이 없습니다." : "No file operation has run yet.")}</p></div></section>
      <button className="reset-button" type="button" onClick={onReset}>{t("resetDemo")}</button>
    </main>
  );
}
