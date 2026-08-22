import { useMemo, useState } from "react";
import { Bell, ChartBar, ClockCountdown } from "@phosphor-icons/react";
import { Header } from "./components/Header.jsx";
import { EventModal } from "./components/EventModal.jsx";
import { HeatModal } from "./components/HeatModal.jsx";
import { Dashboard } from "./screens/Dashboard.jsx";
import { SettingsScreen } from "./screens/SettingsScreen.jsx";
import { ReportsScreen } from "./screens/ReportsScreen.jsx";
import { HistoryScreen } from "./screens/HistoryScreen.jsx";
import { useCoachState } from "./hooks/useCoachState.js";
import { useLiveClock } from "./hooks/useLiveClock.js";
import { translate } from "./i18n/translations.js";

function SimpleScreen({ screen, locale, t, state }) {
  const configuration = {
    today: [ClockCountdown, t("today"), locale === "ko" ? "진행 중 차지와 완료 결과 요약" : "Active heat and completed result summary"],
    alerts: [Bell, t("alerts"), locale === "ko" ? "확인 필요·목표 이탈·계산 불가 항목" : "Open checks, target deviations, and unavailable calculations"],
  };
  const [Icon, title, description] = configuration[screen] ?? [ChartBar, t("reports"), ""];
  return (
    <main className="workspace-screen simple-screen">
      <div className="workspace-heading"><div><span>BOF Endpoint Coach</span><h1>{title}</h1><p>{description}</p></div></div>
      <div className="simple-grid">
        <section className="panel simple-hero"><Icon /><strong>{state.heats.filter((heat) => heat.status === "in_progress").length}</strong><span>{t("activeHeats")}</span></section>
        <section className="panel"><h2>{locale === "ko" ? "현재 확인 필요" : "Current open checks"}</h2><ul><li>{locale === "ko" ? "최종 샘플 채취 확인" : "Confirm final sample"}</li><li>{locale === "ko" ? "온도 하한 접근" : "Temperature near lower limit"}</li><li>{t("demoBanner")}</li></ul></section>
      </div>
    </main>
  );
}

export function App() {
  const { state, currentHeat, saveStatus, selectHeat, addEvent, createHeat, updateSettings, recordOperation, replaceState, resetDemo, setLocale } = useCoachState();
  const [screen, setScreen] = useState("dashboard");
  const [action, setAction] = useState(null);
  const [newHeatOpen, setNewHeatOpen] = useState(false);
  const now = useLiveClock();
  const locale = state?.locale ?? "ko";
  const t = useMemo(() => (key) => translate(locale, key), [locale]);

  if (!state || !currentHeat) return <div className="loading-screen">{t("loading")}</div>;

  function navigateToHeat(heatId) {
    selectHeat(heatId);
    setScreen("dashboard");
  }

  return (
    <div className="app-shell" lang={locale}>
      <Header t={t} locale={locale} screen={screen} setScreen={setScreen} setLocale={setLocale} now={now} />
      {screen === "dashboard" && <Dashboard state={state} heat={currentHeat} locale={locale} t={t} selectHeat={selectHeat} saveStatus={saveStatus} onAction={setAction} onNewHeat={() => setNewHeatOpen(true)} now={now} />}
      {screen === "history" && <HistoryScreen state={state} locale={locale} t={t} onSelect={navigateToHeat} />}
      {screen === "settings" && <SettingsScreen settings={state.settings} locale={locale} t={t} onSave={updateSettings} />}
      {screen === "reports" && <ReportsScreen state={state} locale={locale} t={t} onRestore={replaceState} onOperation={recordOperation} onReset={resetDemo} />}
      {(screen === "today" || screen === "alerts") && <SimpleScreen screen={screen} locale={locale} t={t} state={state} />}
      {action && <EventModal action={action} heat={currentHeat} settings={state.settings} locale={locale} t={t} onClose={() => setAction(null)} onSave={addEvent} />}
      {newHeatOpen && <HeatModal settings={state.settings} existingHeatIds={state.heats.map((heat) => heat.id)} locale={locale} t={t} onClose={() => setNewHeatOpen(false)} onSave={createHeat} />}
    </div>
  );
}
