import { useMemo, useState } from "react";
import { Bell, ChartBar, ClockCountdown } from "@phosphor-icons/react";
import { Header } from "./components/Header.jsx";
import { EventModal } from "./components/EventModal.jsx";
import { HeatModal } from "./components/HeatModal.jsx";
import { Dashboard } from "./screens/Dashboard.jsx";
import { SettingsScreen } from "./screens/SettingsScreen.jsx";
import { ReportsScreen } from "./screens/ReportsScreen.jsx";
import { HistoryScreen } from "./screens/HistoryScreen.jsx";
import { EmptyDashboard } from "./screens/EmptyDashboard.jsx";
import { OperatorModal } from "./components/OperatorModal.jsx";
import { StageTransitionModal } from "./components/StageTransitionModal.jsx";
import { HeatLifecycleModal } from "./components/HeatLifecycleModal.jsx";
import { useCoachState } from "./hooks/useCoachState.js";
import { useLiveClock } from "./hooks/useLiveClock.js";
import { translate } from "./i18n/translations.js";
import { calculateEndpoint, qualityRows } from "./calculation/endpoint.js";
import { getOpenChecks } from "./domain/operationalGuidance.js";
import { isActiveHeat } from "./domain/processStages.js";

function SimpleScreen({ screen, locale, t, state, onSelect }) {
  const configuration = {
    today: [ClockCountdown, t("today"), locale === "ko" ? "진행 중 차지와 완료 결과 요약" : "Active heat and completed result summary"],
    alerts: [Bell, t("alerts"), locale === "ko" ? "확인 필요·목표 이탈·계산 불가 항목" : "Open checks, target deviations, and unavailable calculations"],
  };
  const [Icon, title, description] = configuration[screen] ?? [ChartBar, t("reports"), ""];
  const active = state.heats.filter(isActiveHeat);
  const checks = active.flatMap((heat) => {
    const calculation = calculateEndpoint(heat, state.settings);
    return getOpenChecks(heat, qualityRows(heat, state.settings, calculation), locale).map((check) => ({ ...check, heatId: heat.id }));
  });
  return (
    <main className="workspace-screen simple-screen">
      <div className="workspace-heading"><div><span>BOF Endpoint Coach</span><h1>{title}</h1><p>{description}</p></div></div>
      <div className="simple-grid">
        <section className="panel simple-hero"><Icon /><strong>{active.length}</strong><span>{t("activeHeats")}</span></section>
        <section className="panel"><h2>{screen === "today" ? (locale === "ko" ? "진행 차지" : "Active heats") : (locale === "ko" ? "현재 확인 필요" : "Current open checks")}</h2><ul>{screen === "today" ? active.map((heat) => <li key={heat.id}><button type="button" onClick={() => onSelect(heat.id)}>{heat.id}</button> · {heat.stage} · {locale === "ko" ? heat.stageLabelKo : heat.stageLabelEn}</li>) : checks.map((check, index) => <li key={`${check.heatId}-${index}`}><button type="button" onClick={() => onSelect(check.heatId)}>{check.heatId}</button> · {check.text}</li>)}{(screen === "today" ? active : checks).length === 0 && <li>{locale === "ko" ? "표시할 항목이 없습니다." : "Nothing to show."}</li>}</ul></section>
      </div>
    </main>
  );
}

export function App() {
  const { state, currentHeat, recovery, saveStatus, selectHeat, addEvent, advanceCurrentStage, createHeat, updateSettings, recordOperation, replaceState, resetWorkspace, restoreRecovery, completeOnboarding, updateOperator, deleteHeat, changeHeatLifecycle, setLocale } = useCoachState();
  const [screen, setScreen] = useState("dashboard");
  const [action, setAction] = useState(null);
  const [newHeatOpen, setNewHeatOpen] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [lifecycle, setLifecycle] = useState(null);
  const now = useLiveClock();
  const locale = state?.locale ?? "ko";
  const t = useMemo(() => (key) => translate(locale, key), [locale]);

  if (!state) return <div className="loading-screen">{t("loading")}</div>;

  function navigateToHeat(heatId) {
    selectHeat(heatId);
    setScreen("dashboard");
  }

  function confirmLifecycle(reason) {
    if (lifecycle.action === "delete") deleteHeat(lifecycle.heat.id);
    else changeHeatLifecycle(lifecycle.heat.id, lifecycle.action, reason);
    setLifecycle(null);
  }

  return (
    <div className="app-shell" lang={locale}>
      <Header t={t} locale={locale} screen={screen} setScreen={setScreen} setLocale={setLocale} now={now} operatorName={state.operatorProfile?.displayName} onEditOperator={() => setOperatorOpen(true)} />
      {screen === "dashboard" && (currentHeat ? <Dashboard state={state} heat={currentHeat} locale={locale} t={t} selectHeat={selectHeat} saveStatus={saveStatus} onAction={setAction} onAdvance={() => setStageOpen(true)} onNewHeat={() => setNewHeatOpen(true)} now={now} /> : <EmptyDashboard locale={locale} onNewHeat={() => setNewHeatOpen(true)} onLoadDemo={() => resetWorkspace("demo")} />)}
      {screen === "history" && <HistoryScreen state={state} locale={locale} t={t} onSelect={navigateToHeat} onLifecycle={(heat, lifecycleAction) => setLifecycle({ heat, action: lifecycleAction })} />}
      {screen === "settings" && <SettingsScreen settings={state.settings} heats={state.heats} locale={locale} t={t} onSave={updateSettings} />}
      {screen === "reports" && <ReportsScreen state={state} recovery={recovery} locale={locale} t={t} onRestore={replaceState} onOperation={recordOperation} onReset={resetWorkspace} onRestoreRecovery={restoreRecovery} />}
      {(screen === "today" || screen === "alerts") && <SimpleScreen screen={screen} locale={locale} t={t} state={state} onSelect={navigateToHeat} />}
      {action && currentHeat && <EventModal action={action} heat={currentHeat} settings={state.settings} locale={locale} t={t} onClose={() => setAction(null)} onSave={addEvent} />}
      {newHeatOpen && <HeatModal settings={state.settings} existingHeatIds={state.heats.map((heat) => heat.id)} locale={locale} t={t} onClose={() => setNewHeatOpen(false)} onSave={createHeat} />}
      {stageOpen && currentHeat && <StageTransitionModal heat={currentHeat} locale={locale} onClose={() => setStageOpen(false)} onSave={advanceCurrentStage} />}
      {operatorOpen && <OperatorModal initialName={state.operatorProfile?.displayName} locale={locale} onClose={() => setOperatorOpen(false)} onSave={({ displayName }) => { updateOperator(displayName); setOperatorOpen(false); }} />}
      {!state.onboardingCompleted && <OperatorModal locale={locale} firstRun onSave={completeOnboarding} />}
      {lifecycle && <HeatLifecycleModal heat={lifecycle.heat} action={lifecycle.action} locale={locale} onClose={() => setLifecycle(null)} onConfirm={confirmLifecycle} />}
    </div>
  );
}
