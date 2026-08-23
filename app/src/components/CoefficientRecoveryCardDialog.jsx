import { useEffect, useMemo, useState } from "react";
import { ArrowsOut, ClipboardText, Printer, Table, X } from "@phosphor-icons/react";
import { buildRecoveryCardSnapshot, recoveryCardGroupOptions } from "../calibration/recoveryCardSnapshot.js";
import { formatRecoveryValue } from "../calibration/recoveryCardFields.js";
import { useDialogFocus } from "../hooks/useDialogFocus.js";
import { RecoveryCardView } from "./recovery/RecoveryCardView.jsx";
import { RecoveryCardForm } from "./recovery/RecoveryCardForm.jsx";

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = typeof document.execCommand === "function" && document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

function tableText(snapshot, detailed, locale) {
  const ko = locale === "ko";
  const headers = detailed
    ? [ko ? "성분" : "Item", ko ? "현재 적용" : "Applied", ko ? "학습 당시값" : "Learning current", ko ? "추천 증감" : "Recommended delta", ko ? "추천 후보값" : "Candidate", ko ? "단위" : "Unit"]
    : [ko ? "성분" : "Item", ko ? "현재 적용" : "Applied", ko ? "단위" : "Unit"];
  const rows = snapshot.rows.map((row) => detailed
    ? [ko ? row.labelKo : row.labelEn, formatRecoveryValue(row.appliedOffset, row.key, { signed: true }), formatRecoveryValue(row.learningCurrentOffset, row.key, { signed: true }), formatRecoveryValue(row.recommendedDelta, row.key, { signed: true }), formatRecoveryValue(row.candidateOffset, row.key, { signed: true }), row.unit]
    : [ko ? row.labelKo : row.labelEn, formatRecoveryValue(row.appliedOffset, row.key, { signed: true }), row.unit]);
  return [headers, ...rows].map((row) => row.join("\t")).join("\n");
}

