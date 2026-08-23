import { useEffect, useMemo, useState } from "react";
import { CheckCircle, FloppyDisk, WarningCircle } from "@phosphor-icons/react";
import { GradeProfilesEditor } from "../components/settings/GradeProfilesEditor.jsx";
import { MaterialsEditor } from "../components/settings/MaterialsEditor.jsx";
import { UnitPolicyEditor } from "../components/settings/UnitPolicyEditor.jsx";
import { CoefficientProfilesEditor } from "../components/settings/CoefficientProfilesEditor.jsx";
import { coefficientBasisLabel, resolveCoefficientProfile } from "../calculation/coefficientProfile.js";
import { validateSettings } from "../domain/settingsValidation.js";
import { usePersistentDraft } from "../hooks/usePersistentDraft.js";

const tabKeys = ["grades", "materials", "gates", "units", "equipment", "coefficients", "versions"];

export function SettingsScreen({ settings, heats, locale, t, operatorName, onSave, onDirtyChange, canWrite = true }) {
  const [tab, setTab] = useState("grades");
  const defaults = useMemo(() => structuredClone(settings), [settings]);
  const { value: draft, setValue: setDraft, dirty, restored, commit, discard } = usePersistentDraft("settings", settings.version, defaults);
  const [reason, setReason] = useState("");
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
  function save() {
    if (validationErrors.length || !dirty || !reason.trim() || !canWrite) return;
    if (onSave(draft, reason.trim()) === false) return;
    commit();
    setReason("");
  }
  const lastRevision = settings.lastRevision;
  return (
    <main className="workspace-screen settings-screen" data-testid="settings-screen">
      <div className="workspace-heading settings-heading"><div><span>{t("demoOnly")}</span><h1>{t("settingsTitle")}</h1><p>{locale === "ko" ? "계수와 기준은 프로필·버전별로 분리되며 변경 이력을 남깁니다." : "Targets and coefficients are versioned with a change history."}</p></div><div className="settings-save-controls"><label><span>{locale === "ko" ? "변경 사유" : "Change reason"}</span><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={locale === "ko" ? "예: 강종 목표 범위 검토" : "e.g. Grade target review"} /></label><button className="primary-button" type="button" onClick={save} disabled={!canWrite || validationErrors.length > 0 || !dirty || !reason.trim()}><FloppyDisk />{t("applySettings")}</button></div></div>
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
          {tab === "coefficients" && <CoefficientProfilesEditor draft={draft} setDraft={setDraft} locale={locale} />}
          {tab === "versions" && <><h2>{t("versions")}</h2><dl className="version-list"><div><dt>{locale === "ko" ? "현재 설정 버전" : "Current settings version"}</dt><dd>{settings.version}</dd></div><div><dt>{locale === "ko" ? "현재 작업자" : "Current operator"}</dt><dd>{operatorName || (locale === "ko" ? "미입력" : "Not set")}</dd></div><div><dt>{locale === "ko" ? "마지막 변경" : "Last change"}</dt><dd>{lastRevision ? `${new Date(lastRevision.changedAt).toLocaleString(locale === "ko" ? "ko-KR" : "en-GB")} · ${lastRevision.changedBy} · ${lastRevision.reason}` : (locale === "ko" ? "초기 공개 문헌 기준" : "Initial public-literature reference")}</dd></div><div><dt>{locale === "ko" ? "운영 데이터" : "Operating data"}</dt><dd>{heats.some((heat) => !heat.demo) ? (locale === "ko" ? "사용자 수동 입력 포함" : "Includes manual entries") : heats.some((heat) => heat.demo) ? "DEMO" : (locale === "ko" ? "입력 없음" : "No entries")}</dd></div><div><dt>{locale === "ko" ? "계수 적용 상태" : "Coefficient basis"}</dt><dd>{coefficientBasisLabel(coefficientBasis.status, locale)}</dd></div><div><dt>{locale === "ko" ? "계산식" : "Formula"}</dt><dd>{coefficient.formulaVersion}</dd></div><div><dt>{locale === "ko" ? "문헌 근거" : "Literature sources"}</dt><dd>{coefficient.sourceIds.join(", ")}</dd></div></dl>{lastRevision?.changes?.length > 0 && <div className="settings-change-list"><h3>{locale === "ko" ? "마지막 버전 변경 항목" : "Latest version changes"}</h3><div className="table-scroll"><table><thead><tr><th>{locale === "ko" ? "경로" : "Path"}</th><th>{locale === "ko" ? "이전" : "Before"}</th><th>{locale === "ko" ? "변경" : "After"}</th></tr></thead><tbody>{lastRevision.changes.map((change) => <tr key={change.path}><td>{change.path}</td><td>{String(change.before ?? "–")}</td><td>{String(change.after ?? "–")}</td></tr>)}</tbody></table></div></div>}</>}
        </section>
      </div>
    </main>
  );
}
