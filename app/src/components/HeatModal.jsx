import { useMemo, useState } from "react";
import { X } from "@phosphor-icons/react";

function localDateTimeValue() {
  const now = new Date();
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function defaultHeatId() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "2-digit", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(now).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  return `H-${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}`;
}

export function HeatModal({ settings, existingHeatIds, locale, t, onClose, onSave }) {
  const defaults = useMemo(() => ({
    id: defaultHeatId(),
    gradeCode: settings.gradeProfiles[0]?.code ?? "",
    equipmentProfileId: settings.equipmentProfiles[0]?.id ?? "",
    coefficientProfileId: settings.coefficientProfiles[0]?.id ?? "",
    startedAt: localDateTimeValue(),
    expectedDurationMinutes: "",
    hotMetalKg: "",
    hotMetalC: "",
    hotMetalSi: "",
    hotMetalMn: "",
    hotMetalP: "",
    hotMetalTemperatureC: "",
    scrapKg: "",
    scrapC: "",
    fluxKg: "",
    plannedTotalOxygenNm3: "",
    cumulativeOxygenNm3: "0",
    lanceHeightM: "",
    oxygenFlowNm3PerMinute: "",
  }), [settings]);
  const [form, setForm] = useState(defaults);
  const duplicate = existingHeatIds.includes(form.id.trim());
  const ready = form.gradeCode && form.equipmentProfileId && form.coefficientProfileId && !duplicate;
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));

  function submit(event) {
    event.preventDefault();
    if (!ready) return;
    onSave({ ...form, id: form.id.trim(), startedAt: new Date(form.startedAt).toISOString() });
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="event-modal heat-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="heat-modal-title">
        <div className="modal-header"><div><span>G0 · {t("initialInputs")}</span><h2 id="heat-modal-title">{t("newHeat")}</h2></div><button type="button" onClick={onClose} aria-label={t("close")}><X /></button></div>
        <div className="form-section-title">{t("heatIdentity")}</div>
        <div className="form-grid">
          <label><span>{t("heatNo")}</span><input value={form.id} onChange={(event) => set("id", event.target.value)} required />{duplicate && <small className="field-error">{t("duplicateHeat")}</small>}</label>
          <label><span>{t("grade")}</span><select value={form.gradeCode} onChange={(event) => set("gradeCode", event.target.value)} required>{settings.gradeProfiles.map((item) => <option key={item.code} value={item.code}>{locale === "ko" ? item.nameKo : item.nameEn} · {item.code}</option>)}</select></label>
          <label><span>{t("equipmentProfile")}</span><select value={form.equipmentProfileId} onChange={(event) => set("equipmentProfileId", event.target.value)} required>{settings.equipmentProfiles.map((item) => <option key={item.id} value={item.id}>{locale === "ko" ? item.nameKo : item.nameEn}</option>)}</select></label>
          <label><span>{t("coefficientVersion")}</span><select value={form.coefficientProfileId} onChange={(event) => set("coefficientProfileId", event.target.value)} required>{settings.coefficientProfiles.map((item) => <option key={item.id} value={item.id}>{locale === "ko" ? item.nameKo : item.nameEn}</option>)}</select></label>
          <label><span>{t("time")}</span><input type="datetime-local" value={form.startedAt} onChange={(event) => set("startedAt", event.target.value)} required /></label>
          <label><span>{t("expectedDuration")} (min)</span><input type="number" min="1" value={form.expectedDurationMinutes} onChange={(event) => set("expectedDurationMinutes", event.target.value)} placeholder={locale === "ko" ? "선택 입력" : "Optional"} /></label>
        </div>
        <div className="form-section-title">{t("chargeAndOperation")}</div>
        <div className="form-grid heat-input-grid">
          <label><span>{t("hotMetalMass")} (kg)</span><input type="number" min="0" value={form.hotMetalKg} onChange={(event) => set("hotMetalKg", event.target.value)} /></label>
          <label><span>{t("hotMetalCarbon")} (%)</span><input type="number" min="0" step="0.001" value={form.hotMetalC} onChange={(event) => set("hotMetalC", event.target.value)} /></label>
          <label><span>{locale === "ko" ? "용선 Si" : "Hot-metal Si"} (%)</span><input type="number" min="0" step="0.001" value={form.hotMetalSi} onChange={(event) => set("hotMetalSi", event.target.value)} placeholder={locale === "ko" ? "미입력 시 문헌값" : "Literature fallback"} /></label>
          <label><span>{locale === "ko" ? "용선 Mn" : "Hot-metal Mn"} (%)</span><input type="number" min="0" step="0.001" value={form.hotMetalMn} onChange={(event) => set("hotMetalMn", event.target.value)} placeholder={locale === "ko" ? "미입력 시 문헌값" : "Literature fallback"} /></label>
          <label><span>{locale === "ko" ? "용선 P" : "Hot-metal P"} (%)</span><input type="number" min="0" step="0.001" value={form.hotMetalP} onChange={(event) => set("hotMetalP", event.target.value)} placeholder={locale === "ko" ? "미입력 시 문헌값" : "Literature fallback"} /></label>
          <label><span>{t("hotMetalTemperature")} (°C)</span><input type="number" min="0" value={form.hotMetalTemperatureC} onChange={(event) => set("hotMetalTemperatureC", event.target.value)} /></label>
          <label><span>{t("scrapMass")} (kg)</span><input type="number" min="0" value={form.scrapKg} onChange={(event) => set("scrapKg", event.target.value)} /></label>
          <label><span>{t("scrapCarbon")} (%)</span><input type="number" min="0" step="0.001" value={form.scrapC} onChange={(event) => set("scrapC", event.target.value)} /></label>
          <label><span>{t("initialFlux")} (kg)</span><input type="number" min="0" value={form.fluxKg} onChange={(event) => set("fluxKg", event.target.value)} /></label>
          <label><span>{t("plannedOxygen")} (Nm³)</span><input type="number" min="0" value={form.plannedTotalOxygenNm3} onChange={(event) => set("plannedTotalOxygenNm3", event.target.value)} /></label>
          <label><span>{t("cumulativeOxygen")} (Nm³)</span><input type="number" min="0" value={form.cumulativeOxygenNm3} onChange={(event) => set("cumulativeOxygenNm3", event.target.value)} /></label>
          <label><span>{t("lanceHeight")} (m)</span><input type="number" min="0" step="0.1" value={form.lanceHeightM} onChange={(event) => set("lanceHeightM", event.target.value)} /></label>
          <label><span>{t("oxygenFlow")} (Nm³/min)</span><input type="number" min="0" value={form.oxygenFlowNm3PerMinute} onChange={(event) => set("oxygenFlowNm3PerMinute", event.target.value)} /></label>
        </div>
        <div className="settings-warning heat-warning">{t("predictionCaution")}</div>
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{t("cancel")}</button><button type="submit" className="primary" disabled={!ready}>{t("createHeat")}</button></div>
      </form>
    </div>
  );
}
