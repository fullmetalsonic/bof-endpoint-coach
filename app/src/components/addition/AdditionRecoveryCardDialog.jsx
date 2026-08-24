import { useEffect, useMemo, useState } from "react";
import { ClipboardText, Printer, X } from "@phosphor-icons/react";
import { ADDITION_COEFFICIENT_FIELDS, additionCoefficientUnitLabel } from "../../calculation/addition/additionProfile.js";
import { buildAdditionEvidenceLedger } from "../../calibration/additionEvidence.js";
import { buildAdditionCorrectionRecommendations } from "../../calibration/additionRecommendations.js";
import { additionBaseFingerprint, additionRecoveryCheckCode, encodeAdditionRecoveryString, parseAdditionRecoveryString, verifyAdditionRecoveryPayload } from "../../calibration/additionRecoveryCodec.js";
import { useDialogFocus } from "../../hooks/useDialogFocus.js";
import { createLiteratureAdditionProfile } from "../../calculation/addition/additionProfile.js";

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const area = document.createElement("textarea"); area.value = text; area.style.position = "fixed"; area.style.opacity = "0"; document.body.appendChild(area); area.select(); const ok = typeof document.execCommand === "function" && document.execCommand("copy"); area.remove(); return ok;
  }
}

function format(value, key) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(key === "timingShiftMinutes" ? 2 : 4) : "–";
}

