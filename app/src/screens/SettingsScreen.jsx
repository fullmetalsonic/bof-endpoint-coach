import { useState } from "react";
import { CheckCircle } from "@phosphor-icons/react";
import { GradeProfilesEditor } from "../components/settings/GradeProfilesEditor.jsx";
import { MaterialsEditor } from "../components/settings/MaterialsEditor.jsx";
import { UnitPolicyEditor } from "../components/settings/UnitPolicyEditor.jsx";
import { CoefficientProfilesEditor } from "../components/settings/CoefficientProfilesEditor.jsx";
import { coefficientBasisLabel, resolveCoefficientProfile } from "../calculation/coefficientProfile.js";
import { validateSettings } from "../domain/settingsValidation.js";

const tabKeys = ["grades", "materials", "gates", "units", "equipment", "coefficients", "versions"];

export function SettingsScreen({ settings, heats, locale, t, onSave }) {
  const [tab, setTab] = useState("grades");
  const [draft, setDraft] = useState(structuredClone(settings));
  const [saved, setSaved] = useState(false);
  const equipment = draft.equipmentProfiles[0];
  const coefficient = draft.coefficientProfiles[0];
  const coefficientBasis = resolveCoefficientProfile(coefficient);
  const validationErrors = validateSettings(draft, locale);
  const usedGradeCodes = new Set(heats.map((heat) => heat.gradeCode));
  const usedMaterialCodes = new Set(heats.flatMap((heat) => (heat.events ?? []).map((event) => event.payload?.materialCode).filter(Boolean)));
  const updateEquipment = (field, value) => setDraft((previous) => ({ ...previous, equipmentProfiles: [{ ...previous.equipmentProfiles[0], [field]: value }, ...previous.equipmentProfiles.slice(1)] }));
  function save() {
    if (validationErrors.length) return;
    onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }
  return (
    <main className="workspace-screen settings-screen" data-testid="settings-screen">
      <div className="workspace-heading"><div><span>{t("demoOnly")}</span><h1>{t("settingsTitle")}</h1><p>{locale === "ko" ? "계수와 기준은 프로필·버전별로 분리됩니다." : "Targets and coefficients are isolated by profile and version."}</p></div><button className="primary-button" type="button" onClick={save} disabled={validationErrors.length > 0}>{t("applySettings")}</button></div>
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
          {tab === "versions" && <><h2>{t("versions")}</h2><dl className="version-list"><div><dt>{locale === "ko" ? "설정 버전" : "Settings version"}</dt><dd>{draft.version}</dd></div><div><dt>{locale === "ko" ? "운영 데이터" : "Operating data"}</dt><dd>{heats.some((heat) => !heat.demo) ? (locale === "ko" ? "사용자 수동 입력 포함" : "Includes manual entries") : heats.some((heat) => heat.demo) ? "DEMO" : (locale === "ko" ? "입력 없음" : "No entries")}</dd></div><div><dt>{locale === "ko" ? "계수 적용 상태" : "Coefficient basis"}</dt><dd>{coefficientBasisLabel(coefficientBasis.status, locale)}</dd></div><div><dt>{locale === "ko" ? "계산식" : "Formula"}</dt><dd>{coefficient.formulaVersion}</dd></div><div><dt>{locale === "ko" ? "문헌 근거" : "Literature sources"}</dt><dd>{coefficient.sourceIds.join(", ")}</dd></div></dl></>}
          {saved && <div className="save-toast"><CheckCircle weight="fill" /> {t("settingSaved")}</div>}
        </section>
      </div>
    </main>
  );
}
