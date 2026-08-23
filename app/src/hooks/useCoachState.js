import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDemoState, createEmptyState } from "../data/demoState.js";
import { normalizeCoachState } from "../data/stateMigration.js";
import { advanceHeat, applyHeatEvent, archiveHeat, canDeleteHeat, cancelHeat, createHeatFromForm, updateHeatInputs } from "../domain/heatOperations.js";
import { adoptAnalysisRecord, correctAnalysisRecord, correctEventRecord, correctTapRecord, invalidateAnalysisRecord, invalidateEventRecord, rollbackLastStage, setActualEndpointAnalysis } from "../domain/correctionOperations.js";
import { capturePredictionSnapshot } from "../domain/predictionHistory.js";
import { clearRecoveryState, loadRecoveryState, loadState, saveRecoveryState, saveState, StorageConflictError } from "../storage/indexedDb.js";
import { createWorkspaceSync } from "../storage/workspaceSync.js";
import { prepareSettingsRevision } from "../domain/settingsRevision.js";

function withLog(state, type, payload = {}) {
  const at = new Date().toISOString();
  return {
    ...state,
    operationLog: [...(state.operationLog ?? []), { id: `LOG-${crypto.randomUUID()}`, type, at, ...payload }],
  };
}

function withPrediction(heat, settings, trigger) {
  return capturePredictionSnapshot(heat, settings, trigger);
}

