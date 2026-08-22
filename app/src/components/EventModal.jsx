import { useMemo, useState } from "react";
import { X } from "@phosphor-icons/react";
import { concentrationUnits, convertConcentrationToPercent, convertMassToKg, isSupportedConcentrationUnit, isSupportedMassUnit, massUnits } from "../units/conversion.js";
import { validateHeatEventInput, validationMessage } from "../domain/operationalValidation.js";
import { FieldLabel } from "./FieldLabel.jsx";

function localDateTimeValue() {
  const now = new Date();
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 19);
}

function isoFromLocal(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function optionalConverted(value, unit) {
  return value === "" ? "" : convertConcentrationToPercent(value, unit);
}

const titles = { material: "materialEvent", sample: "sampleEvent", analysis: "analysisEvent", checkpoint: "checkpointEvent", reblow: "reblowEvent", tap: "tapEvent" };
const chemistryKeys = ["C", "P", "Mn", "Si", "S"];

const guidance = {
  material: { ko: "실제 투입한 자재와 양을 기록합니다.", en: "Record the material and actual amount added." },
  sample: { ko: "실제 채취 시각과 현장에서 사용하는 샘플 ID를 기록합니다.", en: "Record the actual sampling time and site sample ID." },
  analysis: { ko: "하나 이상의 분석값이 필요하며, 종점 검토에는 C와 온도를 함께 입력하는 것이 중요합니다.", en: "At least one result is required; endpoint review should include both C and temperature." },
  checkpoint: { ko: "누적 산소는 필수이며 랜스·유량·잔여시간은 확인 가능한 실제값을 입력합니다.", en: "Cumulative oxygen is required; enter actual lance, flow, and remaining time when available." },
  reblow: { ko: "실제로 추가한 산소량을 기록하면 종점 참고예상에 즉시 반영됩니다.", en: "Record actual additional oxygen so the endpoint estimate updates immediately." },
  tap: { ko: "실제 출강 시각을 저장하면 차지가 G7 출강 단계로 이동합니다.", en: "Saving the actual tap time moves the heat to G7 Tapping." },
};

export function EventModal({ action, heat, settings, locale, t, onClose, onSave }) {
  const activeHeatSamples = useMemo(() => heat.samples.filter((sample) => (sample.status ?? "active") === "active"), [heat.samples]);
  const defaultChemistryUnit = isSupportedConcentrationUnit(settings.unitPolicy.chemistry) ? settings.unitPolicy.chemistry : "%";
  const defaults = useMemo(() => ({
    occurredAt: localDateTimeValue(),
    materialCode: settings.materials[0]?.code ?? "",
    amountKg: "",
    amountUnit: isSupportedMassUnit(settings.materials[0]?.unit) ? settings.materials[0].unit : settings.unitPolicy.mass,
    sampleId: action === "analysis" ? activeHeatSamples.at(-1)?.id ?? "" : `S-${String(heat.samples.length + 1).padStart(3, "0")}`,
    method: "OES",
    C: "", temperature: "", P: "", Mn: "", Si: "", S: "",
    CUnit: defaultChemistryUnit, PUnit: defaultChemistryUnit, MnUnit: defaultChemistryUnit, SiUnit: defaultChemistryUnit, SUnit: defaultChemistryUnit,
    cumulativeOxygenNm3: action === "analysis" ? activeHeatSamples.at(-1)?.processSnapshot?.cumulativeOxygenNm3 ?? heat.process.cumulativeOxygenNm3 ?? "" : heat.process.cumulativeOxygenNm3 ?? "",
    oxygenFlowNm3PerMinute: heat.process.oxygenFlowNm3PerMinute ?? "",
    lanceHeightM: heat.process.lanceHeightM ?? "",
    remainingMinutes: heat.process.remainingMinutes ?? "",
    additionalOxygenNm3: "",
    durationMinutes: "",
  }), [action, activeHeatSamples, defaultChemistryUnit, heat, settings]);
  const [form, setForm] = useState(defaults);
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const latestSample = activeHeatSamples.at(-1);
  const material = settings.materials.find((item) => item.code === form.materialCode);
  const normalizedAmountKg = action === "material" && form.amountKg !== "" ? convertMassToKg(form.amountKg, form.amountUnit) : form.amountKg;
  const values = Object.fromEntries(chemistryKeys.map((key) => [key, optionalConverted(form[key], form[`${key}Unit`])]).concat([["temperature", form.temperature]]));
  const payload = {
    ...form,
    occurredAt: isoFromLocal(form.occurredAt),
    sampleId: (form.sampleId || latestSample?.id || "").trim(),
    amountKg: normalizedAmountKg,
    originalAmount: action === "material" ? form.amountKg : undefined,
    originalUnit: action === "material" ? form.amountUnit : undefined,
    canonicalUnit: action === "material" ? "kg" : undefined,
    materialCategory: material?.category ?? "other",
    materialName: locale === "ko" ? material?.nameKo : material?.nameEn,
    values,
    originalValues: action === "analysis" ? Object.fromEntries(chemistryKeys.map((key) => [key, { value: form[key], unit: form[`${key}Unit`] }]).concat([["temperature", { value: form.temperature, unit: "°C" }]])) : undefined,
  };
  const validation = validateHeatEventInput(heat, action, payload);

  function submit(event) {
    event.preventDefault();
    if (!validation.ok) return;
    onSave(action, payload);
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="event-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
        <div className="modal-header"><div><span>{heat.id}</span><h2 id="event-modal-title">{t(titles[action])}</h2></div><button type="button" onClick={onClose} aria-label={t("close")}><X /></button></div>
        <div className="form-guidance"><strong>{heat.stage} · {locale === "ko" ? "입력 안내" : "Input guide"}</strong><span>{guidance[action]?.[locale === "ko" ? "ko" : "en"]}</span></div>
        <div className="form-grid">
          <label className="full"><FieldLabel kind="required" locale={locale}>{t("time")}</FieldLabel><input type="datetime-local" step="1" value={form.occurredAt} onChange={(event) => set("occurredAt", event.target.value)} required /></label>
          {action === "material" && <><label><FieldLabel kind="required" locale={locale}>{t("material")}</FieldLabel><select value={form.materialCode} onChange={(event) => { const item = settings.materials.find((candidate) => candidate.code === event.target.value); setForm((previous) => ({ ...previous, materialCode: event.target.value, amountUnit: isSupportedMassUnit(item?.unit) ? item.unit : previous.amountUnit })); }}>{settings.materials.map((item) => <option key={item.code} value={item.code}>{locale === "ko" ? item.nameKo : item.nameEn}</option>)}</select></label><label><FieldLabel kind="required" locale={locale}>{t("amount")}</FieldLabel><div className="input-with-unit"><input type="number" min="0" step="0.001" value={form.amountKg} onChange={(event) => set("amountKg", event.target.value)} required /><select aria-label={t("unit")} value={form.amountUnit} onChange={(event) => set("amountUnit", event.target.value)}>{massUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label></>}
          {action === "sample" && <label className="full"><FieldLabel kind="required" locale={locale}>{t("sampleId")}</FieldLabel><input value={form.sampleId} maxLength="80" onChange={(event) => set("sampleId", event.target.value)} required /></label>}
          {action === "analysis" && <>
            <label><FieldLabel kind="required" locale={locale}>{t("sampleId")}</FieldLabel><select value={form.sampleId || latestSample?.id || ""} onChange={(event) => { const selected = activeHeatSamples.find((sample) => sample.id === event.target.value); setForm((previous) => ({ ...previous, sampleId: event.target.value, cumulativeOxygenNm3: selected?.processSnapshot?.cumulativeOxygenNm3 ?? heat.process.cumulativeOxygenNm3 })); }}>{activeHeatSamples.map((sample) => <option key={sample.id}>{sample.id}</option>)}</select></label>
            <label><FieldLabel kind="optional" locale={locale}>{t("method")}</FieldLabel><input value={form.method} maxLength="80" onChange={(event) => set("method", event.target.value)} /></label>
            <label><FieldLabel kind="required" locale={locale}>{locale === "ko" ? "샘플 시점 누적 산소" : "Oxygen at sample"} (Nm³)</FieldLabel><input type="number" min="0" value={form.cumulativeOxygenNm3} onChange={(event) => set("cumulativeOxygenNm3", event.target.value)} required /></label>
            {chemistryKeys.map((key) => <label key={key}><FieldLabel kind={key === "C" ? "calculation" : "optional"} locale={locale}>{key}</FieldLabel><div className="input-with-unit"><input type="number" min="0" step="0.001" value={form[key]} onChange={(event) => set(key, event.target.value)} /><select aria-label={`${key} ${t("unit")}`} value={form[`${key}Unit`]} onChange={(event) => set(`${key}Unit`, event.target.value)}>{concentrationUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label>)}
            <label><FieldLabel kind="calculation" locale={locale}>T (°C)</FieldLabel><input type="number" min="0" max="2500" step="1" value={form.temperature} onChange={(event) => set("temperature", event.target.value)} /></label>
          </>}
          {action === "checkpoint" && <>
            <label><FieldLabel kind="required" locale={locale}>{t("cumulativeOxygen")} (Nm³)</FieldLabel><input type="number" min="0" value={form.cumulativeOxygenNm3} onChange={(event) => set("cumulativeOxygenNm3", event.target.value)} required /></label>
            <label><FieldLabel kind="recommended" locale={locale}>{t("lanceHeight")} (m)</FieldLabel><input type="number" min="0" step="0.1" value={form.lanceHeightM} onChange={(event) => set("lanceHeightM", event.target.value)} /></label>
            <label><FieldLabel kind="recommended" locale={locale}>{t("oxygenFlow")} (Nm³/min)</FieldLabel><input type="number" min="0" value={form.oxygenFlowNm3PerMinute} onChange={(event) => set("oxygenFlowNm3PerMinute", event.target.value)} /></label>
            <label><FieldLabel kind="optional" locale={locale}>{locale === "ko" ? "예상 잔여시간" : "Estimated remaining time"} (min)</FieldLabel><input type="number" min="0" value={form.remainingMinutes} onChange={(event) => set("remainingMinutes", event.target.value)} /></label>
          </>}
          {action === "reblow" && <><label><FieldLabel kind="required" locale={locale}>{locale === "ko" ? "추가 산소" : "Additional oxygen"} (Nm³)</FieldLabel><input type="number" min="0" value={form.additionalOxygenNm3} onChange={(event) => set("additionalOxygenNm3", event.target.value)} required /></label><label><FieldLabel kind="optional" locale={locale}>{t("duration")} (min)</FieldLabel><input type="number" min="0" value={form.durationMinutes} onChange={(event) => set("durationMinutes", event.target.value)} /></label></>}
          {action === "tap" && <div className="tap-confirm full"><strong>{t("completeTap")}</strong><p>{t("validationWarning")}</p></div>}
        </div>
        {!validation.ok && <p className="modal-validation" role="alert">{validationMessage(validation.reason, locale)}</p>}
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{t("cancel")}</button><button type="submit" className="primary" disabled={!validation.ok}>{t("save")}</button></div>
      </form>
    </div>
  );
}
