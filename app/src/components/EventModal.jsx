import { useMemo, useState } from "react";
import { X } from "@phosphor-icons/react";
import { convertMassToKg, isSupportedMassUnit, massUnits } from "../units/conversion.js";

function localDateTimeValue() {
  const now = new Date();
  const shifted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

function isoFromLocal(value) {
  return new Date(value).toISOString();
}

function localValueFromIso(value) {
  const date = new Date(value);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}

const titles = { material: "materialEvent", sample: "sampleEvent", analysis: "analysisEvent", checkpoint: "checkpointEvent", reblow: "reblowEvent", tap: "tapEvent" };

export function EventModal({ action, heat, settings, locale, t, onClose, onSave }) {
  const defaults = useMemo(() => ({
    occurredAt: action === "analysis" && heat.samples.at(-1)?.sampledAt ? localValueFromIso(heat.samples.at(-1).sampledAt) : localDateTimeValue(),
    materialCode: settings.materials[0]?.code ?? "",
    amountKg: "500",
    amountUnit: isSupportedMassUnit(settings.materials[0]?.unit) ? settings.materials[0].unit : settings.unitPolicy.mass,
    sampleId: action === "analysis"
      ? heat.samples.at(-1)?.id ?? ""
      : `S-${String(heat.samples.length + 1).padStart(3, "0")}`,
    method: "OES",
    C: "",
    temperature: "",
    P: "",
    Mn: "",
    Si: "",
    S: "",
    cumulativeOxygenNm3: action === "analysis" ? heat.samples.at(-1)?.processSnapshot?.cumulativeOxygenNm3 ?? heat.process.cumulativeOxygenNm3 : heat.process.cumulativeOxygenNm3,
    oxygenFlowNm3PerMinute: heat.process.oxygenFlowNm3PerMinute ?? "",
    lanceHeightM: heat.process.lanceHeightM,
    remainingMinutes: heat.process.remainingMinutes,
    additionalOxygenNm3: "300",
    durationMinutes: "2",
  }), [action, heat, settings]);
  const [form, setForm] = useState(defaults);
  const set = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const latestSample = heat.samples.at(-1);

  function submit(event) {
    event.preventDefault();
    const occurredAt = isoFromLocal(form.occurredAt);
    const material = settings.materials.find((item) => item.code === form.materialCode);
    const normalizedAmountKg = action === "material" ? convertMassToKg(form.amountKg, form.amountUnit) : null;
    const summaries = {
      material: [`${material?.nameKo ?? form.materialCode} ${form.amountKg} ${form.amountUnit} 투입 (${normalizedAmountKg.toLocaleString()} kg)`, `${material?.nameEn ?? form.materialCode} ${form.amountKg} ${form.amountUnit} added (${normalizedAmountKg.toLocaleString()} kg)`],
      sample: [`샘플 ${form.sampleId} 채취`, `Sample ${form.sampleId} taken`],
      analysis: [`샘플 ${form.sampleId || latestSample?.id} 분석 입력`, `Analysis entered for ${form.sampleId || latestSample?.id}`],
      checkpoint: [`누적 산소 ${form.cumulativeOxygenNm3} Nm³`, `Cumulative oxygen ${form.cumulativeOxygenNm3} Nm³`],
      reblow: [`재취련 산소 ${form.additionalOxygenNm3} Nm³`, `Reblow oxygen ${form.additionalOxygenNm3} Nm³`],
      tap: ["출강 완료", "Tap completed"],
    };
    const [summaryKo, summaryEn] = summaries[action];
    onSave(action, {
      ...form,
      occurredAt,
      summaryKo,
      summaryEn,
      sampleId: form.sampleId || latestSample?.id,
      amountKg: normalizedAmountKg ?? form.amountKg,
      materialCategory: material?.category ?? "other",
      values: { C: form.C, temperature: form.temperature, P: form.P, Mn: form.Mn, Si: form.Si, S: form.S },
    });
    onClose();
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="event-modal" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="event-modal-title">
        <div className="modal-header"><div><span>{heat.id}</span><h2 id="event-modal-title">{t(titles[action])}</h2></div><button type="button" onClick={onClose} aria-label={t("close")}><X /></button></div>
        <div className="form-grid">
          <label className="full"><span>{t("time")}</span><input type="datetime-local" value={form.occurredAt} onChange={(event) => set("occurredAt", event.target.value)} required /></label>
          {action === "material" && <><label><span>{t("material")}</span><select value={form.materialCode} onChange={(event) => { const item = settings.materials.find((candidate) => candidate.code === event.target.value); setForm((previous) => ({ ...previous, materialCode: event.target.value, amountUnit: isSupportedMassUnit(item?.unit) ? item.unit : previous.amountUnit })); }}>{settings.materials.map((item) => <option key={item.code} value={item.code}>{locale === "ko" ? item.nameKo : item.nameEn}</option>)}</select></label><label><span>{t("amount")}</span><div className="input-with-unit"><input type="number" min="0" step="0.001" value={form.amountKg} onChange={(event) => set("amountKg", event.target.value)} required /><select aria-label={t("unit")} value={form.amountUnit} onChange={(event) => set("amountUnit", event.target.value)}>{massUnits.map((unit) => <option key={unit}>{unit}</option>)}</select></div></label></>}
          {action === "sample" && <label className="full"><span>{t("sampleId")}</span><input value={form.sampleId} onChange={(event) => set("sampleId", event.target.value)} required /></label>}
          {action === "analysis" && <>
            <label><span>{t("sampleId")}</span><select value={form.sampleId || latestSample?.id || ""} onChange={(event) => { const selected = heat.samples.find((sample) => sample.id === event.target.value); setForm((previous) => ({ ...previous, sampleId: event.target.value, cumulativeOxygenNm3: selected?.processSnapshot?.cumulativeOxygenNm3 ?? heat.process.cumulativeOxygenNm3, occurredAt: selected?.sampledAt ? localValueFromIso(selected.sampledAt) : previous.occurredAt })); }}>{heat.samples.map((sample) => <option key={sample.id}>{sample.id}</option>)}</select></label>
            <label><span>{t("method")}</span><input value={form.method} onChange={(event) => set("method", event.target.value)} /></label>
            <label><span>{locale === "ko" ? "샘플 시점 누적 산소" : "Oxygen at sample"} (Nm³)</span><input type="number" min="0" value={form.cumulativeOxygenNm3} onChange={(event) => set("cumulativeOxygenNm3", event.target.value)} required /></label>
            {["C", "P", "Mn", "Si", "S"].map((key) => <label key={key}><span>{key} (%)</span><input type="number" step="0.001" value={form[key]} onChange={(event) => set(key, event.target.value)} /></label>)}
            <label><span>T (°C)</span><input type="number" step="1" value={form.temperature} onChange={(event) => set("temperature", event.target.value)} /></label>
          </>}
          {action === "checkpoint" && <>
            <label><span>{t("cumulativeOxygen")} (Nm³)</span><input type="number" min="0" value={form.cumulativeOxygenNm3} onChange={(event) => set("cumulativeOxygenNm3", event.target.value)} required /></label>
            <label><span>{t("lanceHeight")} (m)</span><input type="number" min="0" step="0.1" value={form.lanceHeightM} onChange={(event) => set("lanceHeightM", event.target.value)} /></label>
            <label><span>{t("oxygenFlow")} (Nm³/min)</span><input type="number" min="0" value={form.oxygenFlowNm3PerMinute} onChange={(event) => set("oxygenFlowNm3PerMinute", event.target.value)} /></label>
            <label><span>{locale === "ko" ? "예상 잔여시간" : "Estimated remaining time"} (min)</span><input type="number" min="0" value={form.remainingMinutes} onChange={(event) => set("remainingMinutes", event.target.value)} /></label>
          </>}
          {action === "reblow" && <><label><span>{locale === "ko" ? "추가 산소" : "Additional oxygen"} (Nm³)</span><input type="number" min="0" value={form.additionalOxygenNm3} onChange={(event) => set("additionalOxygenNm3", event.target.value)} required /></label><label><span>{t("duration")} (min)</span><input type="number" min="0" value={form.durationMinutes} onChange={(event) => set("durationMinutes", event.target.value)} /></label></>}
          {action === "tap" && <div className="tap-confirm full"><strong>{t("completeTap")}</strong><p>{t("validationWarning")}</p></div>}
        </div>
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>{t("cancel")}</button><button type="submit" className="primary">{t("save")}</button></div>
      </form>
    </div>
  );
}
