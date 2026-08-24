import { useEffect, useMemo, useState } from "react";
import { CheckCircle, FloppyDisk, WarningCircle } from "@phosphor-icons/react";
import { GradeProfilesEditor } from "../components/settings/GradeProfilesEditor.jsx";
import { MaterialsEditor } from "../components/settings/MaterialsEditor.jsx";
import { UnitPolicyEditor } from "../components/settings/UnitPolicyEditor.jsx";
import { CoefficientProfilesEditor } from "../components/settings/CoefficientProfilesEditor.jsx";
import { coefficientBasisLabel, resolveCoefficientProfile } from "../calculation/coefficientProfile.js";
import { validateSettings } from "../domain/settingsValidation.js";
import { usePersistentDraft } from "../hooks/usePersistentDraft.js";
import { CoefficientRecoveryCardDialog } from "../components/CoefficientRecoveryCardDialog.jsx";
import { AdditionProfilesEditor } from "../components/settings/AdditionProfilesEditor.jsx";
import { AdditionRecoveryCardDialog } from "../components/addition/AdditionRecoveryCardDialog.jsx";

const tabKeys = ["grades", "materials", "gates", "units", "equipment", "coefficients", "additionModels", "versions"];

function compatibleSettingsDraft(value) {
  return Boolean(
    value
    && Array.isArray(value.gradeProfiles) && value.gradeProfiles.length
    && Array.isArray(value.materials)
    && Array.isArray(value.gates)
    && Array.isArray(value.equipmentProfiles) && value.equipmentProfiles.length
    && Array.isArray(value.coefficientProfiles) && value.coefficientProfiles.length
    && Array.isArray(value.additionModelProfiles) && value.additionModelProfiles.length,
  );
}