export function AdditionRecoveryCardDialog({ settings, heats, operatorName = "", locale, canWrite, onClose, onApply }) {
  const profiles = useMemo(() => settings.additionModelProfiles?.length ? settings.additionModelProfiles : [createLiteratureAdditionProfile()], [settings.additionModelProfiles]);
  const [tab, setTab] = useState("card");
  const [profileId, setProfileId] = useState(profiles[0].id);
  const [snapshot, setSnapshot] = useState(null);
  const [manualText, setManualText] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const dialogRef = useDialogFocus({ onClose });
  const profile = profiles.find((item) => item.id === profileId) ?? profiles[0];
  const recommendations = useMemo(() => buildAdditionCorrectionRecommendations({ settings, heats }, buildAdditionEvidenceLedger({ settings, heats })).filter((item) => item.profileVersionId === profile?.versionId), [settings, heats, profile]);
  const ko = locale === "ko";

  useEffect(() => {
    let active = true;
    async function build() {
      try {
        const baseFingerprint = await additionBaseFingerprint(profile);
        const core = { profileId: profile.id, profileVersionId: profile.versionId, formulaVersion: profile.formulaVersion, baseFingerprint, corrections: profile.corrections };
        const result = { generatedAt: new Date().toISOString(), baseFingerprint, checkCode: await additionRecoveryCheckCode(core), recoveryString: await encodeAdditionRecoveryString(core) };
        if (active) { setSnapshot(result); setError(""); }
      } catch (buildError) { if (active) setError(buildError?.message ?? "addition_recovery_card_failed"); }
    }
    if (profile) build();
    return () => { active = false; };
  }, [profile]);

  async function copy(kind) {
    if (!snapshot) return;
    const table = ADDITION_COEFFICIENT_FIELDS.map((field) => `${ko ? field.labelKo : field.labelEn}\t${format(profile.corrections[field.key], field.key)}\t${additionCoefficientUnitLabel(field, locale)}`).join("\n");
    setMessage(await copyText(kind === "string" ? snapshot.recoveryString : table) ? (ko ? "클립보드에 복사했습니다." : "Copied.") : (ko ? "복사하지 못했습니다." : "Copy failed."));
  }

  async function restore(event) {
    event.preventDefault();
    if (!canWrite || !reason.trim()) return;
    try {
      const parsed = parseAdditionRecoveryString(manualText);
      const verified = await verifyAdditionRecoveryPayload(parsed);
      const target = profiles.find((item) => item.id === verified.profileId);
      if (!target) throw new Error("addition_recovery_profile_missing");
      const currentFingerprint = await additionBaseFingerprint(target);
      if (currentFingerprint !== verified.baseFingerprint || target.formulaVersion !== verified.formulaVersion) throw new Error("addition_recovery_base_mismatch");
      onApply({ profileId: target.id, reason: reason.trim(), profile: { ...structuredClone(target), status: "user_modified", approval: null, corrections: verified.corrections, manualRecoverySource: { cardVersion: "BOFARC1", sourceProfileVersionId: verified.profileVersionId, baseFingerprint: verified.baseFingerprint, checkCode: verified.checkCode, enteredAt: new Date().toISOString(), enteredBy: operatorName?.trim() || "미입력", reason: reason.trim(), evidenceRestored: false } } });
    } catch (restoreError) { setError(restoreError?.message ?? "addition_recovery_restore_failed"); }
  }

  return <div className="modal-backdrop recovery-card-backdrop" role="presentation"><section ref={dialogRef} tabIndex="-1" className="event-modal coefficient-recovery-dialog addition-recovery-dialog" role="dialog" aria-modal="true" aria-label={ko ? "투입계수 비상복구 카드" : "Addition coefficient recovery card"}>
    <div className="modal-header"><div><span>OFFLINE ANALOG FALLBACK · BOFARC1</span><h2>{ko ? "투입계수 비상복구 카드" : "Addition coefficient recovery card"}</h2></div><button type="button" onClick={onClose} aria-label={ko ? "닫기" : "Close"}><X /></button></div>
    <div className="recovery-dialog-tabs" role="tablist"><button type="button" role="tab" aria-selected={tab === "card"} className={tab === "card" ? "active" : ""} onClick={() => setTab("card")}>{ko ? "카드 보기·인쇄" : "View and print"}</button><button type="button" role="tab" aria-selected={tab === "restore"} className={tab === "restore" ? "active" : ""} onClick={() => setTab("restore")}>{ko ? "수동 복구 입력" : "Manual restore"}</button></div>
    {error && <div className="validation-errors" role="alert">{error}</div>}{message && <p className="recovery-copy-message" role="status">{message}</p>}
    {tab === "card" && <div className="addition-recovery-card printable-recovery-card"><div className="recovery-card-toolbar"><label><span>{ko ? "투입모델 프로필" : "Addition profile"}</span><select value={profileId} onChange={(event) => setProfileId(event.target.value)}>{profiles.map((item) => <option key={item.id} value={item.id}>{item.id} · {ko ? item.nameKo : item.nameEn}</option>)}</select></label><div className="recovery-card-actions"><button type="button" disabled={!snapshot} onClick={() => copy("string")}><ClipboardText />{ko ? "복구문자열" : "Recovery string"}</button><button type="button" disabled={!snapshot} onClick={() => copy("table")}><ClipboardText />{ko ? "표 복사" : "Copy table"}</button><button type="button" onClick={() => window.print()}><Printer />{ko ? "인쇄/PDF" : "Print/PDF"}</button></div></div><div className="recovery-card-meta"><div><span>PROFILE</span><strong>{profile.id}</strong></div><div><span>VERSION</span><strong>{profile.versionId}</strong></div><div><span>FORMULA</span><strong>{profile.formulaVersion}</strong></div><div><span>BASE / CHECK</span><strong>{snapshot ? `${snapshot.baseFingerprint} / ${snapshot.checkCode}` : "–"}</strong></div></div><table><thead><tr><th>{ko ? "핵심 보정값" : "Core correction"}</th><th>{ko ? "현재 적용" : "Applied"}</th><th>{ko ? "최신 추천 후보" : "Latest candidate"}</th><th>{ko ? "단위" : "Unit"}</th></tr></thead><tbody>{ADDITION_COEFFICIENT_FIELDS.map((field) => { const candidate = recommendations.filter((item) => item.correctionKey === field.key).at(-1); return <tr key={field.key}><td>{ko ? field.labelKo : field.labelEn}<small>{field.key}</small></td><td>{format(profile.corrections[field.key], field.key)}</td><td>{format(candidate?.candidateValue, field.key)}{candidate && <small>{candidate.count} {ko ? "건" : "rows"}</small>}</td><td>{additionCoefficientUnitLabel(field, locale)}</td></tr>; })}</tbody></table><div className="recovery-string-block"><span>{ko ? "수동 복구 문자열" : "Manual recovery string"}</span><code>{snapshot?.recoveryString ?? "–"}</code></div><p>{ko ? "이 카드는 6개 적용값만 복구합니다. 원본 조업·오차·학습 근거는 JSON 전체 백업으로만 복구됩니다." : "This card restores only six applied values. Original operation, residual, and learning evidence requires a full JSON backup."}</p></div>}
    {tab === "restore" && <form className="addition-recovery-form" onSubmit={restore}><label><span>{ko ? "복구문자열" : "Recovery string"}</span><textarea rows="6" value={manualText} onChange={(event) => setManualText(event.target.value)} placeholder="BOFARC1|PROFILE=..." required /></label><label><span>{ko ? "복구 사유" : "Restore reason"}</span><input value={reason} onChange={(event) => setReason(event.target.value)} minLength="3" required /></label><div className="addition-boundary-note"><strong>{ko ? "초안만 생성" : "Draft only"}</strong><span>{ko ? "확인코드·문헌기반 지문을 검증한 뒤 설정 초안에 넣습니다. 실제 적용은 설정 저장을 한 번 더 눌러야 합니다." : "After check-code and base-fingerprint verification, values are placed in a settings draft. Saving settings is still required."}</span></div><button type="submit" className="primary-button" disabled={!canWrite || !manualText.trim() || reason.trim().length < 3}>{ko ? "검증 후 초안에 넣기" : "Verify and place in draft"}</button></form>}
    <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{ko ? "닫기" : "Close"}</button></div>
  </section></div>;
}
