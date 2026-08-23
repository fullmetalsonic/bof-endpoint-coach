import { useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";

const blankTargets = {
  C: { min: null, max: null, unit: "%", decimals: 3 },
  temperature: { min: null, max: null, unit: "°C", decimals: 0 },
  P: { min: null, max: null, unit: "%", decimals: 3 },
  Mn: { min: null, max: null, unit: "%", decimals: 2 },
  Si: { min: null, max: null, unit: "%", decimals: 2 },
  S: { min: null, max: null, unit: "%", decimals: 3 },
};

export function GradeProfilesEditor({ draft, setDraft, locale, t, usedGradeCodes }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [initialCount] = useState(draft.gradeProfiles.length);
  const grade = draft.gradeProfiles[selectedIndex] ?? draft.gradeProfiles[0];

  function updateGrade(field, value) {
    setDraft((previous) => {
      const next = structuredClone(previous);
      next.gradeProfiles[selectedIndex][field] = value;
      return next;
    });
  }

  function updateTarget(key, field, value) {
    setDraft((previous) => {
      const next = structuredClone(previous);
      next.gradeProfiles[selectedIndex].targets[key][field] = value === "" ? null : Number(value);
      return next;
    });
  }

  function addGrade() {
    const nextIndex = draft.gradeProfiles.length;
    const number = nextIndex + 1;
    setDraft((previous) => ({
      ...previous,
      gradeProfiles: [...previous.gradeProfiles, {
        code: `GRADE-${number}`,
        nameKo: `신규 강종 ${number}`,
        nameEn: `New grade ${number}`,
        targets: structuredClone(blankTargets),
      }],
    }));
    setSelectedIndex(nextIndex);
  }

  function removeGrade() {
    if (draft.gradeProfiles.length <= 1 || usedGradeCodes.has(grade.code)) return;
    setDraft((previous) => ({ ...previous, gradeProfiles: previous.gradeProfiles.filter((_, index) => index !== selectedIndex) }));
    setSelectedIndex((previous) => Math.max(0, previous - 1));
  }

  return <>
    <div className="profile-toolbar">
      <select aria-label={t("gradeProfile")} value={selectedIndex} onChange={(event) => setSelectedIndex(Number(event.target.value))}>{draft.gradeProfiles.map((item, index) => <option key={`${item.code}-${index}`} value={index}>{item.code} · {locale === "ko" ? item.nameKo : item.nameEn}</option>)}</select>
      <div className="profile-actions"><button type="button" className="secondary-button" onClick={addGrade}><Plus /> {t("addGrade")}</button><button type="button" className="secondary-button danger-link" disabled={draft.gradeProfiles.length <= 1 || usedGradeCodes.has(grade.code)} onClick={removeGrade} title={usedGradeCodes.has(grade.code) ? (locale === "ko" ? "차지에서 사용 중인 강종입니다." : "This grade is referenced by a heat.") : ""}><Trash /> {locale === "ko" ? "강종 삭제" : "Delete grade"}</button></div>
    </div>
    <h2>{locale === "ko" ? grade.nameKo : grade.nameEn} <small>{grade.code}</small></h2>
    <div className="settings-form-grid identity-grid">
      <label><span>{t("gradeCode")}</span><input value={grade.code} readOnly={selectedIndex < initialCount} onChange={(event) => updateGrade("code", event.target.value)} /></label>
      <label><span>{t("koreanName")}</span><input value={grade.nameKo} onChange={(event) => updateGrade("nameKo", event.target.value)} /></label>
      <label><span>{t("englishName")}</span><input value={grade.nameEn} onChange={(event) => updateGrade("nameEn", event.target.value)} /></label>
    </div>
    <div className="settings-form-grid">
      {["C", "temperature", "P", "Mn", "Si", "S"].map((key) => {
        const metricLabel = key === "temperature" ? (locale === "ko" ? "온도" : "Temperature") : key;
        return <div className="target-editor" key={key}><strong>{metricLabel}</strong><label>{t("min")}<input aria-label={`${metricLabel} ${t("min")}`} type="number" step="0.001" value={grade.targets[key].min ?? ""} onChange={(event) => updateTarget(key, "min", event.target.value)} /></label><label>{t("max")}<input aria-label={`${metricLabel} ${t("max")}`} type="number" step="0.001" value={grade.targets[key].max ?? ""} onChange={(event) => updateTarget(key, "max", event.target.value)} /></label><span>{grade.targets[key].unit}</span></div>;
      })}
    </div>
  </>;
}
