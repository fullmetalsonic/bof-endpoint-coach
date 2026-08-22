import { useMemo, useState } from "react";
import { X } from "@phosphor-icons/react";
import { concentrationUnits, convertConcentrationFromPercent, convertConcentrationToPercent, convertMassFromKg, convertMassToKg, isSupportedConcentrationUnit, isSupportedMassUnit, massUnits } from "../units/conversion.js";
import { validateNewHeatInput, validationMessage } from "../domain/operationalValidation.js";
import { FieldLabel } from "./FieldLabel.jsx";

function localDateTimeValue() {
  const now = new Date();
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 19);
}

function defaultHeatId() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `H-${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}

function localDateTimeFromIso(value) {
  if (!value) return localDateTimeValue();
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19) : localDateTimeValue();
}

function optionalDisplay(value, converter, unit) {
  if (value === "" || value === null || value === undefined) return "";
  const converted = converter(value, unit);
  return Number.isFinite(converted) ? String(converted) : "";
}

export function HeatModal({ heat = null, settings, existingHeatIds, locale, t, onClose, onSave }) {
  const editing = Boolean(heat);
  const massUnit = isSupportedMassUnit(settings.unitPolicy.mass) ? settings.unitPolicy.mass : "kg";
  const chemistryUnit = isSupportedConcentrationUnit(settings.unitPolicy.chemistry) ? settings.unitPolicy.chemistry : "%";
  const expectedDuration = heat?.expectedTapAt && heat?.startedAt ? Math.max(1, Math.round((new Date(heat.expectedTapAt) - new Date(heat.startedAt)) / 60000)) : "";
  const defaults = useMemo(() => ({
    id: heat?.id ?? defaultHeatId(),
    gradeCode: heat?.gradeCode ?? settings.gradeProfiles[0]?.code ?? "",
    equipmentProfileId: heat?.equipmentProfileId ?? settings.equipmentProfiles[0]?.id ?? "",
    coefficientProfileId: heat?.coefficientProfileId ?? settings.coefficientProfiles[0]?.id ?? "",
    startedAt: localDateTimeFromIso(heat?.startedAt),
    expectedDurationMinutes: expectedDuration,
    hotMetalKg: optionalDisplay(heat?.initial?.hotMetalKg, convertMassFromKg, massUnit),
    hotMetalMassUnit: massUnit,
    hotMetalC: optionalDisplay(heat?.initial?.hotMetalC, convertConcentrationFromPercent, chemistryUnit),
    hotMetalCUnit: chemistryUnit,
    hotMetalSi: optionalDisplay(heat?.initial?.hotMetalSi, convertConcentrationFromPercent, chemistryUnit),
    hotMetalSiUnit: chemistryUnit,
    hotMetalMn: optionalDisplay(heat?.initial?.hotMetalMn, convertConcentrationFromPercent, chemistryUnit),
    hotMetalMnUnit: chemistryUnit,
    hotMetalP: optionalDisplay(heat?.initial?.hotMetalP, convertConcentrationFromPercent, chemistryUnit),
    hotMetalPUnit: chemistryUnit,
    hotMetalTemperatureC: heat?.initial?.hotMetalTemperatureC ?? "",
    scrapKg: optionalDisplay(heat?.initial?.scrapKg, convertMassFromKg, massUnit),
    scrapMassUnit: massUnit,
    scrapC: optionalDisplay(heat?.initial?.scrapC, convertConcentrationFromPercent, chemistryUnit),
    scrapCUnit: chemistryUnit,
    fluxKg: optionalDisplay(heat?.initial?.fluxKg, convertMassFromKg, massUnit),
    fluxMassUnit: massUnit,
    plannedTotalOxygenNm3: heat?.initial?.plannedTotalOxygenNm3 ?? "",
    cumulativeOxygenNm3: heat?.process?.cumulativeOxygenNm3 ?? "0",
    lanceHeightM: heat?.process?.lanceHeightM ?? "",
    oxygenFlowNm3PerMinute: heat?.process?.oxygenFlowNm3PerMinute ?? "",
  }), [chemistryUnit, expectedDuration, heat, massUnit, settings]);
  const [form, setForm] = useState(defaults);
  const convertOptional = (value, converter, unit) => value === "" ? "" : converter(value, unit);
  const normalizedForm = {
    ...form,
    startedAt: form.startedAt ? new Date(form.startedAt).toISOString() : "",
    hotMetalKg: convertOptional(form.hotMetalKg, convertMassToKg, form.hotMetalMassUnit),
    hotMetalC: convertOptional(form.hotMetalC, convertConcentrationToPercent, form.hotMetalCUnit),
    hotMetalSi: convertOptional(form.hotMetalSi, convertConcentrationToPercent, form.hotMetalSiUnit),
    hotMetalMn: convertOptional(form.hotMetalMn, convertConcentrationToPercent, form.hotMetalMnUnit),
    hotMetalP: convertOptional(form.hotMetalP, convertConcentrationToPercent, form.hotMetalPUnit),
    scrapKg: convertOptional(form.scrapKg, convertMassToKg, form.scrapMassUnit),
    scrapC: convertOptional(form.scrapC, convertConcentrationToPercent, form.scrapCUnit),
    fluxKg: convertOptional(form.fluxKg, convertMassToKg, form.fluxMassUnit),
    inputMetadata: {
      canonicalMassUnit: "kg",
      canonicalChemistryUnit: "%",
      original: {
        hotMetalKg: { value: form.hotMetalKg, unit: form.hotMetalMassUnit },
        hotMetalC: { value: form.hotMetalC, unit: form.hotMetalCUnit },
        hotMetalSi: { value: form.hotMetalSi, unit: form.hotMetalSiUnit },
        hotMetalMn: { value: form.hotMetalMn, unit: form.hotMetalMnUnit },
        hotMetalP: { value: form.hotMetalP, unit: form.hotMetalPUnit },
        scrapKg: { value: form.scrapKg, unit: form.scrapMassUnit },
        scrapC: { value: form.scrapC, unit: form.scrapCUnit },
        fluxKg: { value: form.fluxKg, unit: form.fluxMassUnit },
      },
    },
  };
  const validation = validateNewHeatInput(normalizedForm, editing ? existingHeatIds.filter((id) => id !== heat.id) : existingHeatIds);
  const duplicate = validation.reason === "duplicate_heat_id";
  const ready = form.gradeCode && form.equipmentProfileId && form.coefficientProfileId && validation.ok;
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  function submit(event) {
    event.preventDefault();
    if (!ready) return;
    onSave({ ...normalizedForm, id: form.id.trim() });
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="event-modal heat-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="heat-modal-title">
        <div className="modal-header"><div><span>G0 · {editing ? (locale === "ko" ? "기초 입력 관리" : "Initial input management") : t("initialInputs")}</span><h2 id="heat-modal-title">{editing ? (locale === "ko" ? "기초 입력값 확인·수정" : "Review initial inputs") : t("newHeat")}</h2></div><button type="button" onClick={onClose} aria-label={t("close")}><X /></button></div>
        <div className="form-guidance"><strong>{locale === "ko" ? "입력 구분" : "Input guide"}</strong><span>{locale === "ko" ? "필수는 차지 식별, 계산 핵심은 C·온도 참고예상에 필요, 정확도 권장은 미입력 시 문헌값을 사용합니다." : "Required identifies the heat; Calculation fields enable C and temperature estimates; Recommended fields fall back to literature values when blank."}</span></div>
        <div className="form-section-title">{t("heatIdentity")}</div>
        <div className="form-grid">
          <label><FieldLabel kind="required" locale={locale}>{t("heatNo")}</FieldLabel><input value={form.id} onChange={(event) => set("id", event.target.value)} required disabled={editing} />{duplicate && <small className="field-error">{t("duplicateHeat")}</small>}</label>
          <label><FieldLabel kind="required" locale={locale}>{t("grade")}</FieldLabel><select value={form.gradeCode} onChange={(event) => set("gradeCode", event.target.value)} required>{settings.gradeProfiles.map((item) => <option key={item.code} value={item.code}>{locale === "ko" ? item.nameKo : item.nameEn} · {item.code}</option>)}</select></label>
          <label><FieldLabel kind="required" locale={locale}>{t("equipmentProfile")}</FieldLabel><select value={form.equipmentProfileId} onChange={(event) => set("equipmentProfileId", event.target.value)} required>{settings.equipmentProfiles.map((item) => <option key={item.id} value={item.id}>{locale === "ko" ? item.nameKo : item.nameEn}</option>)}</select></label>
          <label><FieldLabel kind="required" locale={locale}>{t("coefficientVersion")}</FieldLabel><select value={form.coefficientProfileId} onChange={(event) => set("coefficientProfileId", event.target.value)} required>{settings.coefficientProfiles.map((item) => <option key={item.id} value={item.id}>{locale === "ko" ? item.nameKo : item.nameEn}</option>)}</select></label>
          <label><FieldLabel kind="required" locale={locale}>{t("time")}</FieldLabel><input type="datetime-local" step="1" value={form.startedAt} onChange={(event) => set("startedAt", event.target.value)} required disabled={editing} /></label>
          <label><FieldLabel kind="optional" locale={locale}>{t("expectedDuration")} (min)</FieldLabel><input type="number" min="1" value={form.expectedDurationMinutes} onChange={(event) => set("expectedDurationMinutes", event.target.value)} placeholder={locale === "ko" ? "선택 입력" : "Optional"} /></label>
        </div>
        <div className="form-section-title">{t("chargeAndOperation")}</div>
        <div className="form-grid heat-input-grid">
          <label><FieldLabel kind="calculation" locale={locale}>{t("hotMetalMass")}</FieldLabel><div className="input-with-unit"><input type="number" min="0" value={form.hotMetalKg} onChange={(event) => set("hotMetalKg", event.target.value)} /><select aria-label={`${t("hotMetalMass")} ${t("unit")}`} value={form.hotMetalMassUnit} onChange={(event) => set("hotMetalMassUnit", event.target.value)}>{massUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>
          <label><FieldLabel kind="calculation" locale={locale}>{t("hotMetalCarbon")}</FieldLabel><div className="input-with-unit"><input type="number" min="0" step="0.001" value={form.hotMetalC} onChange={(event) => set("hotMetalC", event.target.value)} /><select aria-label={`${t("hotMetalCarbon")} ${t("unit")}`} value={form.hotMetalCUnit} onChange={(event) => set("hotMetalCUnit", event.target.value)}>{concentrationUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>
          {[["hotMetalSi", locale === "ko" ? "용선 Si" : "Hot-metal Si"], ["hotMetalMn", locale === "ko" ? "용선 Mn" : "Hot-metal Mn"], ["hotMetalP", locale === "ko" ? "용선 P" : "Hot-metal P"]].map(([key, label]) => <label key={key}><FieldLabel kind="recommended" locale={locale}>{label}</FieldLabel><div className="input-with-unit"><input type="number" min="0" step="0.001" value={form[key]} onChange={(event) => set(key, event.target.value)} placeholder={locale === "ko" ? "미입력 시 문헌값" : "Literature fallback"} /><select aria-label={`${label} ${t("unit")}`} value={form[`${key}Unit`]} onChange={(event) => set(`${key}Unit`, event.target.value)}>{concentrationUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>)}
          <label><FieldLabel kind="calculation" locale={locale}>{t("hotMetalTemperature")} (°C)</FieldLabel><input type="number" min="0" value={form.hotMetalTemperatureC} onChange={(event) => set("hotMetalTemperatureC", event.target.value)} /></label>
          <label><FieldLabel kind="calculation" locale={locale}>{t("scrapMass")}</FieldLabel><div className="input-with-unit"><input type="number" min="0" value={form.scrapKg} onChange={(event) => set("scrapKg", event.target.value)} /><select aria-label={`${t("scrapMass")} ${t("unit")}`} value={form.scrapMassUnit} onChange={(event) => set("scrapMassUnit", event.target.value)}>{massUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>
          <label><FieldLabel kind="calculation" locale={locale}>{t("scrapCarbon")}</FieldLabel><div className="input-with-unit"><input type="number" min="0" step="0.001" value={form.scrapC} onChange={(event) => set("scrapC", event.target.value)} /><select aria-label={`${t("scrapCarbon")} ${t("unit")}`} value={form.scrapCUnit} onChange={(event) => set("scrapCUnit", event.target.value)}>{concentrationUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>
          <label><FieldLabel kind="recommended" locale={locale}>{t("initialFlux")}</FieldLabel><div className="input-with-unit"><input type="number" min="0" value={form.fluxKg} onChange={(event) => set("fluxKg", event.target.value)} /><select aria-label={`${t("initialFlux")} ${t("unit")}`} value={form.fluxMassUnit} onChange={(event) => set("fluxMassUnit", event.target.value)}>{massUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>
          <label><FieldLabel kind="calculation" locale={locale}>{t("plannedOxygen")} (Nm³)</FieldLabel><input type="number" min="0" value={form.plannedTotalOxygenNm3} onChange={(event) => set("plannedTotalOxygenNm3", event.target.value)} /></label>
          {!editing && <><label><FieldLabel kind="optional" locale={locale}>{t("cumulativeOxygen")} (Nm³)</FieldLabel><input type="number" min="0" value={form.cumulativeOxygenNm3} onChange={(event) => set("cumulativeOxygenNm3", event.target.value)} /></label>
          <label><FieldLabel kind="optional" locale={locale}>{t("lanceHeight")} (m)</FieldLabel><input type="number" min="0" step="0.1" value={form.lanceHeightM} onChange={(event) => set("lanceHeightM", event.target.value)} /></label>
          <label><FieldLabel kind="optional" locale={locale}>{t("oxygenFlow")} (Nm³/min)</FieldLabel><input type="number" min="0" value={form.oxygenFlowNm3PerMinute} onChange={(event) => set("oxygenFlowNm3PerMinute", event.target.value)} /></label></>}
        </div>
        {editing && <div className="form-inline-note">{locale === "ko" ? "누적 산소·랜스·유량은 현재 단계의 ‘체크포인트 기록’에서 갱신합니다. 수정 이력과 작업자 이름은 자동 보존됩니다." : "Update cumulative oxygen, lance height, and flow through Checkpoint entry. The correction history and operator name are preserved automatically."}</div>}
        <div className="settings-warning heat-warning">{t("predictionCaution")}</div>
        {!validation.ok && <p className="modal-validation" role="alert">{validationMessage(validation.reason, locale)}</p>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{t("cancel")}</button><button type="submit" className="primary" disabled={!ready}>{editing ? (locale === "ko" ? "변경값 저장" : "Save changes") : t("createHeat")}</button></div>
      </form>
    </div>
  );
}
