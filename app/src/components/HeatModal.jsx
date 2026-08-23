import { useMemo } from "react";
import { X } from "@phosphor-icons/react";
import { concentrationUnits, convertConcentrationFromPercent, convertConcentrationToPercent, convertMassFromKg, convertMassToKg, isSupportedConcentrationUnit, isSupportedMassUnit, massUnits } from "../units/conversion.js";
import { validateNewHeatInput, validationMessage } from "../domain/operationalValidation.js";
import { FieldLabel } from "./FieldLabel.jsx";
import { usePersistentDraft } from "../hooks/usePersistentDraft.js";
import { useDialogFocus } from "../hooks/useDialogFocus.js";
import { TermHelp } from "./TermHelp.jsx";

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
    hotMetalS: optionalDisplay(heat?.initial?.hotMetalS, convertConcentrationFromPercent, chemistryUnit),
    hotMetalSUnit: chemistryUnit,
    hotMetalTemperatureC: heat?.initial?.hotMetalTemperatureC ?? "",
    scrapKg: optionalDisplay(heat?.initial?.scrapKg, convertMassFromKg, massUnit),
    scrapMassUnit: massUnit,
    scrapC: optionalDisplay(heat?.initial?.scrapC, convertConcentrationFromPercent, chemistryUnit),
    scrapCUnit: chemistryUnit,
    scrapSi: optionalDisplay(heat?.initial?.scrapSi, convertConcentrationFromPercent, chemistryUnit),
    scrapSiUnit: chemistryUnit,
    scrapMn: optionalDisplay(heat?.initial?.scrapMn, convertConcentrationFromPercent, chemistryUnit),
    scrapMnUnit: chemistryUnit,
    scrapP: optionalDisplay(heat?.initial?.scrapP, convertConcentrationFromPercent, chemistryUnit),
    scrapPUnit: chemistryUnit,
    scrapS: optionalDisplay(heat?.initial?.scrapS, convertConcentrationFromPercent, chemistryUnit),
    scrapSUnit: chemistryUnit,
    fluxKg: optionalDisplay(heat?.initial?.fluxKg, convertMassFromKg, massUnit),
    fluxMassUnit: massUnit,
    plannedTotalOxygenNm3: heat?.initial?.plannedTotalOxygenNm3 ?? "",
    cumulativeOxygenNm3: heat?.process?.cumulativeOxygenNm3 ?? "0",
    lanceHeightM: heat?.process?.lanceHeightM ?? "",
    oxygenFlowNm3PerMinute: heat?.process?.oxygenFlowNm3PerMinute ?? "",
  }), [chemistryUnit, expectedDuration, heat, massUnit, settings]);
  const draftKey = editing ? `heat-${heat.id}-initial` : "new-heat";
  const { value: form, setValue: setForm, dirty, restored, commit, discard } = usePersistentDraft({ key: draftKey, baseVersion: settings.version, defaults });
  const dialogRef = useDialogFocus({ onClose });
  const convertOptional = (value, converter, unit) => value === "" ? "" : converter(value, unit);
  const normalizedForm = {
    ...form,
    startedAt: form.startedAt ? new Date(form.startedAt).toISOString() : "",
    hotMetalKg: convertOptional(form.hotMetalKg, convertMassToKg, form.hotMetalMassUnit),
    hotMetalC: convertOptional(form.hotMetalC, convertConcentrationToPercent, form.hotMetalCUnit),
    hotMetalSi: convertOptional(form.hotMetalSi, convertConcentrationToPercent, form.hotMetalSiUnit),
    hotMetalMn: convertOptional(form.hotMetalMn, convertConcentrationToPercent, form.hotMetalMnUnit),
    hotMetalP: convertOptional(form.hotMetalP, convertConcentrationToPercent, form.hotMetalPUnit),
    hotMetalS: convertOptional(form.hotMetalS, convertConcentrationToPercent, form.hotMetalSUnit),
    scrapKg: convertOptional(form.scrapKg, convertMassToKg, form.scrapMassUnit),
    scrapC: convertOptional(form.scrapC, convertConcentrationToPercent, form.scrapCUnit),
    scrapSi: convertOptional(form.scrapSi, convertConcentrationToPercent, form.scrapSiUnit),
    scrapMn: convertOptional(form.scrapMn, convertConcentrationToPercent, form.scrapMnUnit),
    scrapP: convertOptional(form.scrapP, convertConcentrationToPercent, form.scrapPUnit),
    scrapS: convertOptional(form.scrapS, convertConcentrationToPercent, form.scrapSUnit),
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
        hotMetalS: { value: form.hotMetalS, unit: form.hotMetalSUnit },
        scrapKg: { value: form.scrapKg, unit: form.scrapMassUnit },
        scrapC: { value: form.scrapC, unit: form.scrapCUnit },
        scrapSi: { value: form.scrapSi, unit: form.scrapSiUnit },
        scrapMn: { value: form.scrapMn, unit: form.scrapMnUnit },
        scrapP: { value: form.scrapP, unit: form.scrapPUnit },
        scrapS: { value: form.scrapS, unit: form.scrapSUnit },
        fluxKg: { value: form.fluxKg, unit: form.fluxMassUnit },
      },
    },
  };
  const validation = validateNewHeatInput(normalizedForm, editing ? existingHeatIds.filter((id) => id !== heat.id) : existingHeatIds);
  const duplicate = validation.reason === "duplicate_heat_id";
  const ready = form.gradeCode && form.equipmentProfileId && form.coefficientProfileId && validation.ok;
  const calculationCoreKeys = ["hotMetalKg", "hotMetalC", "hotMetalTemperatureC", "scrapKg", "scrapC", "plannedTotalOxygenNm3"];
  const calculationCoreCount = calculationCoreKeys.filter((key) => form[key] !== "" && Number.isFinite(Number(form[key]))).length;
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  function submit(event) {
    event.preventDefault();
    if (!ready) return;
    if (onSave({ ...normalizedForm, id: form.id.trim() }) === false) return;
    commit();
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form ref={dialogRef} tabIndex="-1" className="event-modal heat-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="heat-modal-title">
        <div className="modal-header"><div><span>G0 · {editing ? (locale === "ko" ? "기초 입력 관리" : "Initial input management") : t("initialInputs")}</span><h2 id="heat-modal-title">{editing ? (locale === "ko" ? "기초 입력값 확인·수정" : "Review initial inputs") : t("newHeat")}</h2></div><button type="button" onClick={onClose} aria-label={t("close")}><X /></button></div>
        <div className="form-guidance"><strong>{locale === "ko" ? "입력 구분" : "Input guide"}</strong><span>{locale === "ko" ? "필수는 차지 식별, 계산 핵심은 6개 품질항목의 종점 참고예상에 필요, 정확도 권장은 미입력 시 문헌값을 사용합니다." : "Required identifies the heat; Calculation fields support all six endpoint reference estimates; Recommended fields fall back to literature values when blank."}</span></div>
        {dirty && <div className="draft-status" role="status"><strong>{restored ? (locale === "ko" ? "저장되지 않은 초안을 복구했습니다." : "Unsaved draft restored.") : (locale === "ko" ? "작성 중 초안이 이 PC에 자동 보관됩니다." : "This draft is preserved automatically on this PC.")}</strong><button type="button" onClick={() => { discard(); onClose(); }}>{locale === "ko" ? "초안 버리기" : "Discard draft"}</button></div>}
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
        <div className={`calculation-completeness ${calculationCoreCount === calculationCoreKeys.length ? "complete" : "incomplete"}`} role="status"><strong>{locale === "ko" ? `계산 핵심 ${calculationCoreCount}/6 입력` : `${calculationCoreCount}/6 calculation fields`}</strong><span>{calculationCoreCount === calculationCoreKeys.length ? (locale === "ko" ? "C·온도·P·Mn·Si·S 종점 참고예상을 계산할 기본 조건이 갖춰졌습니다." : "Basic conditions are ready for C, temperature, P, Mn, Si, and S endpoint estimates.") : (locale === "ko" ? "차지는 생성할 수 있지만, 비어 있는 핵심값 때문에 종점 예상 일부 또는 전체가 ‘–’로 표시될 수 있습니다." : "The heat can be created, but missing core values may leave some or all endpoint estimates unavailable.")}</span></div>
        <div className="form-grid heat-input-grid">
          <label><FieldLabel kind="calculation" locale={locale}>{t("hotMetalMass")}</FieldLabel><div className="input-with-unit"><input type="number" min="0" value={form.hotMetalKg} onChange={(event) => set("hotMetalKg", event.target.value)} /><select aria-label={`${t("hotMetalMass")} ${t("unit")}`} value={form.hotMetalMassUnit} onChange={(event) => set("hotMetalMassUnit", event.target.value)}>{massUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>
          <label><FieldLabel kind="calculation" locale={locale}>{t("hotMetalCarbon")}</FieldLabel><div className="input-with-unit"><input type="number" min="0" step="0.001" value={form.hotMetalC} onChange={(event) => set("hotMetalC", event.target.value)} /><select aria-label={`${t("hotMetalCarbon")} ${t("unit")}`} value={form.hotMetalCUnit} onChange={(event) => set("hotMetalCUnit", event.target.value)}>{concentrationUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>
          {[["hotMetalSi", locale === "ko" ? "용선 Si" : "Hot-metal Si"], ["hotMetalMn", locale === "ko" ? "용선 Mn" : "Hot-metal Mn"], ["hotMetalP", locale === "ko" ? "용선 P" : "Hot-metal P"], ["hotMetalS", locale === "ko" ? "용선 S" : "Hot-metal S"]].map(([key, label]) => <label key={key}><FieldLabel kind="recommended" locale={locale}>{label}</FieldLabel><div className="input-with-unit"><input type="number" min="0" step="0.001" value={form[key]} onChange={(event) => set(key, event.target.value)} placeholder={locale === "ko" ? "미입력 시 문헌값" : "Literature fallback"} /><select aria-label={`${label} ${t("unit")}`} value={form[`${key}Unit`]} onChange={(event) => set(`${key}Unit`, event.target.value)}>{concentrationUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>)}
          <label><FieldLabel kind="calculation" locale={locale}>{t("hotMetalTemperature")} (°C)</FieldLabel><input type="number" min="0" value={form.hotMetalTemperatureC} onChange={(event) => set("hotMetalTemperatureC", event.target.value)} /></label>
          <label><FieldLabel kind="calculation" locale={locale}>{t("scrapMass")}</FieldLabel><div className="input-with-unit"><input type="number" min="0" value={form.scrapKg} onChange={(event) => set("scrapKg", event.target.value)} /><select aria-label={`${t("scrapMass")} ${t("unit")}`} value={form.scrapMassUnit} onChange={(event) => set("scrapMassUnit", event.target.value)}>{massUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>
          <label><FieldLabel kind="calculation" locale={locale}>{t("scrapCarbon")}</FieldLabel><div className="input-with-unit"><input type="number" min="0" step="0.001" value={form.scrapC} onChange={(event) => set("scrapC", event.target.value)} /><select aria-label={`${t("scrapCarbon")} ${t("unit")}`} value={form.scrapCUnit} onChange={(event) => set("scrapCUnit", event.target.value)}>{concentrationUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>
          {[["scrapSi", "Si"], ["scrapMn", "Mn"], ["scrapP", "P"], ["scrapS", "S"]].map(([key, element]) => <label key={key}><FieldLabel kind="optional" locale={locale}>{locale === "ko" ? `스크랩 ${element}` : `Scrap ${element}`}</FieldLabel><div className="input-with-unit"><input type="number" min="0" step="0.001" value={form[key]} onChange={(event) => set(key, event.target.value)} placeholder={locale === "ko" ? "미입력 시 0으로 계산" : "Blank is treated as 0"} /><select aria-label={`${locale === "ko" ? "스크랩" : "Scrap"} ${element} ${t("unit")}`} value={form[`${key}Unit`]} onChange={(event) => set(`${key}Unit`, event.target.value)}>{concentrationUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>)}
          <label><FieldLabel kind="recommended" locale={locale}>{t("initialFlux")}</FieldLabel><div className="input-with-unit"><input type="number" min="0" value={form.fluxKg} onChange={(event) => set("fluxKg", event.target.value)} /><select aria-label={`${t("initialFlux")} ${t("unit")}`} value={form.fluxMassUnit} onChange={(event) => set("fluxMassUnit", event.target.value)}>{massUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>
          <label><FieldLabel kind="calculation" locale={locale}>{t("plannedOxygen")} (Nm³)</FieldLabel><input type="number" min="0" value={form.plannedTotalOxygenNm3} onChange={(event) => set("plannedTotalOxygenNm3", event.target.value)} /></label>
          {!editing && <><label><FieldLabel kind="optional" locale={locale}>{t("cumulativeOxygen")} (Nm³)</FieldLabel><input type="number" min="0" value={form.cumulativeOxygenNm3} onChange={(event) => set("cumulativeOxygenNm3", event.target.value)} /></label>
          <label><FieldLabel kind="optional" locale={locale}>{t("lanceHeight")} (m)</FieldLabel><input type="number" min="0" step="0.1" value={form.lanceHeightM} onChange={(event) => set("lanceHeightM", event.target.value)} /></label>
          <label><FieldLabel kind="optional" locale={locale}>{t("oxygenFlow")} (Nm³/min)</FieldLabel><input type="number" min="0" value={form.oxygenFlowNm3PerMinute} onChange={(event) => set("oxygenFlowNm3PerMinute", event.target.value)} /></label></>}
        </div>
        {editing && <div className="form-inline-note">{locale === "ko" ? "누적 산소·랜스·유량은 현재 단계의 ‘체크포인트 기록’에서 갱신합니다. 수정 이력과 작업자 이름은 자동 보존됩니다." : "Update cumulative oxygen, lance height, and flow through Checkpoint entry. The correction history and operator name are preserved automatically."}</div>}
        <TermHelp locale={locale} items={[
          { term: locale === "ko" ? "계획 총 산소 / 누적 산소" : "Planned / cumulative O₂", ko: "계획 총 산소는 종점까지의 계획 총량, 누적 산소는 현재까지 실제 공급된 양입니다. 둘 다 Nm³입니다.", en: "Planned oxygen is the endpoint plan; cumulative oxygen is the actual amount supplied so far. Both use Nm³." },
          { term: "Nm³ / Nm³/min", ko: "표준 상태 기체 체적 / 1분당 표준 상태 산소 유량입니다. 실제 배관 체적 m³와 구분합니다.", en: "Normalized gas volume / normalized oxygen volume per minute; different from actual pipe-volume m³." },
          { term: locale === "ko" ? "초기 부원료" : "Initial flux", ko: "G0에서 이미 투입된 flux 계열 부원료의 합계 질량입니다. 재료별 투입은 자재 투입 기록에 남깁니다.", en: "Total mass of flux-category materials already charged at G0. Record individual additions as material events." },
          { term: locale === "ko" ? "랜스 높이" : "Lance height", ko: "현장 기준점에서 랜스까지의 거리입니다. 기준점과 허용 범위는 사업소 표준을 따릅니다.", en: "Distance from the site-defined reference point to the lance. Follow the site reference and limits." },
          { term: "% / wt% / ppm", ko: "%와 wt%는 질량비로 동일하게 취급하며 1% = 10,000 ppm입니다. 선택 단위는 내부에서 %로 환산됩니다.", en: "% and wt% are treated as mass percent; 1% = 10,000 ppm. Inputs are normalized to percent." },
        ]} />
        <div className="settings-warning heat-warning">{t("predictionCaution")}</div>
        {!validation.ok && <p className="modal-validation" role="alert">{validationMessage(validation.reason, locale)}</p>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{t("cancel")}</button><button type="submit" className="primary" disabled={!ready}>{editing ? (locale === "ko" ? "변경값 저장" : "Save changes") : t("createHeat")}</button></div>
      </form>
    </div>
  );
}
