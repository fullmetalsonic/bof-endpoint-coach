import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BACKUP_SCHEMA_VERSION, createDemoState, createEmptyState } from "../data/demoState.js";
import { normalizeCoachState } from "../data/stateMigration.js";
import { advanceHeat, applyHeatEvent, archiveHeat, canDeleteHeat, cancelHeat, createHeatFromForm, updateHeatInputs } from "../domain/heatOperations.js";
import { adoptAnalysisRecord, correctAnalysisRecord, correctEventRecord, correctTapRecord, invalidateAnalysisRecord, invalidateEventRecord, rollbackLastStage, setActualEndpointAnalysis } from "../domain/correctionOperations.js";
import { capturePredictionSnapshot } from "../domain/predictionHistory.js";
import { clearRecoveryState, loadRecoveryState, loadState, replaceWorkspace, saveState, StorageConflictError } from "../storage/indexedDb.js";
import { createWorkspaceSync } from "../storage/workspaceSync.js";
import { prepareSettingsRevision } from "../domain/settingsRevision.js";
import { buildTrainingRuns } from "../calibration/trainingRun.js";
import { listRecoveryPoints, makeRecoveryPoint, removeRecoveryPoint as removeStoredRecoveryPoint, replaceRecoveryPoints, retainRecoveryPoints, saveRecoveryPoint, setRecoveryPointProtected as protectStoredRecoveryPoint } from "../storage/recoveryStore.js";
import { validatePortableRecoveryPoint } from "../domain/jsonBackupSchema.js";
import { appendAdditionProposal, appendExistingAdditionProposal, createAdditionProposalSnapshot } from "../domain/addition/proposal.js";
import { addOperatorPlan, recordAdditionDecision as applyAdditionDecision, validateOperatorPlanInput } from "../domain/addition/operatorPlan.js";

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

function withDerivedSnapshots(heat, settings, trigger, operatorProfile = null, calculatedAt = new Date().toISOString()) {
  const predicted = capturePredictionSnapshot(heat, settings, trigger, calculatedAt);
  return appendAdditionProposal(predicted, settings, trigger, { calculatedAt, mode: "shadow", operatorProfile });
}

