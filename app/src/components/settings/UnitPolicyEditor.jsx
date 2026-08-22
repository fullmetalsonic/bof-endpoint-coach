export function UnitPolicyEditor({ draft, setDraft, t }) {
  const update = (key, value) => setDraft((previous) => ({ ...previous, unitPolicy: { ...previous.unitPolicy, [key]: value } }));
  return <>
    <h2>{t("units")}</h2>
    <div className="settings-form-grid">
      <label><span>{t("massUnit")}</span><select value={draft.unitPolicy.mass} onChange={(event) => update("mass", event.target.value)}><option>kg</option><option>t</option><option>g</option></select></label>
      <label><span>{t("oxygenUnit")}</span><select value={draft.unitPolicy.oxygen} onChange={(event) => update("oxygen", event.target.value)}><option>Nm³</option></select></label>
      <label><span>{t("temperatureUnit")}</span><select value={draft.unitPolicy.temperature} onChange={(event) => update("temperature", event.target.value)}><option>°C</option></select></label>
      <label><span>{t("chemistryUnit")}</span><select value={draft.unitPolicy.chemistry} onChange={(event) => update("chemistry", event.target.value)}><option>%</option></select></label>
    </div>
    <div className="settings-warning">{t("unitNormalizationNote")}</div>
  </>;
}
