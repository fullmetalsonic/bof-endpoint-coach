import { useState } from "react";
import { Plus, Trash } from "@phosphor-icons/react";

const compositionKeys = ["C", "Si", "Mn", "P", "S", "CaO"];

export function MaterialsEditor({ draft, setDraft, locale, t, usedMaterialCodes }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [initialCount] = useState(draft.materials.length);
  const material = draft.materials[selectedIndex] ?? draft.materials[0];

  function update(field, value) {
    setDraft((previous) => {
      const next = structuredClone(previous);
      next.materials[selectedIndex][field] = value;
      return next;
    });
  }

  function updateComposition(key, value) {
    setDraft((previous) => {
      const next = structuredClone(previous);
      next.materials[selectedIndex].composition[key] = value === "" ? null : Number(value);
      return next;
    });
  }

  function addMaterial() {
    const nextIndex = draft.materials.length;
    const number = nextIndex + 1;
    setDraft((previous) => ({ ...previous, materials: [...previous.materials, {
      code: `MATERIAL-${number}`,
      nameKo: `신규 재료 ${number}`,
      nameEn: `New material ${number}`,
      category: "other",
      unit: previous.unitPolicy.mass,
      composition: {},
    }] }));
    setSelectedIndex(nextIndex);
  }

  function removeMaterial() {
    if (draft.materials.length <= 1 || usedMaterialCodes.has(material.code)) return;
    setDraft((previous) => ({ ...previous, materials: previous.materials.filter((_, index) => index !== selectedIndex) }));
    setSelectedIndex((previous) => Math.max(0, previous - 1));
  }

  if (!material) return <button type="button" className="secondary-button" onClick={addMaterial}><Plus /> {t("addMaterial")}</button>;

  return <>
    <div className="profile-toolbar">
      <select aria-label={t("materialProfile")} value={selectedIndex} onChange={(event) => setSelectedIndex(Number(event.target.value))}>{draft.materials.map((item, index) => <option key={`${item.code}-${index}`} value={index}>{item.code} · {locale === "ko" ? item.nameKo : item.nameEn}</option>)}</select>
      <div className="profile-actions"><button type="button" className="secondary-button" onClick={addMaterial}><Plus /> {t("addMaterial")}</button><button type="button" className="secondary-button danger-link" disabled={draft.materials.length <= 1 || usedMaterialCodes.has(material.code)} onClick={removeMaterial} title={usedMaterialCodes.has(material.code) ? (locale === "ko" ? "차지 이력에서 사용 중인 재료입니다." : "This material is referenced by a heat event.") : ""}><Trash /> {locale === "ko" ? "재료 삭제" : "Delete material"}</button></div>
    </div>
    <h2>{locale === "ko" ? material.nameKo : material.nameEn} <small>{material.code}</small></h2>
    <div className="settings-form-grid identity-grid">
      <label><span>{t("materialCode")}</span><input value={material.code} readOnly={selectedIndex < initialCount} onChange={(event) => update("code", event.target.value)} /></label>
      <label><span>{t("koreanName")}</span><input value={material.nameKo} onChange={(event) => update("nameKo", event.target.value)} /></label>
      <label><span>{t("englishName")}</span><input value={material.nameEn} onChange={(event) => update("nameEn", event.target.value)} /></label>
      <label><span>{t("category")}</span><select value={material.category ?? "other"} onChange={(event) => update("category", event.target.value)}><option value="flux">Flux</option><option value="coolant">Coolant</option><option value="alloy">Alloy</option><option value="scrap">Scrap</option><option value="other">Other</option></select></label>
      <label><span>{t("defaultInputUnit")}</span><select value={material.unit} onChange={(event) => update("unit", event.target.value)}><option>kg</option><option>t</option><option>g</option></select></label>
    </div>
    <h3 className="subsection-heading">{t("composition")} (%)</h3>
    <div className="composition-grid">{compositionKeys.map((key) => <label key={key}><span>{key}</span><input type="number" min="0" max="100" step="0.001" value={material.composition[key] ?? ""} onChange={(event) => updateComposition(key, event.target.value)} /></label>)}</div>
    <p className="settings-note">{t("materialCalculationNote")}</p>
  </>;
}