export function SettingsScreen({ settings, heats, trainingRuns = [], locale, t, operatorName, onSave, onDirtyChange, canWrite = true, coefficientCandidate, onCandidateConsumed, additionCandidate, onAdditionCandidateConsumed, recoveryCardRequested = false, onRecoveryCardRequestHandled, additionRecoveryCardRequested = false, onAdditionRecoveryCardRequestHandled }) {
  const [tab, setTab] = useState(additionRecoveryCardRequested ? "additionModels" : recoveryCardRequested ? "coefficients" : "grades");
  const defaults = useMemo(() => structuredClone(settings), [settings]);
  const { value: draft, setValue: setDraft, dirty, restored, commit, discard } = usePersistentDraft({ key: "settings", baseVersion: settings.version, defaults, validate: compatibleSettingsDraft });
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryCardOpen, setRecoveryCardOpen] = useState(recoveryCardRequested);
  const [additionRecoveryCardOpen, setAdditionRecoveryCardOpen] = useState(additionRecoveryCardRequested);
  const [recoveryDraftNotice, setRecoveryDraftNotice] = useState(null);
  const [additionRecoveryDraftNotice, setAdditionRecoveryDraftNotice] = useState(null);
  const equipment = draft.equipmentProfiles[0];
  const coefficient = draft.coefficientProfiles[0];
  const coefficientBasis = resolveCoefficientProfile(coefficient);
  const validationErrors = validateSettings(draft, locale);
  const usedGradeCodes = new Set(heats.map((heat) => heat.gradeCode));
  const usedMaterialCodes = new Set(heats.flatMap((heat) => (heat.events ?? []).map((event) => event.payload?.materialCode).filter(Boolean)));
  const updateEquipment = (field, value) => setDraft((previous) => ({ ...previous, equipmentProfiles: [{ ...previous.equipmentProfiles[0], [field]: value }, ...previous.equipmentProfiles.slice(1)] }));
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);
  function applyCoefficientCandidate() {
    if (!coefficientCandidate) return;
    setDraft((previous) => ({
      ...previous,
      coefficientProfiles: previous.coefficientProfiles.map((profile) => profile.id === coefficientCandidate.coefficientId
        ? {
          ...profile,
          calibrationOffsets: { ...(profile.calibrationOffsets ?? {}), [coefficientCandidate.element]: coefficientCandidate.candidateOffset },
          manualRecoverySource: null,
          recommendationSource: { ...structuredClone(coefficientCandidate), broughtAt: new Date().toISOString() },
          modifiedAt: new Date().toISOString(),
        }
        : profile),
    }));
    setTab("coefficients");
    onCandidateConsumed?.();
  }
  function applyAdditionCandidate() {
    if (!additionCandidate) return;
    setDraft((previous) => ({
      ...previous,
      additionModelProfiles: previous.additionModelProfiles.map((profile) => profile.versionId === additionCandidate.profileVersionId
        ? { ...profile, status: "user_modified", approval: null, corrections: { ...profile.corrections, [additionCandidate.correctionKey]: additionCandidate.candidateValue }, recommendationSource: { ...structuredClone(additionCandidate), broughtAt: new Date().toISOString() }, modifiedAt: new Date().toISOString() }
        : profile),
    }));
    setTab("additionModels");
    onAdditionCandidateConsumed?.();
  }
  async function save() {
    if (validationErrors.length || !dirty || !reason.trim() || !canWrite || busy) return;
    setBusy(true);
    const ok = await onSave(draft, reason.trim());
    setBusy(false);
    if (!ok) return;
    commit();
    setReason("");
    setRecoveryDraftNotice(null);
  }
  function applyManualRecovery({ profileId, profile, reason: recoveryReason }) {
    setDraft((previous) => ({ ...previous, coefficientProfiles: previous.coefficientProfiles.map((item) => item.id === profileId ? profile : item) }));
    setReason(recoveryReason);
    setTab("coefficients");
    setRecoveryDraftNotice({ profileId, checkCode: profile.manualRecoverySource?.coreCheckCode });
    setRecoveryCardOpen(false);
    onRecoveryCardRequestHandled?.();
  }
  function closeRecoveryCard() {
    setRecoveryCardOpen(false);
    onRecoveryCardRequestHandled?.();
  }
  function applyAdditionManualRecovery({ profileId, profile, reason: recoveryReason }) {
    setDraft((previous) => ({ ...previous, additionModelProfiles: previous.additionModelProfiles.map((item) => item.id === profileId ? profile : item) }));
    setReason(recoveryReason);
    setTab("additionModels");
    setAdditionRecoveryDraftNotice({ profileId, checkCode: profile.manualRecoverySource?.checkCode });
    setAdditionRecoveryCardOpen(false);
    onAdditionRecoveryCardRequestHandled?.();
  }
  function closeAdditionRecoveryCard() {
    setAdditionRecoveryCardOpen(false);
    onAdditionRecoveryCardRequestHandled?.();
  }
  const lastRevision = settings.lastRevision;
  return (
    <main className="workspace-screen settings-screen" data-testid="settings-screen">
      <div className="workspace-heading settings-heading"><div><span>{t("demoOnly")}</span><h1>{t("settingsTitle")}</h1><p>{locale === "ko" ? "계수와 기준은 프로필·버전별로 분리되며 변경 이력을 남깁니다." : "Targets and coefficients are versioned with a change history."}</p></div><div className="settings-save-controls"><label><span>{locale === "ko" ? "변경 사유" : "Change reason"}</span><input value={reason} disabled={busy} onChange={(event) => setReason(event.target.value)} placeholder={locale === "ko" ? "예: 강종 목표 범위 검토" : "e.g. Grade target review"} /></label><button className="primary-button" type="button" onClick={save} disabled={!canWrite || busy || validationErrors.length > 0 || !dirty || !reason.trim()}><FloppyDisk />{busy ? (locale === "ko" ? "안전 복구점 생성 중…" : "Creating safety point…") : t("applySettings")}</button></div></div>
      {coefficientCandidate && <div className="candidate-review-banner" role="status"><div><strong>{locale === "ko" ? "학습 화면에서 가져온 계수 추천이 있습니다." : "A coefficient recommendation is waiting for review."}</strong><span>{coefficientCandidate.element}: {coefficientCandidate.currentOffset} → {coefficientCandidate.candidateOffset.toFixed(coefficientCandidate.element === "temperature" ? 1 : 5)} {coefficientCandidate.unit} · {coefficientCandidate.count}{locale === "ko" ? "건 근거" : " rows"}</span></div><div><button type="button" className="secondary-button" onClick={onCandidateConsumed}>{locale === "ko" ? "추천 닫기" : "Dismiss"}</button><button type="button" className="primary-button" onClick={applyCoefficientCandidate}>{locale === "ko" ? "계수 초안에 반영" : "Apply to coefficient draft"}</button></div></div>}
      {additionCandidate && <div className="candidate-review-banner" role="status"><div><strong>{locale === "ko" ? "투입 효과에서 계산한 보정 후보가 있습니다." : "An addition-effect correction candidate is waiting for review."}</strong><span>{additionCandidate.correctionKey}: {additionCandidate.currentValue.toFixed(3)} → {additionCandidate.candidateValue.toFixed(3)} · {additionCandidate.count}{locale === "ko" ? "건 근거" : " rows"}</span></div><div><button type="button" className="secondary-button" onClick={onAdditionCandidateConsumed}>{locale === "ko" ? "추천 닫기" : "Dismiss"}</button><button type="button" className="primary-button" onClick={applyAdditionCandidate}>{locale === "ko" ? "투입모델 초안에 반영" : "Apply to addition draft"}</button></div></div>}
      {recoveryDraftNotice && <div className="candidate-review-banner recovery-draft-banner" role="status"><div><strong>{locale === "ko" ? "검증된 비상복구값을 설정 초안에 반영했습니다." : "Verified emergency-recovery values are in the settings draft."}</strong><span>{recoveryDraftNotice.profileId} · CHECK {recoveryDraftNotice.checkCode} · {locale === "ko" ? "아직 계산에 적용되지 않았습니다. 변경 사유를 확인하고 설정 저장을 누르십시오." : "Not yet applied. Review the reason and save settings."}</span></div><button type="button" className="secondary-button" onClick={() => { discard(); setReason(""); setRecoveryDraftNotice(null); }}>{locale === "ko" ? "복구 초안 버리기" : "Discard recovery draft"}</button></div>}
      {additionRecoveryDraftNotice && <div className="candidate-review-banner recovery-draft-banner" role="status"><div><strong>{locale === "ko" ? "검증된 투입계수 복구값을 설정 초안에 반영했습니다." : "Verified addition-recovery values are in the settings draft."}</strong><span>{additionRecoveryDraftNotice.profileId} · CHECK {additionRecoveryDraftNotice.checkCode} · {locale === "ko" ? "조업·오차 근거는 복구되지 않았습니다. 변경 사유를 확인하고 설정 저장을 누르십시오." : "Operation and residual evidence was not restored. Review and save settings."}</span></div><button type="button" className="secondary-button" onClick={() => { discard(); setReason(""); setAdditionRecoveryDraftNotice(null); }}>{locale === "ko" ? "복구 초안 버리기" : "Discard recovery draft"}</button></div>}
      {dirty && <div className="draft-status" role="status"><WarningCircle weight="fill" /><div><strong>{restored ? (locale === "ko" ? "미저장 설정 초안을 복구했습니다." : "Unsaved settings draft restored.") : (locale === "ko" ? "저장되지 않은 설정 변경이 있습니다." : "There are unsaved settings changes.")}</strong><span>{locale === "ko" ? "다른 화면으로 이동해도 이 PC에 임시 보관됩니다. 정식 저장에는 변경 사유가 필요합니다." : "The draft remains on this PC if you leave this screen. A reason is required to save a new version."}</span></div><button type="button" onClick={() => { discard(); setReason(""); }}>{locale === "ko" ? "초안 버리기" : "Discard draft"}</button></div>}
      {validationErrors.length > 0 && <div className="validation-errors" role="alert"><strong>{locale === "ko" ? "설정 정합성을 확인하십시오." : "Check settings consistency."}</strong><ul>{validationErrors.map((error) => <li key={error}>{error}</li>)}</ul></div>}
      <div className="settings-layout">
        <aside className="settings-tabs">{tabKeys.map((key) => <button type="button" key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{t(key)}</button>)}</aside>
        <section className="settings-content panel">
          {tab === "grades" && <GradeProfilesEditor draft={draft} setDraft={setDraft} locale={locale} t={t} usedGradeCodes={usedGradeCodes} />}
          {tab === "materials" && <MaterialsEditor draft={draft} setDraft={setDraft} locale={locale} t={t} usedMaterialCodes={usedMaterialCodes} />}
          {tab === "gates" && <><h2>{t("gates")}</h2><div className="gate-settings">{draft.gates.map((gate, index) => <div key={gate}><CheckCircle /><strong>{gate}</strong><span>{locale === "ko" ? `${index + 1}단계 입력·확인 규칙` : `Stage ${index + 1} input and check rules`}</span></div>)}</div></>}
          {tab === "units" && <UnitPolicyEditor draft={draft} setDraft={setDraft} t={t} />}
          {tab === "equipment" && <><h2>{t("equipment")}</h2><div className="settings-form-grid"><label><span>ID</span><input value={equipment.id} readOnly /></label><label><span>{locale === "ko" ? "호칭 용량" : "Nominal capacity"} (t)</span><input type="number" value={equipment.nominalCapacityT} onChange={(event) => updateEquipment("nominalCapacityT", Number(event.target.value))} /></label><label><span>{locale === "ko" ? "취련 방식" : "Blowing type"}</span><select value={equipment.blowingType} onChange={(event) => updateEquipment("blowingType", event.target.value)}><option value="top">Top blow</option><option value="combined">Combined blow</option></select></label><label><span>{locale === "ko" ? "랜스 프로필" : "Lance profile"}</span><input value={equipment.lanceProfile} onChange={(event) => updateEquipment("lanceProfile", event.target.value)} /></label><label><span>{locale === "ko" ? "저취 가스" : "Bottom gas"}</span><input value={equipment.bottomGas} onChange={(event) => updateEquipment("bottomGas", event.target.value)} /></label></div></>}
          {tab === "coefficients" && <CoefficientProfilesEditor draft={draft} setDraft={setDraft} locale={locale} candidate={coefficientCandidate} onOpenRecoveryCard={() => setRecoveryCardOpen(true)} />}
          {tab === "additionModels" && <AdditionProfilesEditor draft={draft} setDraft={setDraft} locale={locale} operatorName={operatorName} onOpenRecoveryCard={() => setAdditionRecoveryCardOpen(true)} />}
          {tab === "versions" && <><h2>{t("versions")}</h2><dl className="version-list"><div><dt>{locale === "ko" ? "현재 설정 버전" : "Current settings version"}</dt><dd>{settings.version}</dd></div><div><dt>{locale === "ko" ? "현재 작업자" : "Current operator"}</dt><dd>{operatorName || (locale === "ko" ? "미입력" : "Not set")}</dd></div><div><dt>{locale === "ko" ? "마지막 변경" : "Last change"}</dt><dd>{lastRevision ? `${new Date(lastRevision.changedAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-GB")} · ${lastRevision.changedBy} · ${lastRevision.reason}` : (locale === "ko" ? "초기 공개 문헌 기준" : "Initial public-literature reference")}</dd></div><div><dt>{locale === "ko" ? "운영 데이터" : "Operating data"}</dt><dd>{heats.some((heat) => !heat.demo) ? (locale === "ko" ? "사용자 수동 입력 포함" : "Includes manual entries") : heats.some((heat) => heat.demo) ? "DEMO" : (locale === "ko" ? "입력 없음" : "No entries")}</dd></div><div><dt>{locale === "ko" ? "계수 적용 상태" : "Coefficient basis"}</dt><dd>{coefficientBasisLabel(coefficientBasis.status, locale)}</dd></div><div><dt>{locale === "ko" ? "계산식" : "Formula"}</dt><dd>{coefficient.formulaVersion}</dd></div><div><dt>{locale === "ko" ? "문헌 근거" : "Literature sources"}</dt><dd>{coefficient.sourceIds.join(", ")}</dd></div></dl>{lastRevision?.changes?.length > 0 && <div className="settings-change-list"><h3>{locale === "ko" ? "마지막 버전 변경 항목" : "Latest version changes"}</h3><div className="table-scroll"><table><thead><tr><th>{locale === "ko" ? "경로" : "Path"}</th><th>{locale === "ko" ? "이전" : "Before"}</th><th>{locale === "ko" ? "변경" : "After"}</th></tr></thead><tbody>{lastRevision.changes.map((change) => <tr key={change.path}><td>{change.path}</td><td>{String(change.before ?? "–")}</td><td>{String(change.after ?? "–")}</td></tr>)}</tbody></table></div></div>}</>}
        </section>
      </div>
      {recoveryCardOpen && <CoefficientRecoveryCardDialog settings={settings} trainingRuns={trainingRuns} operatorName={operatorName} locale={locale} canWrite={canWrite} onClose={closeRecoveryCard} onApply={applyManualRecovery} />}
      {additionRecoveryCardOpen && <AdditionRecoveryCardDialog settings={settings} heats={heats} operatorName={operatorName} locale={locale} canWrite={canWrite} onClose={closeAdditionRecoveryCard} onApply={applyAdditionManualRecovery} />}
    </main>
  );
}
