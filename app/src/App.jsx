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
import { OperationNotice } from "./components/OperationNotice.jsx";
import { CorrectionModal } from "./components/CorrectionModal.jsx";
import { HeatDetailScreen } from "./screens/HeatDetailScreen.jsx";
import { useCoachState } from "./hooks/useCoachState.js";
import { useLiveClock } from "./hooks/useLiveClock.js";
import { useOperationNotice } from "./hooks/useOperationNotice.js";
import { translate } from "./i18n/translations.js";
import { calculateEndpoint, qualityRows } from "./calculation/endpoint.js";
import { getOpenChecks } from "./domain/operationalGuidance.js";
import { isActiveHeat } from "./domain/processStages.js";
import { timelineRecords } from "./domain/correctionOperations.js";

const eventNames = {
  material: ["자재 투입", "Material entry"],
  sample: ["샘플 채취", "Sample collection"],
  analysis: ["분석 결과", "Analysis result"],
  checkpoint: ["체크포인트", "Checkpoint"],
  reblow: ["재취련", "Reblow"],
  tap: ["출강", "Tap"],
};

function SimpleScreen({ screen, locale, t, state, onSelect }) {
  const configuration = {
    today: [ClockCountdown, t("today"), locale === "ko" ? "진행 중 차지와 완료 결과 요약" : "Active heat and completed result summary"],
    alerts: [Bell, t("alerts"), locale === "ko" ? "확인 필요·목표 이탈·계산 불가 항목" : "Open checks, target deviations, and unavailable calculations"],
  };
  const [Icon, title, description] = configuration[screen] ?? [ChartBar, t("reports"), ""];
  const active = state.heats.filter(isActiveHeat);
  const sameLocalDay = (value, reference = new Date()) => {
    if (!value) return false;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) && date.getFullYear() === reference.getFullYear() && date.getMonth() === reference.getMonth() && date.getDate() === reference.getDate();
  };
  const closedToday = state.heats.filter((heat) => !isActiveHeat(heat) && sameLocalDay(heat.completedAt ?? heat.cancelledAt ?? heat.archivedAt));
  const checks = active.flatMap((heat) => {
    const calculation = calculateEndpoint(heat, state.settings);
    return getOpenChecks(heat, qualityRows(heat, state.settings, calculation), locale).map((check) => ({ ...check, heatId: heat.id }));
  });
  return (
    <main className="workspace-screen simple-screen">
      <div className="workspace-heading"><div><span>BOF Endpoint Coach</span><h1>{title}</h1><p>{description}</p></div></div>
      <div className="simple-grid">
        <section className="panel simple-hero"><Icon /><strong>{active.length}</strong><span>{t("activeHeats")}</span></section>
        {screen === "today" && <section className="panel simple-hero"><ClockCountdown /><strong>{closedToday.length}</strong><span>{locale === "ko" ? "오늘 종료 차지" : "Closed today"}</span></section>}
        <section className="panel"><h2>{screen === "today" ? (locale === "ko" ? "현재 진행·오늘 종료" : "Active and closed today") : (locale === "ko" ? "현재 확인 필요" : "Current open checks")}</h2><ul>{screen === "today" ? [...active, ...closedToday].map((heat) => <li key={heat.id}><button type="button" onClick={() => onSelect(heat.id)}>{heat.id}</button> · {heat.stage} · {locale === "ko" ? heat.stageLabelKo : heat.stageLabelEn}</li>) : checks.map((check, index) => <li key={`${check.heatId}-${index}`}><button type="button" onClick={() => onSelect(check.heatId)}>{check.heatId}</button> · {check.text}</li>)}{(screen === "today" ? [...active, ...closedToday] : checks).length === 0 && <li>{locale === "ko" ? "표시할 항목이 없습니다." : "Nothing to show."}</li>}</ul></section>
      </div>
    </main>
  );
}