export function useCoachState() {
  const [state, setState] = useState(null);
  const [recovery, setRecovery] = useState(null);
  const [recoveryPoints, setRecoveryPoints] = useState([]);
  const [recoveryError, setRecoveryError] = useState(null);
  const [storageMeta, setStorageMeta] = useState({ revision: 0, lastSavedAt: null });
  const [saveStatus, setSaveStatus] = useState("loading");
  const [loadError, setLoadError] = useState(null);
  const [retryTick, setRetryTick] = useState(0);
  const loaded = useRef(false);
  const skipNextSave = useRef(false);
  const persistedRevision = useRef(0);
  const persistenceBlocked = useRef(false);
  const instanceId = useRef(crypto.randomUUID());
  const sync = useRef(null);
  const stateRef = useRef(null);
  const saveQueue = useRef(Promise.resolve());
  const saveSequence = useRef(0);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    let active = true;
    loaded.current = false;
    persistenceBlocked.current = false;
    Promise.all([loadState(), loadRecoveryState(), listRecoveryPoints()])
      .then(async ([saved, savedRecovery, savedPoints]) => {
        if (!active) return;
        const sourceSchema = saved?.schemaVersion ?? BACKUP_SCHEMA_VERSION;
        let normalized = normalizeCoachState(saved ?? createEmptyState());
        let points = savedPoints;
        if (savedRecovery?.state && !points.some((point) => point.reason === "legacy_recovery_slot")) {
          points = retainRecoveryPoints([makeRecoveryPoint(savedRecovery.state, {
            reason: "legacy_recovery_slot",
            labelKo: "v0.5 직전 상태 복구점",
            labelEn: "v0.5 previous-workspace recovery",
            createdAt: savedRecovery.savedAt,
            protectedPoint: true,
          }), ...points]);
        }
        if (saved && sourceSchema !== BACKUP_SCHEMA_VERSION) {
          points = retainRecoveryPoints([makeRecoveryPoint(saved, {
            reason: "version_migration",
            labelKo: `${sourceSchema} 마이그레이션 전 원본`,
            labelEn: `Original before ${sourceSchema} migration`,
            protectedPoint: true,
          }), ...points]);
          normalized = withLog(normalized, "workspace_migrated", { fromSchema: sourceSchema, toSchema: BACKUP_SCHEMA_VERSION });
        }
        if (points.length !== savedPoints.length || savedRecovery?.state) {
          await replaceRecoveryPoints(points);
          await clearRecoveryState();
        }
        if (!active) return;
        persistedRevision.current = Number(saved?.storageRevision ?? 0);
        skipNextSave.current = sourceSchema === BACKUP_SCHEMA_VERSION;
        loaded.current = true;
        setState(normalized);
        setRecovery(null);
        setRecoveryPoints(points);
        setStorageMeta({ revision: Number(saved?.storageRevision ?? 0), lastSavedAt: saved?.lastSavedAt ?? null });
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
      const sequence = ++saveSequence.current;
      const queued = saveQueue.current
        .catch(() => null)
        .then(() => {
          if (persistenceBlocked.current) return null;
          return saveState(state, persistedRevision.current);
        });
      saveQueue.current = queued.catch(() => null);
      try {
        const saved = await queued;
        if (!saved) return;
        persistedRevision.current = saved.storageRevision;
        if (sequence === saveSequence.current) {
          setStorageMeta({ revision: saved.storageRevision, lastSavedAt: saved.lastSavedAt });
          setSaveStatus("saved");
        }
        sync.current?.publish({ type: "workspace_saved", revision: saved.storageRevision, sourceId: instanceId.current });
      } catch (error) {
        persistenceBlocked.current = true;
        setSaveStatus(error instanceof StorageConflictError || error?.code === "storage_revision_conflict" ? "conflict" : "error");
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [state]);

  const waitForPendingSave = useCallback(async () => {
    await saveQueue.current;
    if (persistenceBlocked.current) throw new Error("storage_not_writable");
  }, []);

  const trainingHeats = state?.heats;
  const trainingSettings = state?.settings;
  const trainingOperator = state?.operatorProfile;
  const storedTrainingRuns = state?.trainingRuns;
  const trainingSource = useMemo(() => trainingHeats ? {
    heats: trainingHeats,
    settings: trainingSettings,
    operatorProfile: trainingOperator,
    trainingRuns: storedTrainingRuns,
  } : null, [trainingHeats, trainingSettings, trainingOperator, storedTrainingRuns]);

  useEffect(() => {
    if (!trainingSource || !loaded.current) return undefined;
    let active = true;
    buildTrainingRuns(trainingSource, trainingSource.trainingRuns ?? [])
      .then((runs) => {
        if (!active) return;
        const priorSignature = JSON.stringify((trainingSource.trainingRuns ?? []).map((run) => [run.id, run.status, run.datasetSha256, run.staleAt]));
        const nextSignature = JSON.stringify(runs.map((run) => [run.id, run.status, run.datasetSha256, run.staleAt]));
        if (priorSignature !== nextSignature) setState((previous) => previous ? { ...previous, trainingRuns: runs } : previous);
      })
      .catch((error) => setRecoveryError(error?.message ?? "training_run_failed"));
    return () => { active = false; };
  }, [trainingSource]);

  const createRecovery = useCallback(async (options, sourceState = stateRef.current) => {
    try {
      const point = makeRecoveryPoint(sourceState, { ...options, sourceRevision: persistedRevision.current });
      const points = await saveRecoveryPoint(point);
      setRecoveryPoints(points);
      setRecoveryError(null);
      return point;
    } catch (error) {
      setRecoveryError(error?.message ?? "recovery_point_save_failed");
      throw error;
    }
  }, []);

  const mutateWithRecovery = useCallback(async (options, updater) => {
    const snapshot = stateRef.current;
    if (!snapshot) return false;
    try {
      await createRecovery(options, snapshot);
      setState((previous) => updater(previous));
      return true;
    } catch {
      return false;
    }
  }, [createRecovery]);

  const currentHeat = useMemo(() => state?.heats.find((heat) => heat.id === state.currentHeatId) ?? state?.heats[0] ?? null, [state]);

  const selectHeat = useCallback((heatId) => setState((previous) => ({ ...previous, currentHeatId: heatId })), []);

  const addEvent = useCallback((type, form) => {
    const updater = (previous) => {
      const heats = previous.heats.map((heat) => {
        if (heat.id !== previous.currentHeatId) return heat;
        const beforeProposal = ["material", "reblow"].includes(type) ? createAdditionProposalSnapshot(heat, previous.settings, { type: `before_${type}`, id: null }, { calculatedAt: form.occurredAt, mode: "shadow", operatorProfile: previous.operatorProfile }) : null;
        let updated = applyHeatEvent(heat, type, form, previous.operatorProfile);
        const triggerId = updated.events.at(-1)?.id;
        if (beforeProposal) {
          updated = appendExistingAdditionProposal(updated, beforeProposal, triggerId);
          return withPrediction(updated, previous.settings, { type, id: triggerId });
        }
        return withDerivedSnapshots(updated, previous.settings, { type, id: triggerId }, previous.operatorProfile);
      });
      return withLog({ ...previous, heats }, `event_${type}`, { heatId: previous.currentHeatId, operator: previous.operatorProfile?.displayName ?? "" });
    };
    if (type === "tap") return mutateWithRecovery({ reason: "before_tap", labelKo: `${stateRef.current?.currentHeatId ?? "현재"} 출강 전`, labelEn: "Before tap" }, updater);
    setState(updater);
    return Promise.resolve(true);
  }, [mutateWithRecovery]);

  const advanceCurrentStage = useCallback((form) => mutateWithRecovery({
    reason: "before_stage_transition",
    labelKo: "단계 전환 전",
    labelEn: "Before stage transition",
  }, (previous) => {
      const heats = previous.heats.map((heat) => {
        if (heat.id !== previous.currentHeatId) return heat;
        const updated = advanceHeat(heat, form, previous.operatorProfile);
        return withDerivedSnapshots(updated, previous.settings, { type: "stage", id: updated.stageHistory.at(-1)?.id }, previous.operatorProfile);
      });
      return withLog({ ...previous, heats }, "stage_advanced", { heatId: previous.currentHeatId, to: heats.find((heat) => heat.id === previous.currentHeatId)?.stage });
    }), [mutateWithRecovery]);

  const updateSettings = useCallback((settings, reason = "") => mutateWithRecovery({
    reason: "before_settings_revision",
    labelKo: "설정·계수 변경 전",
    labelEn: "Before settings or coefficient change",
  }, (previous) => {
    const revised = prepareSettingsRevision(previous.settings, settings, previous.operatorProfile, reason);
    if (revised === previous.settings) return previous;
    return withLog({ ...previous, settings: revised }, "settings_updated", {
      settingsVersion: revised.version,
      previousSettingsVersion: previous.settings.version,
      reason: revised.lastRevision?.reason ?? reason,
      changes: structuredClone(revised.lastRevision?.changes ?? []),
      coefficientProfiles: structuredClone(revised.coefficientProfiles),
    });
  }), [mutateWithRecovery]);
  const recordOperation = useCallback((type, payload = {}) => setState((previous) => withLog(previous, type, payload)), []);

  const saveAdditionPlan = useCallback((form) => {
    const snapshot = stateRef.current;
    const targetHeatId = snapshot?.currentHeatId;
    const heat = snapshot?.heats.find((item) => item.id === targetHeatId);
    if (!validateOperatorPlanInput(heat, form).ok) return Promise.resolve(false);
    setState((previous) => {
      let changed = false;
      const heats = previous.heats.map((item) => {
        if (item.id !== targetHeatId) return item;
        if (!validateOperatorPlanInput(item, form).ok) return item;
        changed = true;
        return addOperatorPlan(item, form, previous.operatorProfile);
      });
      if (!changed) return previous;
      return withLog({ ...previous, heats }, "addition_plan_created", { heatId: targetHeatId, operationType: form.operationType, materialCode: form.materialCode ?? null });
    });
    return Promise.resolve(true);
  }, []);

  const refreshAdditionProposal = useCallback((mode = "viewed") => {
    setState((previous) => {
      const heats = previous.heats.map((heat) => {
        if (heat.id !== previous.currentHeatId) return heat;
        const proposal = createAdditionProposalSnapshot(heat, previous.settings, { type: mode, id: null }, { mode, operatorProfile: previous.operatorProfile });
        return appendExistingAdditionProposal(heat, proposal);
      });
      return withLog({ ...previous, heats }, "addition_proposal_refreshed", { heatId: previous.currentHeatId, mode });
    });
    return true;
  }, []);

  const recordAdditionDecision = useCallback((proposalId, decision) => {
    const snapshot = stateRef.current;
    const targetHeatId = snapshot?.currentHeatId;
    const heat = snapshot?.heats.find((item) => item.id === targetHeatId);
    try {
      applyAdditionDecision(heat, proposalId, decision, snapshot?.operatorProfile);
    } catch {
      return false;
    }
    setState((previous) => {
      let changed = false;
      const heats = previous.heats.map((heat) => {
        if (heat.id !== targetHeatId) return heat;
        let updated;
        try {
          updated = applyAdditionDecision(heat, proposalId, decision, previous.operatorProfile);
        } catch {
          return heat;
        }
        if (updated !== heat) changed = true;
        return updated;
      });
      if (!changed) return previous;
      return withLog({ ...previous, heats }, "addition_decision_recorded", { heatId: targetHeatId, proposalId, decision });
    });
    return true;
  }, []);

  const setAdditionCoachHidden = useCallback((hidden) => {
    setState((previous) => {
      const heats = previous.heats.map((heat) => heat.id === previous.currentHeatId ? { ...heat, additionCoach: { hidden: Boolean(hidden), operatorPlans: structuredClone(heat.additionCoach?.operatorPlans ?? []), proposals: structuredClone(heat.additionCoach?.proposals ?? []), decisions: structuredClone(heat.additionCoach?.decisions ?? []) } } : heat);
      return withLog({ ...previous, heats }, hidden ? "addition_coach_hidden" : "addition_coach_shown", { heatId: previous.currentHeatId });
    });
    return true;
  }, []);

  const createHeat = useCallback((form) => {
    setState((previous) => {
      const heatId = form.id?.trim();
      if (previous.heats.some((item) => item.id === heatId)) return previous;
      const created = createHeatFromForm(form, previous.operatorProfile, new Date().toISOString(), previous.settings);
      const heat = withDerivedSnapshots(created, previous.settings, { type: "heat_created", id: created.events[0]?.id }, previous.operatorProfile);
      return withLog({ ...previous, heats: [...previous.heats, heat], currentHeatId: heat.id }, "heat_created", { heatId: heat.id });
    });
  }, []);

  const updateCurrentHeatInputs = useCallback((form) => {
    setState((previous) => {
      const heats = previous.heats.map((heat) => {
        if (heat.id !== previous.currentHeatId) return heat;
        const updated = updateHeatInputs(heat, form, previous.operatorProfile, new Date().toISOString(), previous.settings);
        return withDerivedSnapshots(updated, previous.settings, { type: "initial_updated", id: updated.events.at(-1)?.id }, previous.operatorProfile);
      });
      return withLog({ ...previous, heats }, "initial_inputs_updated", { heatId: previous.currentHeatId, operator: previous.operatorProfile?.displayName ?? "" });
    });
  }, []);

  const replaceState = useCallback((nextState) => mutateWithRecovery({
    reason: "before_legacy_backup_restore",
    labelKo: "호환 ZIP 복원 전",
    labelEn: "Before legacy ZIP restore",
    protectedPoint: true,
  }, () => withLog(normalizeCoachState(nextState), "backup_restored")), [mutateWithRecovery]);

  const resetWorkspace = useCallback(async (mode = "empty") => {
    try {
      const snapshot = stateRef.current;
      const safety = await createRecovery({ reason: "before_workspace_reset", labelKo: "작업공간 초기화 전", labelEn: "Before workspace reset", protectedPoint: true }, snapshot);
      const profile = snapshot?.operatorProfile ?? { displayName: "" };
      const next = mode === "demo" ? createDemoState(profile) : createEmptyState({ operatorProfile: profile, onboardingCompleted: true });
      const logged = withLog(next, "workspace_reset", { mode, recoveryPointId: safety.id });
      const points = await listRecoveryPoints();
      await waitForPendingSave();
      const saved = await replaceWorkspace(logged, points, persistedRevision.current);
      persistedRevision.current = saved.storageRevision;
      persistenceBlocked.current = false;
      skipNextSave.current = true;
      setState(normalizeCoachState(saved));
      setRecoveryPoints(points);
      setStorageMeta({ revision: saved.storageRevision, lastSavedAt: saved.lastSavedAt });
      setSaveStatus("saved");
      sync.current?.publish({ type: "workspace_saved", revision: saved.storageRevision, sourceId: instanceId.current });
      return true;
    } catch (error) {
      persistenceBlocked.current = true;
      setRecoveryError(error?.message ?? "workspace_reset_failed");
      setSaveStatus(error instanceof StorageConflictError || error?.code === "storage_revision_conflict" ? "conflict" : "error");
      return false;
    }
  }, [createRecovery, waitForPendingSave]);

  const restoreRecovery = useCallback(async () => {
    if (!recovery?.state) return;
    const result = await mutateWithRecovery({ reason: "before_legacy_recovery_restore", labelKo: "구형 복구 슬롯 복원 전", labelEn: "Before legacy recovery restore" }, () => withLog(normalizeCoachState(recovery.state), "recovery_restored"));
    if (result) {
      await clearRecoveryState();
      setRecovery(null);
    }
    return result;
  }, [mutateWithRecovery, recovery]);

  const completeOnboarding = useCallback(({ displayName, mode }) => {
    const operatorProfile = { displayName: displayName.trim() };
    setState((previous) => mode === "demo" ? createDemoState(operatorProfile) : createEmptyState({ locale: previous?.locale ?? "ko", operatorProfile, onboardingCompleted: true }));
  }, []);

  const updateOperator = useCallback((displayName) => setState((previous) => withLog({ ...previous, operatorProfile: { displayName: displayName.trim() }, onboardingCompleted: true }, "operator_updated")), []);

  const deleteHeat = useCallback((heatId) => mutateWithRecovery({
    reason: "before_heat_delete",
    labelKo: `${heatId} 차지 삭제 전`,
    labelEn: `Before deleting ${heatId}`,
  }, (previous) => {
    const target = previous.heats.find((heat) => heat.id === heatId);
    if (!target || !canDeleteHeat(target)) return previous;
    const heats = previous.heats.filter((heat) => heat.id !== heatId);
    const currentHeatId = previous.currentHeatId === heatId ? heats[0]?.id ?? null : previous.currentHeatId;
    return withLog({ ...previous, heats, currentHeatId }, "heat_deleted", { heatId });
  }), [mutateWithRecovery]);

  const changeHeatLifecycle = useCallback((heatId, action, reason = "") => mutateWithRecovery({
    reason: action === "cancel" ? "before_heat_cancel" : "before_heat_archive",
    labelKo: action === "cancel" ? `${heatId} 차지 취소 전` : `${heatId} 차지 보관 전`,
    labelEn: action === "cancel" ? `Before cancelling ${heatId}` : `Before archiving ${heatId}`,
  }, (previous) => {
    const heats = previous.heats.map((heat) => {
      if (heat.id !== heatId) return heat;
      return action === "cancel" ? cancelHeat(heat, reason, previous.operatorProfile) : archiveHeat(heat, previous.operatorProfile);
    });
    return withLog({ ...previous, heats }, action === "cancel" ? "heat_cancelled" : "heat_archived", { heatId, reason });
  }), [mutateWithRecovery]);

  const correctRecord = useCallback((heatId, targetKind, targetId, changes, reason) => setState((previous) => {
    const heats = previous.heats.map((heat) => {
      if (heat.id !== heatId) return heat;
      const corrected = targetKind === "analysis"
        ? correctAnalysisRecord(heat, targetId, changes, reason, previous.operatorProfile)
        : correctEventRecord(heat, targetId, changes, reason, previous.operatorProfile);
      return withDerivedSnapshots(corrected, previous.settings, { type: "correction", id: corrected.correctionLog.at(-1)?.id }, previous.operatorProfile);
    });
    return withLog({ ...previous, heats }, "record_corrected", { heatId, targetKind, targetId, reason });
  }), []);

  const invalidateRecord = useCallback((heatId, targetKind, targetId, reason) => setState((previous) => {
    const heats = previous.heats.map((heat) => {
      if (heat.id !== heatId) return heat;
      const corrected = targetKind === "analysis"
        ? invalidateAnalysisRecord(heat, targetId, reason, previous.operatorProfile)
        : invalidateEventRecord(heat, targetId, reason, previous.operatorProfile);
      return withDerivedSnapshots(corrected, previous.settings, { type: "invalidation", id: corrected.correctionLog.at(-1)?.id }, previous.operatorProfile);
    });
    return withLog({ ...previous, heats }, "record_voided", { heatId, targetKind, targetId, reason });
  }), []);

  const rollbackStage = useCallback((heatId, reason) => setState((previous) => {
    const heats = previous.heats.map((heat) => {
      if (heat.id !== heatId) return heat;
      const corrected = rollbackLastStage(heat, reason, previous.operatorProfile);
      return withDerivedSnapshots(corrected, previous.settings, { type: "stage_rollback", id: corrected.correctionLog.at(-1)?.id }, previous.operatorProfile);
    });
    return withLog({ ...previous, heats }, "stage_rolled_back", { heatId, reason });
  }), []);

  const correctTap = useCallback((heatId, occurredAt, reason) => mutateWithRecovery({
    reason: "before_tap_correction",
    labelKo: `${heatId} 출강 기록 정정 전`,
    labelEn: `Before correcting ${heatId} tap record`,
  }, (previous) => {
    const heats = previous.heats.map((heat) => {
      if (heat.id !== heatId) return heat;
      const corrected = correctTapRecord(heat, occurredAt, reason, previous.operatorProfile);
      return withDerivedSnapshots(corrected, previous.settings, { type: "tap_correction", id: corrected.correctionLog.at(-1)?.id }, previous.operatorProfile);
    });
    return withLog({ ...previous, heats }, "tap_corrected", { heatId, occurredAt, reason });
  }), [mutateWithRecovery]);

  const adoptAnalysis = useCallback((heatId, analysisId, reason) => setState((previous) => {
    const heats = previous.heats.map((heat) => {
      if (heat.id !== heatId) return heat;
      const corrected = adoptAnalysisRecord(heat, analysisId, reason, previous.operatorProfile);
      return withDerivedSnapshots(corrected, previous.settings, { type: "analysis_adopted", id: analysisId }, previous.operatorProfile);
    });
    return withLog({ ...previous, heats }, "analysis_adopted", { heatId, analysisId, reason });
  }), []);

  const selectActualEndpoint = useCallback((heatId, analysisId, reason) => mutateWithRecovery({
    reason: "before_actual_endpoint_selection",
    labelKo: `${heatId} 확정 종점 지정 전`,
    labelEn: `Before selecting ${heatId} confirmed endpoint`,
  }, (previous) => {
    const heats = previous.heats.map((heat) => heat.id === heatId ? setActualEndpointAnalysis(heat, analysisId, reason, previous.operatorProfile) : heat);
    return withLog({ ...previous, heats }, "actual_endpoint_selected", { heatId, analysisId, reason });
  }), [mutateWithRecovery]);

  const createManualRecoveryPoint = useCallback((protectedPoint = false) => createRecovery({
    reason: "manual",
    labelKo: "사용자 수동 복구점",
    labelEn: "User-created recovery point",
    protectedPoint,
  }), [createRecovery]);

  const setRecoveryPointProtected = useCallback(async (pointId, protectedPoint) => {
    try {
      const points = await protectStoredRecoveryPoint(pointId, protectedPoint);
      setRecoveryPoints(points);
      setRecoveryError(null);
      return true;
    } catch (error) {
      setRecoveryError(error?.message ?? "recovery_point_update_failed");
      return false;
    }
  }, []);

  const removeRecoveryPoint = useCallback(async (pointId) => {
    try {
      const points = await removeStoredRecoveryPoint(pointId);
      setRecoveryPoints(points);
      setRecoveryError(null);
      return true;
    } catch (error) {
      setRecoveryError(error?.message ?? "recovery_point_delete_failed");
      return false;
    }
  }, []);

  const restoreRecoveryPoint = useCallback(async (pointId) => {
    const target = recoveryPoints.find((point) => point.id === pointId);
    const snapshot = stateRef.current;
    if (!target?.state || !snapshot) return false;
    try {
      const portableTarget = validatePortableRecoveryPoint(target);
      if (!portableTarget.valid) {
        setRecoveryError(`recovery_point_not_restorable:${portableTarget.error}`);
        return false;
      }
      const safety = makeRecoveryPoint(snapshot, {
        reason: "before_recovery_restore",
        labelKo: "복구점 복원 직전 상태",
        labelEn: "Workspace before recovery restore",
        protectedPoint: true,
        sourceRevision: persistedRevision.current,
      });
      const next = withLog(normalizeCoachState(portableTarget.point.state), "recovery_point_restored", { recoveryPointId: pointId, safetyRecoveryPointId: safety.id });
      const points = retainRecoveryPoints([safety, ...recoveryPoints]);
      await waitForPendingSave();
      const saved = await replaceWorkspace(next, points, persistedRevision.current);
      persistedRevision.current = saved.storageRevision;
      persistenceBlocked.current = false;
      skipNextSave.current = true;
      setState(normalizeCoachState(saved));
      setRecoveryPoints(points);
      setStorageMeta({ revision: saved.storageRevision, lastSavedAt: saved.lastSavedAt });
      setSaveStatus("saved");
      setRecoveryError(null);
      sync.current?.publish({ type: "workspace_saved", revision: saved.storageRevision, sourceId: instanceId.current });
      return true;
    } catch (error) {
      persistenceBlocked.current = true;
      setRecoveryError(error?.message ?? "recovery_point_restore_failed");
      setSaveStatus(error instanceof StorageConflictError || error?.code === "storage_revision_conflict" ? "conflict" : "error");
      return false;
    }
  }, [recoveryPoints, waitForPendingSave]);

  const restoreJsonBackup = useCallback(async (parsedBackup) => {
    const snapshot = stateRef.current;
    if (!snapshot || !parsedBackup?.state) return false;
    try {
      const now = new Date();
      const safety = makeRecoveryPoint(snapshot, {
        reason: "before_json_restore",
        labelKo: "JSON 전체 불러오기 전",
        labelEn: "Before full JSON restore",
        protectedPoint: true,
        createdAt: now.toISOString(),
        sourceRevision: persistedRevision.current,
      });
      const next = withLog(normalizeCoachState(parsedBackup.state), "json_backup_restored", {
        sha256: parsedBackup.sha256,
        sourceCreatedAt: parsedBackup.preview?.createdAt,
        safetyRecoveryPointId: safety.id,
      });
      next.restoreMetadata = {
        type: "json_full_replace",
        restoredAt: now.toISOString(),
        undoUntil: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        safetyRecoveryPointId: safety.id,
        sourceSha256: parsedBackup.sha256,
      };
      const points = retainRecoveryPoints([safety, ...(parsedBackup.recoveryPoints ?? [])]);
      await waitForPendingSave();
      const saved = await replaceWorkspace(next, points, persistedRevision.current);
      persistedRevision.current = saved.storageRevision;
      persistenceBlocked.current = false;
      skipNextSave.current = true;
      setState(normalizeCoachState(saved));
      setRecoveryPoints(points);
      setStorageMeta({ revision: saved.storageRevision, lastSavedAt: saved.lastSavedAt });
      setSaveStatus("saved");
      setRecoveryError(null);
      sync.current?.publish({ type: "workspace_saved", revision: saved.storageRevision, sourceId: instanceId.current });
      return true;
    } catch (error) {
      persistenceBlocked.current = true;
      setRecoveryError(error?.message ?? "json_backup_restore_failed");
      setSaveStatus(error instanceof StorageConflictError || error?.code === "storage_revision_conflict" ? "conflict" : "error");
      return false;
    }
  }, [waitForPendingSave]);

  const undoLastJsonRestore = useCallback(async () => {
    const snapshot = stateRef.current;
    const metadata = snapshot?.restoreMetadata;
    const target = recoveryPoints.find((point) => point.id === metadata?.safetyRecoveryPointId);
    if (!target?.state || !metadata?.undoUntil || new Date(metadata.undoUntil) < new Date()) return false;
    try {
      const safety = makeRecoveryPoint(snapshot, { reason: "before_json_restore_undo", labelKo: "JSON 불러오기 취소 전", labelEn: "Before undoing JSON restore", sourceRevision: persistedRevision.current });
      const next = withLog({ ...normalizeCoachState(target.state), restoreMetadata: null }, "json_restore_undone", { restoredSafetyPointId: target.id, safetyRecoveryPointId: safety.id });
      const points = retainRecoveryPoints([safety, ...recoveryPoints]);
      await waitForPendingSave();
      const saved = await replaceWorkspace(next, points, persistedRevision.current);
      persistedRevision.current = saved.storageRevision;
      skipNextSave.current = true;
      setState(normalizeCoachState(saved));
      setRecoveryPoints(points);
      setStorageMeta({ revision: saved.storageRevision, lastSavedAt: saved.lastSavedAt });
      setSaveStatus("saved");
      setRecoveryError(null);
      sync.current?.publish({ type: "workspace_saved", revision: saved.storageRevision, sourceId: instanceId.current });
      return true;
    } catch (error) {
      persistenceBlocked.current = true;
      setRecoveryError(error?.message ?? "json_restore_undo_failed");
      setSaveStatus(error instanceof StorageConflictError || error?.code === "storage_revision_conflict" ? "conflict" : "error");
      return false;
    }
  }, [recoveryPoints, waitForPendingSave]);

  const setLocale = useCallback((locale) => setState((previous) => ({ ...previous, locale })), []);

  const retryLoad = useCallback(() => { setLoadError(null); setSaveStatus("loading"); setRetryTick((value) => value + 1); }, []);
  const reloadFromStorage = useCallback(() => { setLoadError(null); setSaveStatus("loading"); setRetryTick((value) => value + 1); }, []);
  const retrySave = useCallback(() => {
    persistenceBlocked.current = false;
    setSaveStatus("saving");
    setState((previous) => previous ? { ...previous } : previous);
  }, []);
  const canWrite = Boolean(state) && !["loading", "load_error", "error", "conflict", "stale"].includes(saveStatus);

  return { state, currentHeat, recovery, recoveryPoints, recoveryError, storageMeta, saveStatus, loadError, canWrite, retryLoad, reloadFromStorage, retrySave, selectHeat, addEvent, advanceCurrentStage, createHeat, updateCurrentHeatInputs, updateSettings, recordOperation, saveAdditionPlan, refreshAdditionProposal, recordAdditionDecision, setAdditionCoachHidden, replaceState, restoreJsonBackup, resetWorkspace, restoreRecovery, restoreRecoveryPoint, undoLastJsonRestore, createManualRecoveryPoint, setRecoveryPointProtected, removeRecoveryPoint, completeOnboarding, updateOperator, deleteHeat, changeHeatLifecycle, correctRecord, invalidateRecord, rollbackStage, correctTap, adoptAnalysis, selectActualEndpoint, setLocale };
}