export function useCoachState() {
  const [state, setState] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [saveStatus, setSaveStatus] = useState("loading");
  const [loadError, setLoadError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);
  const loaded = useRef(false);
  const skipNextSave = useRef(false);
  const persistedRevision = useRef(0);
  const persistenceBlocked = useRef(false);
  const instanceId = useRef(crypto.randomUUID());
  const sync = useRef(null);

  useEffect(() => {
    let active = true;
    loaded.current = false;
    persistenceBlocked.current = false;
    Promise.all([loadState(), loadRecoveryState()])
      .then(([saved, savedRecovery]) => {
        if (!active) return;
        const normalized = normalizeCoachState(saved ?? createEmptyState());
        persistedRevision.current = Number(saved?.storageRevision ?? 0);
        skipNextSave.current = true;
        loaded.current = true;
        setState(normalized);
        setRecovery(savedRecovery);
        setSaveStatus("saved");
      })
      .catch((error) => {
        if (!active) return;
        persistenceBlocked.current = true;
        setLoadError(error?.message || "storage_load_failed");
        setSaveStatus("load_error");
      });
    return () => { active = false; };
  }, [retryTick]);

  useEffect(() => {
    sync.current = createWorkspaceSync((message) => {
      if (!message || message.sourceId === instanceId.current || message.type !== "workspace_saved") return;
      if (Number(message.revision) <= persistedRevision.current) return;
      persistenceBlocked.current = true;
      setSaveStatus((current) => current === "saving" ? "conflict" : "stale");
    });
    return () => sync.current?.close();
  }, []);

  useEffect(() => {
    function protectUnsavedWork(event) {
      if (!["saving", "error", "conflict", "stale"].includes(saveStatus)) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", protectUnsavedWork);
    return () => window.removeEventListener("beforeunload", protectUnsavedWork);
  }, [saveStatus]);

  useEffect(() => {
    if (!state || !loaded.current) return undefined;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return undefined;
    }
    if (persistenceBlocked.current) return undefined;
    setSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const saved = await saveState(state, persistedRevision.current);
        persistedRevision.current = saved.storageRevision;
        setSaveStatus("saved");
        sync.current?.publish({ type: "workspace_saved", revision: saved.storageRevision, sourceId: instanceId.current });
      } catch (error) {
        persistenceBlocked.current = true;
        setSaveStatus(error instanceof StorageConflictError || error?.code === "storage_revision_conflict" ? "conflict" : "error");
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [state]);

  const currentHeat = useMemo(() => state?.heats.find((heat) => heat.id === state.currentHeatId) ?? state?.heats[0] ?? null, [state]);

  const selectHeat = useCallback((heatId) => setState((previous) => ({ ...previous, currentHeatId: heatId })), []);

  const addEvent = useCallback((type, form) => {
    setState((previous) => {
      const heats = previous.heats.map((heat) => {
        if (heat.id !== previous.currentHeatId) return heat;
        const updated = applyHeatEvent(heat, type, form, previous.operatorProfile);
        const triggerId = updated.events.at(-1)?.id;
        return withPrediction(updated, previous.settings, { type, id: triggerId });
      });
      return withLog({ ...previous, heats }, `event_${type}`, { heatId: previous.currentHeatId, operator: previous.operatorProfile?.displayName ?? "" });
    });
  }, []);

  const advanceCurrentStage = useCallback((form) => {
    setState((previous) => {
      const heats = previous.heats.map((heat) => {
        if (heat.id !== previous.currentHeatId) return heat;
        const updated = advanceHeat(heat, form, previous.operatorProfile);
        return withPrediction(updated, previous.settings, { type: "stage", id: updated.stageHistory.at(-1)?.id });
      });
      return withLog({ ...previous, heats }, "stage_advanced", { heatId: previous.currentHeatId, to: heats.find((heat) => heat.id === previous.currentHeatId)?.stage });
    });
  }, []);

  const updateSettings = useCallback((settings, reason = "") => setState((previous) => {
    const revised = prepareSettingsRevision(previous.settings, settings, previous.operatorProfile, reason);
    if (revised === previous.settings) return previous;
    return withLog({ ...previous, settings: revised }, "settings_updated", {
      settingsVersion: revised.version,
      previousSettingsVersion: previous.settings.version,
      reason: revised.lastRevision?.reason ?? reason,
      changes: structuredClone(revised.lastRevision?.changes ?? []),
      coefficientProfiles: structuredClone(revised.coefficientProfiles),
    });
  }), []);
  const recordOperation = useCallback((type, payload = {}) => setState((previous) => withLog(previous, type, payload)), []);

  const createHeat = useCallback((form) => {
    setState((previous) => {
      const heatId = form.id?.trim();
      if (previous.heats.some((item) => item.id === heatId)) return previous;
      const created = createHeatFromForm(form, previous.operatorProfile, new Date().toISOString(), previous.settings);
      const heat = withPrediction(created, previous.settings, { type: "heat_created", id: created.events[0]?.id });
      return withLog({ ...previous, heats: [...previous.heats, heat], currentHeatId: heat.id }, "heat_created", { heatId: heat.id });
    });
  }, []);

  const updateCurrentHeatInputs = useCallback((form) => {
    setState((previous) => {
      const heats = previous.heats.map((heat) => {
        if (heat.id !== previous.currentHeatId) return heat;
        const updated = updateHeatInputs(heat, form, previous.operatorProfile, new Date().toISOString(), previous.settings);
        return withPrediction(updated, previous.settings, { type: "initial_updated", id: updated.events.at(-1)?.id });
      });
      return withLog({ ...previous, heats }, "initial_inputs_updated", { heatId: previous.currentHeatId, operator: previous.operatorProfile?.displayName ?? "" });
    });
  }, []);

  const replaceState = useCallback((nextState) => setState(withLog(normalizeCoachState(nextState), "backup_restored")), []);

  const resetWorkspace = useCallback(async (mode = "empty") => {
    try {
      if (state) {
        await saveRecoveryState(state);
        setRecovery({ state, savedAt: new Date().toISOString() });
      }
      const profile = state?.operatorProfile ?? { displayName: "" };
      const next = mode === "demo" ? createDemoState(profile) : createEmptyState({ operatorProfile: profile, onboardingCompleted: true });
      const saved = await saveState(next, persistedRevision.current);
      persistedRevision.current = saved.storageRevision;
      persistenceBlocked.current = false;
      skipNextSave.current = true;
      setState(normalizeCoachState(saved));
      setSaveStatus("saved");
      sync.current?.publish({ type: "workspace_saved", revision: saved.storageRevision, sourceId: instanceId.current });
    } catch (error) {
      persistenceBlocked.current = true;
      setSaveStatus(error instanceof StorageConflictError || error?.code === "storage_revision_conflict" ? "conflict" : "error");
    }
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

  const correctRecord = useCallback((heatId, targetKind, targetId, changes, reason) => setState((previous) => {
    const heats = previous.heats.map((heat) => {
      if (heat.id !== heatId) return heat;
      const corrected = targetKind === "analysis"
        ? correctAnalysisRecord(heat, targetId, changes, reason, previous.operatorProfile)
        : correctEventRecord(heat, targetId, changes, reason, previous.operatorProfile);
      return withPrediction(corrected, previous.settings, { type: "correction", id: corrected.correctionLog.at(-1)?.id });
    });
    return withLog({ ...previous, heats }, "record_corrected", { heatId, targetKind, targetId, reason });
  }), []);

  const invalidateRecord = useCallback((heatId, targetKind, targetId, reason) => setState((previous) => {
    const heats = previous.heats.map((heat) => {
      if (heat.id !== heatId) return heat;
      const corrected = targetKind === "analysis"
        ? invalidateAnalysisRecord(heat, targetId, reason, previous.operatorProfile)
        : invalidateEventRecord(heat, targetId, reason, previous.operatorProfile);
      return withPrediction(corrected, previous.settings, { type: "invalidation", id: corrected.correctionLog.at(-1)?.id });
    });
    return withLog({ ...previous, heats }, "record_voided", { heatId, targetKind, targetId, reason });
  }), []);

  const rollbackStage = useCallback((heatId, reason) => setState((previous) => {
    const heats = previous.heats.map((heat) => {
      if (heat.id !== heatId) return heat;
      const corrected = rollbackLastStage(heat, reason, previous.operatorProfile);
      return withPrediction(corrected, previous.settings, { type: "stage_rollback", id: corrected.correctionLog.at(-1)?.id });
    });
    return withLog({ ...previous, heats }, "stage_rolled_back", { heatId, reason });
  }), []);

  const correctTap = useCallback((heatId, occurredAt, reason) => setState((previous) => {
    const heats = previous.heats.map((heat) => {
      if (heat.id !== heatId) return heat;
      const corrected = correctTapRecord(heat, occurredAt, reason, previous.operatorProfile);
      return withPrediction(corrected, previous.settings, { type: "tap_correction", id: corrected.correctionLog.at(-1)?.id });
    });
    return withLog({ ...previous, heats }, "tap_corrected", { heatId, occurredAt, reason });
  }), []);

  const adoptAnalysis = useCallback((heatId, analysisId, reason) => setState((previous) => {
    const heats = previous.heats.map((heat) => {
      if (heat.id !== heatId) return heat;
      const corrected = adoptAnalysisRecord(heat, analysisId, reason, previous.operatorProfile);
      return withPrediction(corrected, previous.settings, { type: "analysis_adopted", id: analysisId });
    });
    return withLog({ ...previous, heats }, "analysis_adopted", { heatId, analysisId, reason });
  }), []);

  const selectActualEndpoint = useCallback((heatId, analysisId, reason) => setState((previous) => {
    const heats = previous.heats.map((heat) => heat.id === heatId ? setActualEndpointAnalysis(heat, analysisId, reason, previous.operatorProfile) : heat);
    return withLog({ ...previous, heats }, "actual_endpoint_selected", { heatId, analysisId, reason });
  }), []);

  const setLocale = useCallback((locale) => setState((previous) => ({ ...previous, locale })), []);

  const retryLoad = useCallback(() => { setLoadError(null); setSaveStatus("loading"); setRetryTick((value) => value + 1); }, []);
  const reloadFromStorage = useCallback(() => { setLoadError(null); setSaveStatus("loading"); setRetryTick((value) => value + 1); }, []);
  const retrySave = useCallback(() => {
    persistenceBlocked.current = false;
    setSaveStatus("saving");
    setState((previous) => previous ? { ...previous } : previous);
  }, []);
  const canWrite = Boolean(state) && !["loading", "load_error", "error", "conflict", "stale"].includes(saveStatus);

  return { state, currentHeat, recovery, saveStatus, loadError, canWrite, retryLoad, reloadFromStorage, retrySave, selectHeat, addEvent, advanceCurrentStage, createHeat, updateCurrentHeatInputs, updateSettings, recordOperation, replaceState, resetWorkspace, restoreRecovery, completeOnboarding, updateOperator, deleteHeat, changeHeatLifecycle, correctRecord, invalidateRecord, rollbackStage, correctTap, adoptAnalysis, selectActualEndpoint, setLocale };
}