export function App() {
  const { state, currentHeat, recovery, saveStatus, selectHeat, addEvent, advanceCurrentStage, createHeat, updateCurrentHeatInputs, updateSettings, recordOperation, replaceState, resetWorkspace, restoreRecovery, completeOnboarding, updateOperator, deleteHeat, changeHeatLifecycle, correctRecord, invalidateRecord, rollbackStage, correctTap, adoptAnalysis, selectActualEndpoint, setLocale } = useCoachState();
  const [screen, setScreen] = useState("dashboard");
  const [action, setAction] = useState(null);
  const [newHeatOpen, setNewHeatOpen] = useState(false);
  const [initialEditOpen, setInitialEditOpen] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [stageOpen, setStageOpen] = useState(false);
  const [lifecycle, setLifecycle] = useState(null);
  const [correction, setCorrection] = useState(null);
  const now = useLiveClock();
  const { notice, showNotice, clearNotice } = useOperationNotice();
  const locale = state?.locale ?? "ko";
  const t = useMemo(() => (key) => translate(locale, key), [locale]);

  if (!state) return <div className="loading-screen">{t("loading")}</div>;

  function navigateToHeat(heatId) {
    selectHeat(heatId);
    setScreen("dashboard");
  }

  function openHeatDetails(heatId) {
    selectHeat(heatId);
    setScreen("heatDetail");
  }

  function openCorrection(request) {
    if (!currentHeat) return;
    const target = request.target ?? timelineRecords(currentHeat).find((record) => record.kind === request.targetKind && record.id === request.targetId);
    if (target) setCorrection({ ...request, target });
  }

  function confirmLifecycle(reason) {
    if (lifecycle.action === "delete") deleteHeat(lifecycle.heat.id);
    else changeHeatLifecycle(lifecycle.heat.id, lifecycle.action, reason);
    setLifecycle(null);
  }

  function saveEvent(type, form) {
    addEvent(type, form);
    const name = eventNames[type] ?? [type, type];
    showNotice(locale === "ko" ? `${name[0]} 기록을 저장했습니다. 화면의 다음 행동을 확인하십시오.` : `${name[1]} saved. Check the next action on screen.`);
  }

  function saveStageTransition(form) {
    const from = currentHeat?.stage;
    advanceCurrentStage(form);
    showNotice(locale === "ko" ? `${from} 단계 기록을 저장하고 다음 단계로 이동했습니다.` : `${from} was saved and the heat advanced to the next stage.`);
  }

  function saveInitialInputs(form) {
    updateCurrentHeatInputs(form);
    showNotice(locale === "ko" ? "기초 입력값을 저장하고 종점 참고예상을 다시 계산했습니다." : "Initial inputs saved and the endpoint estimate was recalculated.");
  }

  function confirmCorrection({ changes, reason }) {
    if (!currentHeat || !correction) return;
    if (correction.mode === "correct") correctRecord(currentHeat.id, correction.target.kind, correction.target.id, changes, reason);
    if (correction.mode === "void") invalidateRecord(currentHeat.id, correction.target.kind, correction.target.id, reason);
    if (correction.mode === "rollback") rollbackStage(currentHeat.id, reason);
    if (correction.mode === "tap") correctTap(currentHeat.id, changes.occurredAt, reason);
    if (correction.mode === "adopt") adoptAnalysis(currentHeat.id, correction.target.id, reason);
    if (correction.mode === "actual") selectActualEndpoint(currentHeat.id, correction.target.id, reason);
    showNotice(locale === "ko" ? "정정 내용을 저장하고 영향받는 예상값과 이력을 다시 계산했습니다." : "The correction was saved and affected predictions and history were recalculated.");
    setCorrection(null);
  }

  return (
    <div className="app-shell" lang={locale}>
      <Header t={t} locale={locale} screen={screen} setScreen={setScreen} setLocale={setLocale} now={now} operatorName={state.operatorProfile?.displayName} onEditOperator={() => setOperatorOpen(true)} />
      {screen === "dashboard" && (currentHeat ? <Dashboard state={state} heat={currentHeat} locale={locale} t={t} selectHeat={selectHeat} saveStatus={saveStatus} onAction={setAction} onAdvance={() => setStageOpen(true)} onEditInitial={() => setInitialEditOpen(true)} onNewHeat={() => setNewHeatOpen(true)} onOpenTimeline={() => setScreen("heatDetail")} onOpenCorrection={openCorrection} onRollback={() => openCorrection({ mode: "rollback", target: timelineRecords(currentHeat).find((record) => record.kind === "stage" && record.status === "active" && record.stage === currentHeat.stage) })} /> : <EmptyDashboard locale={locale} onNewHeat={() => setNewHeatOpen(true)} onLoadDemo={() => resetWorkspace("demo")} />)}
      {screen === "history" && <HistoryScreen state={state} locale={locale} t={t} onSelect={openHeatDetails} onLifecycle={(heat, lifecycleAction) => setLifecycle({ heat, action: lifecycleAction })} />}
      {screen === "heatDetail" && currentHeat && <HeatDetailScreen heat={currentHeat} locale={locale} onBack={() => setScreen("history")} onDashboard={() => setScreen("dashboard")} onCorrection={openCorrection} onAdopt={(analysisId) => openCorrection({ mode: "adopt", targetKind: "analysis", targetId: analysisId })} onActual={(analysisId) => openCorrection({ mode: "actual", targetKind: "analysis", targetId: analysisId })} />}
      {screen === "settings" && <SettingsScreen settings={state.settings} heats={state.heats} locale={locale} t={t} onSave={updateSettings} />}
      {screen === "reports" && <ReportsScreen state={state} recovery={recovery} locale={locale} t={t} onRestore={replaceState} onOperation={recordOperation} onReset={resetWorkspace} onRestoreRecovery={restoreRecovery} />}
      {(screen === "today" || screen === "alerts") && <SimpleScreen screen={screen} locale={locale} t={t} state={state} onSelect={navigateToHeat} />}
      {action && currentHeat && <EventModal action={action} heat={currentHeat} settings={state.settings} locale={locale} t={t} onClose={() => setAction(null)} onSave={saveEvent} />}
      {newHeatOpen && <HeatModal settings={state.settings} existingHeatIds={state.heats.map((heat) => heat.id)} locale={locale} t={t} onClose={() => setNewHeatOpen(false)} onSave={(form) => { createHeat(form); showNotice(locale === "ko" ? `${form.id} 차지를 G0 장입 단계로 시작했습니다.` : `${form.id} started at G0 Charge.`); }} />}
      {initialEditOpen && currentHeat && <HeatModal heat={currentHeat} settings={state.settings} existingHeatIds={state.heats.map((heat) => heat.id)} locale={locale} t={t} onClose={() => setInitialEditOpen(false)} onSave={saveInitialInputs} />}
      {stageOpen && currentHeat && <StageTransitionModal heat={currentHeat} locale={locale} onClose={() => setStageOpen(false)} onSave={saveStageTransition} />}
      {operatorOpen && <OperatorModal initialName={state.operatorProfile?.displayName} locale={locale} onClose={() => setOperatorOpen(false)} onSave={({ displayName }) => { updateOperator(displayName); setOperatorOpen(false); }} />}
      {!state.onboardingCompleted && <OperatorModal locale={locale} firstRun onSave={completeOnboarding} />}
      {lifecycle && <HeatLifecycleModal heat={lifecycle.heat} action={lifecycle.action} locale={locale} onClose={() => setLifecycle(null)} onConfirm={confirmLifecycle} />}
      {correction && currentHeat && <CorrectionModal heat={currentHeat} target={correction.target} mode={correction.mode} locale={locale} onClose={() => setCorrection(null)} onConfirm={confirmCorrection} />}
      <OperationNotice notice={notice} onClose={clearNotice} locale={locale} />
    </div>
  );
}
