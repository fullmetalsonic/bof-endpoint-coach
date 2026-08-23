import { useState } from "react";
import { Archive, ArrowClockwise, WarningCircle } from "@phosphor-icons/react";
import { createBackupBlob, downloadBlob } from "../reports/backup.js";

const labels = {
  error: {
    ko: ["로컬 저장에 실패했습니다.", "새 입력을 잠시 막았습니다. 다시 저장하거나 비상 백업을 먼저 받으십시오."],
    en: ["Local save failed.", "New writes are paused. Retry the save or download an emergency backup first."],
  },
  conflict: {
    ko: ["다른 창의 저장과 충돌했습니다.", "이 창의 상태는 덮어쓰지 않았습니다. 비상 백업 후 최신 저장소를 다시 읽으십시오."],
    en: ["A save from another window conflicts with this one.", "This window did not overwrite it. Download an emergency backup, then reload the latest workspace."],
  },
  stale: {
    ko: ["다른 창에서 작업공간이 변경됐습니다.", "현재 창은 읽기 전용입니다. 최신 저장소를 다시 읽으면 계속 입력할 수 있습니다."],
    en: ["The workspace changed in another window.", "This window is read-only until you reload the latest workspace."],
  },
};

export function StorageStatusBanner({ status, state, locale, onRetrySave, onReload }) {
  const [armed, setArmed] = useState(false);
  const [backupMessage, setBackupMessage] = useState("");
  const copy = labels[status]?.[locale === "ko" ? "ko" : "en"];
  if (!copy) return null;

  async function emergencyBackup() {
    if (!state) return;
    try {
      const at = new Date().toISOString();
      const filename = `bof-endpoint-coach-emergency-${at.replaceAll(":", "-").slice(0, 19)}.zip`;
      const blob = await createBackupBlob(state);
      downloadBlob(blob, filename);
      setBackupMessage(locale === "ko" ? "비상 백업을 저장했습니다." : "Emergency backup saved.");
    } catch (error) {
      setBackupMessage(`${locale === "ko" ? "비상 백업 실패" : "Emergency backup failed"}: ${error.message}`);
    }
  }

  return (
    <section className={`storage-status-banner ${status}`} role="alert" aria-live="assertive">
      <WarningCircle weight="fill" />
      <div><strong>{copy[0]}</strong><span>{copy[1]}</span>{backupMessage && <small>{backupMessage}</small>}</div>
      <div className="storage-status-actions">
        {state && <button type="button" onClick={emergencyBackup}><Archive />{locale === "ko" ? "비상 백업" : "Emergency backup"}</button>}
        {status === "error" && <button type="button" onClick={onRetrySave}><ArrowClockwise />{locale === "ko" ? "저장 재시도" : "Retry save"}</button>}
        {status !== "error" && !armed && <button type="button" onClick={() => setArmed(true)}><ArrowClockwise />{locale === "ko" ? "최신 상태 불러오기" : "Load latest"}</button>}
        {status !== "error" && armed && <><span className="reload-warning">{locale === "ko" ? "이 창의 미저장 상태가 바뀝니다." : "This window's unsaved state will be replaced."}</span><button className="danger-button" type="button" onClick={onReload}>{locale === "ko" ? "확인하고 불러오기" : "Confirm reload"}</button></>}
      </div>
    </section>
  );
}

export function StorageLoadFailure({ locale = "ko", error, onRetry }) {
  const ko = locale === "ko";
  return (
    <main className="storage-load-failure" role="alert">
      <WarningCircle weight="fill" />
      <h1>{ko ? "로컬 작업공간을 읽지 못했습니다" : "Could not read the local workspace"}</h1>
      <p>{ko ? "기존 데이터를 보호하기 위해 빈 작업공간을 만들거나 저장하지 않았습니다. 브라우저 저장소 상태를 확인한 뒤 다시 시도하십시오." : "No empty workspace was created or saved, protecting the existing data. Check browser storage and retry."}</p>
      {error && <code>{error}</code>}
      <button className="primary-button" type="button" onClick={onRetry}><ArrowClockwise />{ko ? "다시 읽기" : "Retry load"}</button>
    </main>
  );
}
