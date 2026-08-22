import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDemoState, createEmptyState } from "../data/demoState.js";
import { normalizeCoachState } from "../data/stateMigration.js";
import { advanceHeat, applyHeatEvent, archiveHeat, canDeleteHeat, cancelHeat, createHeatFromForm } from "../domain/heatOperations.js";
import { clearRecoveryState, clearState, loadRecoveryState, loadState, saveRecoveryState, saveState } from "../storage/indexedDb.js";

function withLog(state, type, payload = {}) {
  const at = new Date().toISOString();
  return {
    ...state,
    operationLog: [...(state.operationLog ?? []), { id: `LOG-${crypto.randomUUID()}`, type, at, ...payload }],
  };
}

export function useCoachState() {
  const [state, setState] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [saveStatus, setSaveStatus] = useState("loading");
  const loaded = useRef(false);

  useEffect(() => {
    Promise.all([loadState(), loadRecoveryState()])
      .then(([saved, savedRecovery]) => {
        setState(normalizeCoachState(saved ?? createEmptyState()));
        setRecovery(savedRecovery);
      })
      .catch(() => setState(createEmptyState()))
      .finally(() => {
        loaded.current = true;
        setSaveStatus("saved");
      });
  }, []);

  useEffect(() => {
    if (!state || !loaded.current) return undefined;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      const saved = { ...state, lastSavedAt: new Date().toISOString() };
      try {
        await saveState(saved);
        setSaveStatus("saved");
      } catch {
        setSaveStatus("error");
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [state]);

  const currentHeat = useMemo(() => state?.heats.find((heat) => heat.id === state.currentHeatId) ?? state?.heats[0] ?? null, [state]);

  const selectHeat = useCallback((heatId) => setState((previous) => ({ ...previous, currentHeatId: heatId })), []);

  const addEvent = useCallback((type, form) => {
    setState((previous) => {
      const heats = previous.heats.map((heat) => heat.id === previous.currentHeatId ? applyHeatEvent(heat, type, form, previous.operatorProfile) : heat);
      return withLog({ ...previous, heats }, `event_${type}`, { heatId: previous.currentHeatId, operator: previous.operatorProfile?.displayName ?? "" });
    });
  }, []);

  const advanceCurrentStage = useCallback((form) => {
    setState((previous) => {
      const heats = previous.heats.map((heat) => heat.id === previous.currentHeatId ? advanceHeat(heat, form, previous.operatorProfile) : heat);
      return withLog({ ...previous, heats }, "stage_advanced", { heatId: previous.currentHeatId, to: heats.find((heat) => heat.id === previous.currentHeatId)?.stage });
    });
  }, []);

  const updateSettings = useCallback((settings) => setState((previous) => withLog({ ...previous, settings }, "settings_updated", {
    settingsVersion: settings.version,
    coefficientProfiles: structuredClone(settings.coefficientProfiles),
  })), []);
  const recordOperation = useCallback((type, payload = {}) => setState((previous) => withLog(previous, type, payload)), []);

  const createHeat = useCallback((form) => {
    setState((previous) => {
      const heat = createHeatFromForm(form, previous.operatorProfile);
      return withLog({ ...previous, heats: [...previous.heats, heat], currentHeatId: heat.id }, "heat_created", { heatId: heat.id });
    });
  }, []);

  const replaceState = useCallback((nextState) => setState(withLog(normalizeCoachState(nextState), "backup_restored")), []);

  const resetWorkspace = useCallback(async (mode = "empty") => {
    if (state) {
      await saveRecoveryState(state);
      setRecovery({ state, savedAt: new Date().toISOString() });
    }
    await clearState();
    const profile = state?.operatorProfile ?? { displayName: "" };
    setState(mode === "demo" ? createDemoState(profile) : createEmptyState({ operatorProfile: profile, onboardingCompleted: true }));
  }, [state]);

  const restoreRecovery = useCallback(async () => {
    if (!recovery?.state) return;
    setState(withLog(normalizeCoachState(recovery.state), "recovery_restored"));
    await clearRecoveryState();
    setRecovery(null);
  }, [recovery]);

  const completeOnboarding = useCallback(({ displayName, mode }) => {
    const operatorProfile = { displayName: displayName.trim() };
    setState((previous) => mode === "demo" ? createDemoState(operatorProfile) : createEmptyState({ locale: previous?.locale ?? "ko", operatorProfile, onboardingCompleted: true }));
  }, []);

  const updateOperator = useCallback((displayName) => setState((previous) => withLog({ ...previous, operatorProfile: { displayName: displayName.trim() }, onboardingCompleted: true }, "operator_updated")), []);

  const deleteHeat = useCallback((heatId) => setState((previous) => {
    const target = previous.heats.find((heat) => heat.id === heatId);
    if (!target || !canDeleteHeat(target)) return previous;
    const heats = previous.heats.filter((heat) => heat.id !== heatId);
    const currentHeatId = previous.currentHeatId === heatId ? heats[0]?.id ?? null : previous.currentHeatId;
    return withLog({ ...previous, heats, currentHeatId }, "heat_deleted", { heatId });
  }), []);

  const changeHeatLifecycle = useCallback((heatId, action, reason = "") => setState((previous) => {
    const heats = previous.heats.map((heat) => {
      if (heat.id !== heatId) return heat;
      return action === "cancel" ? cancelHeat(heat, reason, previous.operatorProfile) : archiveHeat(heat, previous.operatorProfile);
    });
    return withLog({ ...previous, heats }, action === "cancel" ? "heat_cancelled" : "heat_archived", { heatId, reason });
  }), []);

  const setLocale = useCallback((locale) => setState((previous) => ({ ...previous, locale })), []);

  return { state, currentHeat, recovery, saveStatus, selectHeat, addEvent, advanceCurrentStage, createHeat, updateSettings, recordOperation, replaceState, resetWorkspace, restoreRecovery, completeOnboarding, updateOperator, deleteHeat, changeHeatLifecycle, setLocale };
}
