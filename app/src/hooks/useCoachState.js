import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createDemoState } from "../data/demoState.js";
import { clearState, loadState, saveState } from "../storage/indexedDb.js";

function withLog(state, type, payload = {}) {
  const at = new Date().toISOString();
  return {
    ...state,
    operationLog: [...(state.operationLog ?? []), { id: `LOG-${crypto.randomUUID()}`, type, at, ...payload }],
  };
}

export function useCoachState() {
  const [state, setState] = useState(null);
  const [saveStatus, setSaveStatus] = useState("loading");
  const loaded = useRef(false);

  useEffect(() => {
    loadState()
      .then((saved) => setState(saved ?? createDemoState()))
      .catch(() => setState(createDemoState()))
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

  const updateCurrentHeat = useCallback((updater, logType = "heat_updated") => {
    setState((previous) => {
      const heats = previous.heats.map((heat) => heat.id === previous.currentHeatId ? updater(heat) : heat);
      return withLog({ ...previous, heats }, logType, { heatId: previous.currentHeatId });
    });
  }, []);

  const addEvent = useCallback((type, form) => {
    updateCurrentHeat((heat) => {
      const event = {
        id: `EV-${crypto.randomUUID()}`,
        type,
        occurredAt: form.occurredAt,
        recordedAt: new Date().toISOString(),
        summaryKo: form.summaryKo,
        summaryEn: form.summaryEn,
        payload: form,
      };
      let next = { ...heat, events: [...(heat.events ?? []), event] };
      if (type === "checkpoint") {
        next = { ...next, process: { ...heat.process, cumulativeOxygenNm3: Number(form.cumulativeOxygenNm3), lanceHeightM: Number(form.lanceHeightM), oxygenFlowNm3PerMinute: Number(form.oxygenFlowNm3PerMinute), remainingMinutes: Number(form.remainingMinutes), plannedValuesIncluded: false } };
      }
      if (type === "reblow") {
        next = { ...next, process: { ...heat.process, cumulativeOxygenNm3: Number(heat.process.cumulativeOxygenNm3) + Number(form.additionalOxygenNm3), remainingMinutes: Number(form.durationMinutes) } };
      }
      if (type === "material" && form.materialCategory === "flux") {
        next = { ...next, initial: { ...heat.initial, fluxKg: Number(heat.initial.fluxKg ?? 0) + Number(form.amountKg) } };
      }
      if (type === "sample") {
        next = { ...next, samples: [...(heat.samples ?? []), { id: form.sampleId, sampledAt: form.occurredAt, stage: heat.stage, method: "Pending", adopted: false, values: {} }] };
      }
      if (type === "analysis") {
        const sampleId = form.sampleId || heat.samples.at(-1)?.id || `S-${Date.now()}`;
        const exists = heat.samples.some((sample) => sample.id === sampleId);
        const values = Object.fromEntries(Object.entries(form.values).filter(([, value]) => value !== "").map(([key, value]) => [key, Number(value)]));
        next = {
          ...next,
          samples: exists
            ? heat.samples.map((sample) => ({ ...sample, adopted: sample.id === sampleId, ...(sample.id === sampleId ? { method: form.method || "OES", values, sampledAt: form.occurredAt } : {}) }))
            : [...heat.samples.map((sample) => ({ ...sample, adopted: false })), { id: sampleId, sampledAt: form.occurredAt, stage: heat.stage, method: form.method || "OES", adopted: true, values }],
        };
      }
      if (type === "tap") {
        next = { ...next, status: "completed", stage: "G7", stageLabelKo: "출강 완료", stageLabelEn: "Tap complete", tappedAt: form.occurredAt };
      }
      return next;
    }, `event_${type}`);
  }, [updateCurrentHeat]);

  const updateSettings = useCallback((settings) => setState((previous) => withLog({ ...previous, settings }, "settings_updated")), []);
  const recordOperation = useCallback((type, payload = {}) => setState((previous) => withLog(previous, type, payload)), []);

  const createHeat = useCallback((form) => {
    setState((previous) => {
      const startedAt = form.startedAt;
      const expectedTapAt = new Date(new Date(startedAt).getTime() + Number(form.expectedDurationMinutes) * 60000).toISOString();
      const heat = {
        id: form.id.trim(),
        gradeCode: form.gradeCode,
        equipmentProfileId: form.equipmentProfileId,
        coefficientProfileId: form.coefficientProfileId,
        status: "in_progress",
        stage: "G0",
        stageLabelKo: "장입",
        stageLabelEn: "Charge",
        startedAt,
        expectedTapAt,
        initial: {
          hotMetalKg: Number(form.hotMetalKg),
          hotMetalC: Number(form.hotMetalC),
          hotMetalTemperatureC: Number(form.hotMetalTemperatureC),
          scrapKg: Number(form.scrapKg),
          scrapC: Number(form.scrapC),
          fluxKg: Number(form.fluxKg),
          plannedTotalOxygenNm3: Number(form.plannedTotalOxygenNm3),
        },
        process: {
          cumulativeOxygenNm3: Number(form.cumulativeOxygenNm3),
          lanceHeightM: Number(form.lanceHeightM),
          oxygenFlowNm3PerMinute: Number(form.oxygenFlowNm3PerMinute),
          remainingMinutes: Number(form.expectedDurationMinutes),
          plannedValuesIncluded: false,
        },
        samples: [],
        events: [{
          id: `EV-${crypto.randomUUID()}`,
          type: "charge",
          occurredAt: startedAt,
          recordedAt: new Date().toISOString(),
          summaryKo: "차지 생성 및 초기값 입력",
          summaryEn: "Heat created with initial inputs",
        }],
      };
      return withLog({ ...previous, heats: [...previous.heats, heat], currentHeatId: heat.id }, "heat_created", { heatId: heat.id });
    });
  }, []);

  const replaceState = useCallback((nextState) => setState(withLog(nextState, "backup_restored")), []);

  const resetDemo = useCallback(async () => {
    await clearState();
    setState(createDemoState());
  }, []);

  const setLocale = useCallback((locale) => setState((previous) => ({ ...previous, locale })), []);

  return { state, currentHeat, saveStatus, selectHeat, addEvent, createHeat, updateSettings, recordOperation, replaceState, resetDemo, setLocale };
}