export function CoefficientRecoveryCardDialog({ settings, trainingRuns = [], operatorName = "", locale, canWrite = true, onClose, onApply }) {
  const profiles = settings.coefficientProfiles ?? [];
  const [tab, setTab] = useState("card");
  const [detailed, setDetailed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [profileId, setProfileId] = useState(profiles[0]?.id ?? "");
  const [groupKey, setGroupKey] = useState("");
  const [snapshotState, setSnapshotState] = useState({ key: "", value: null, error: "" });
  const [copyMessage, setCopyMessage] = useState("");
  const [generatedAt] = useState(() => new Date().toISOString());
  const dialogRef = useDialogFocus({ onClose });
  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
  const groups = useMemo(() => recoveryCardGroupOptions(trainingRuns, profile), [trainingRuns, profile]);
  const effectiveGroupKey = groups.some((group) => group.groupKey === groupKey) ? groupKey : "";
  const snapshotKey = `${profile?.id ?? ""}|${profile?.versionId ?? ""}|${effectiveGroupKey}|${generatedAt}`;
  const snapshot = snapshotState.key === snapshotKey ? snapshotState.value : null;
  const snapshotError = snapshotState.key === snapshotKey ? snapshotState.error : "";
  const ko = locale === "ko";

  useEffect(() => {
    let active = true;
    buildRecoveryCardSnapshot({ profile, trainingRuns, groupKey: effectiveGroupKey, operatorName, generatedAt })
      .then((next) => { if (active) setSnapshotState({ key: snapshotKey, value: next, error: "" }); })
      .catch((error) => { if (active) setSnapshotState({ key: snapshotKey, value: null, error: error?.message ?? "recovery_card_failed" }); });
    return () => { active = false; };
  }, [profile, trainingRuns, effectiveGroupKey, operatorName, generatedAt, snapshotKey]);

  async function copy(kind) {
    if (!snapshot) return;
    const content = kind === "string" ? snapshot.recoveryString : tableText(snapshot, detailed, locale);
    const copied = await copyText(content);
    setCopyMessage(copied ? (ko ? "클립보드에 복사했습니다." : "Copied to clipboard.") : (ko ? "복사하지 못했습니다. 표를 직접 선택해 복사하십시오." : "Copy failed. Select and copy the table manually."));
  }

  function print() {
    window.print();
  }

  return <div className="modal-backdrop recovery-card-backdrop" role="presentation">
    <section ref={dialogRef} tabIndex="-1" className={`event-modal coefficient-recovery-dialog ${fullscreen ? "fullscreen" : ""}`} role="dialog" aria-modal="true" aria-label={ko ? "보정계수 비상복구 카드" : "Coefficient emergency recovery card"}>
      <div className="modal-header"><div><span>OFFLINE ANALOG FALLBACK</span><h2>{ko ? "보정계수 비상복구 카드" : "Coefficient emergency recovery card"}</h2></div><button type="button" onClick={onClose} aria-label={ko ? "닫기" : "Close"}><X /></button></div>
      <div className="recovery-dialog-tabs" role="tablist" aria-label={ko ? "복구 카드 기능" : "Recovery-card functions"}><button type="button" role="tab" aria-selected={tab === "card"} className={tab === "card" ? "active" : ""} onClick={() => setTab("card")}>{ko ? "카드 보기·기록" : "View and record card"}</button><button type="button" role="tab" aria-selected={tab === "restore"} className={tab === "restore" ? "active" : ""} onClick={() => setTab("restore")}>{ko ? "수동 복구 입력" : "Manual recovery input"}</button></div>
      <div className="recovery-dialog-content">
        {tab === "card" && <>
          <div className="recovery-card-toolbar"><label><span>{ko ? "계수 프로필" : "Coefficient profile"}</span><select value={profileId} onChange={(event) => { setProfileId(event.target.value); setGroupKey(""); }}>{profiles.map((item) => <option key={item.id} value={item.id}>{ko ? item.nameKo : item.nameEn} · {item.id}</option>)}</select></label><div className="recovery-view-mode"><button type="button" className={!detailed ? "active" : ""} onClick={() => setDetailed(false)}>{ko ? "핵심 6개" : "Core 6"}</button><button type="button" className={detailed ? "active" : ""} onClick={() => setDetailed(true)}>{ko ? "상세 최대 24개" : "Detailed up to 24"}</button></div><div className="recovery-card-actions"><button type="button" onClick={() => setFullscreen((value) => !value)}><ArrowsOut />{fullscreen ? (ko ? "원래 크기" : "Normal size") : (ko ? "큰 화면" : "Large view")}</button><button type="button" disabled={!snapshot} onClick={() => copy("string")}><ClipboardText />{ko ? "복구문자열 복사" : "Copy recovery string"}</button><button type="button" disabled={!snapshot} onClick={() => copy("table")}><Table />{ko ? "표 복사" : "Copy table"}</button><button type="button" disabled={!snapshot} onClick={print}><Printer />{ko ? "인쇄/PDF" : "Print/PDF"}</button></div></div>
          {copyMessage && <p className="recovery-copy-message" role="status">{copyMessage}</p>}
          {snapshotError ? <div className="validation-errors" role="alert">{snapshotError}</div> : <RecoveryCardView snapshot={snapshot} detailed={detailed} groups={groups} groupKey={effectiveGroupKey} onGroupChange={setGroupKey} locale={locale} />}
        </>}
        {tab === "restore" && <RecoveryCardForm profiles={profiles} operatorName={operatorName} locale={locale} canWrite={canWrite} onApply={onApply} />}
      </div>
      <div className="modal-actions recovery-dialog-actions"><button type="button" className="secondary" onClick={onClose}>{ko ? "닫기" : "Close"}</button>{tab === "card" && <button type="button" className="primary" onClick={() => setTab("restore")}>{ko ? "수동 복구 입력으로 이동" : "Open manual recovery"}</button>}</div>
    </section>
  </div>;
}
