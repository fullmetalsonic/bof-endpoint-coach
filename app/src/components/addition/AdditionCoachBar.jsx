import { useMemo, useState } from "react";
import { ArrowsLeftRight, CaretDown, CaretUp, Clock, PlusCircle, X } from "@phosphor-icons/react";
import { calculateAdditionCoach } from "../../calculation/addition/recommendationCoordinator.js";
import { validateOperatorPlanInput } from "../../domain/addition/operatorPlan.js";
import { useDialogFocus } from "../../hooks/useDialogFocus.js";
import { usePersistentDraft } from "../../hooks/usePersistentDraft.js";
import { assumptionLabel, modelLabel, objectiveLabel, planValidationMessage, reasonLabel, timingModeLabel } from "./additionText.js";

function localDateTimeValue(iso = new Date().toISOString()) {
  const date = new Date(iso);
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 19);
}

function rangeText(amount, locale) {
  if (!amount) return "–";
  const digits = amount.unit === "kg" || amount.unit === "Nm³" ? 0 : 2;
  const format = (value) => Number(value).toLocaleString(locale === "ko" ? "ko-KR" : "en-GB", { maximumFractionDigits: digits });
  const low = format(amount.low);
  const high = format(amount.high);
  return `${low === high ? low : `${low}–${high}`} ${amount.unit}`;
}

function materialName(recommendation, locale) {
  if (!recommendation) return "–";
  if (recommendation.operationType === "oxygen") return locale === "ko" ? "추가 산소" : "Additional oxygen";
  return locale === "ko" ? recommendation.materialNameKo : recommendation.materialNameEn;
}

function statusLabel(mode, locale) {
  if (mode === "field_approved") return locale === "ko" ? "현장 검증" : "Field approved";
  return locale === "ko" ? "문헌 시험" : "Literature test";
}

function timingText(timing, locale) {
  if (!timing?.available) return locale === "ko" ? `허용 단계 ${timing?.allowedStages?.join("·") || "–"}` : `Allowed ${timing?.allowedStages?.join(" · ") || "–"}`;
  if (!timing.startAt || !timing.endAt) return `${timing.stage}`;
  const options = { hour: "2-digit", minute: "2-digit", hour12: false };
  const start = new Date(timing.startAt).toLocaleTimeString(locale === "ko" ? "ko-KR" : "en-GB", options);
  const end = new Date(timing.endAt).toLocaleTimeString(locale === "ko" ? "ko-KR" : "en-GB", options);
  return `${start === end ? (locale === "ko" ? `${start} 시점` : `at ${start}`) : `${start}–${end}`} ${locale === "ko" ? "추정" : "est."}`;
}

function differenceText(plan, recommendation, locale) {
  if (!plan) return locale === "ko" ? "내 계획 없음" : "No operator plan";
  if (!recommendation) return locale === "ko" ? "비교할 코치안 없음" : "No coach proposal to compare";
  const sameOperation = plan.operationType === recommendation.operationType && (plan.operationType === "oxygen" || plan.materialCode === recommendation.materialCode);
  if (!sameOperation) return locale === "ko" ? "조작·재료가 다름" : "Different action/material";
  if (plan.amount < recommendation.amount.low) return locale === "ko" ? "내 계획이 낮음" : "Operator plan is lower";
  if (plan.amount > recommendation.amount.high) return locale === "ko" ? "내 계획이 높음" : "Operator plan is higher";
  return locale === "ko" ? "코치 범위 안" : "Within coach range";
}

function AdditionComparisonDialog({ heat, settings, coach, locale, canWrite, onClose, onSavePlan, onDecision }) {
  const ko = locale === "ko";
  const recommendation = coach.primary;
  const alternative = coach.alternative;
  const activePlan = [...(heat.additionCoach?.operatorPlans ?? [])].reverse().find((plan) => (plan.status ?? "active") === "active") ?? null;
  const latestProposal = [...(heat.additionCoach?.proposals ?? [])].reverse().find((proposal) => proposal.status === "active") ?? null;
  const materialOptions = settings.materials.filter((material) => ["flux", "coolant", "alloy", "carburizer"].includes(material.category));
  const defaults = useMemo(() => ({
    operationType: recommendation?.operationType ?? "material",
    materialCode: recommendation?.materialCode ?? materialOptions[0]?.code ?? "",
    amount: recommendation?.amount?.midpoint ? String(Math.round(recommendation.amount.midpoint * 1000) / 1000) : "",
    timingMode: "now",
    plannedAt: localDateTimeValue(recommendation?.timing?.startAt),
    elapsedMinutes: "",
    cumulativeOxygenNm3: "",
    note: "",
  }), [materialOptions, recommendation]);
  const baseVersion = `${heat.id}:${heat.stage}:addition-plan-v1`;
  const { value: form, setValue: setForm, dirty, restored, commit, discard } = usePersistentDraft({ key: `addition-plan-${heat.id}`, baseVersion, defaults });
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState(null);
  const [recordedDecisionKeys, setRecordedDecisionKeys] = useState([]);
  const dialogRef = useDialogFocus({ onClose });
  const set = (key, value) => {
    setActionMessage(null);
    setForm((previous) => ({ ...previous, [key]: value }));
  };
  const formValidation = validateOperatorPlanInput(heat, form);
  const valid = formValidation.ok;
  const decisionRecorded = (decision) => Boolean(latestProposal?.id && (recordedDecisionKeys.includes(`${latestProposal.id}:${decision}`) || heat.additionCoach?.decisions?.some((entry) => entry.proposalId === latestProposal.id && entry.decision === decision)));
  const keepDecisionRecorded = decisionRecorded("keep_operator_plan");
  const copyDecisionRecorded = decisionRecorded("copy_coach_to_plan");

  async function savePlan(event) {
    event.preventDefault();
    if (!valid || busy || !canWrite) return;
    setBusy(true);
    setActionMessage(null);
    try {
      const ok = await onSavePlan({ ...form, amount: Number(form.amount) });
      if (!ok) {
        setActionMessage({ type: "error", text: planValidationMessage("plan_save_failed", locale) });
        return;
      }
      commit();
      setActionMessage({ type: "success", text: ko ? "내 계획을 저장했습니다. 실제 투입 기록은 별도로 입력하십시오." : "Operator plan saved. Record the actual addition separately." });
    } catch {
      setActionMessage({ type: "error", text: planValidationMessage("plan_save_failed", locale) });
    } finally {
      setBusy(false);
    }
  }

  async function copyCoach() {
    if (!recommendation || copyDecisionRecorded || !canWrite || busy) return;
    setBusy(true);
    setActionMessage(null);
    const copiedForm = {
      operationType: recommendation.operationType,
      materialCode: recommendation.materialCode ?? "",
      amount: String(Math.round(recommendation.amount.midpoint * 1000) / 1000),
      timingMode: recommendation.timing?.startAt ? "local_time" : "now",
      plannedAt: localDateTimeValue(recommendation.timing?.startAt),
      elapsedMinutes: "",
      cumulativeOxygenNm3: "",
      note: ko ? "코치 참고안을 계획으로 복사" : "Copied from coach reference",
    };
    try {
      const ok = await onSavePlan({ ...copiedForm, amount: Number(copiedForm.amount) });
      if (!ok) {
        setActionMessage({ type: "error", text: planValidationMessage("plan_save_failed", locale) });
        return;
      }
      commit(copiedForm);
      if (latestProposal?.id) {
        const decisionOk = await onDecision(latestProposal.id, "copy_coach_to_plan");
        if (!decisionOk) {
          setActionMessage({ type: "error", text: planValidationMessage("plan_saved_decision_failed", locale) });
          return;
        }
        setRecordedDecisionKeys((previous) => [...new Set([...previous, `${latestProposal.id}:copy_coach_to_plan`])]);
      }
      setActionMessage({ type: "success", text: ko ? "코치 참고안을 저장된 내 계획으로 복사했습니다. 실제 투입 기록은 아닙니다." : "Coach reference copied to the saved operator plan. This is not an actual addition." });
    } catch {
      setActionMessage({ type: "error", text: planValidationMessage("plan_save_failed", locale) });
    } finally {
      setBusy(false);
    }
  }

  async function keepSavedPlan() {
    if (!activePlan || !latestProposal?.id || keepDecisionRecorded || !canWrite || busy) return;
    setBusy(true);
    setActionMessage(null);
    try {
      const ok = await onDecision(latestProposal.id, "keep_operator_plan");
      if (!ok) {
        setActionMessage({ type: "error", text: planValidationMessage("plan_decision_failed", locale) });
        return;
      }
      setRecordedDecisionKeys((previous) => [...new Set([...previous, `${latestProposal.id}:keep_operator_plan`])]);
      setActionMessage({ type: "success", text: ko ? "위 표의 저장된 내 계획을 채택한다고 기록했습니다." : "Recorded the decision to keep the saved operator plan shown above." });
    } catch {
      setActionMessage({ type: "error", text: planValidationMessage("plan_decision_failed", locale) });
    } finally {
      setBusy(false);
    }
  }

  async function deferUntilSample() {
    if (!latestProposal?.id || !canWrite || busy) return;
    setBusy(true);
    setActionMessage(null);
    try {
      const ok = await onDecision(latestProposal.id, "defer_until_sample");
      if (!ok) {
        setActionMessage({ type: "error", text: planValidationMessage("plan_decision_failed", locale) });
        return;
      }
      onClose();
    } catch {
      setActionMessage({ type: "error", text: planValidationMessage("plan_decision_failed", locale) });
    } finally {
      setBusy(false);
    }
  }

  return <div className="modal-backdrop" role="presentation"><div ref={dialogRef} tabIndex="-1" className="addition-drawer" role="dialog" aria-modal="true" aria-labelledby="addition-comparison-title">
    <div className="modal-header"><div><span>{heat.id} · {heat.stage}</span><h2 id="addition-comparison-title">{ko ? "투입 계획 비교" : "Addition plan comparison"}</h2></div><button type="button" onClick={onClose} aria-label={ko ? "닫기" : "Close"}><X /></button></div>
    <div className="addition-boundary-note"><strong>{statusLabel(coach.mode, locale)}</strong><span>{ko ? "코치안은 참고 계획이며 실제 투입 기록이 아닙니다. 실제 투입은 하단 ‘자재 투입 기록’ 또는 ‘재송풍 기록’으로 따로 저장하십시오." : "The coach proposal is a planning reference, not an actual addition. Record the actual material or reblow separately."}</span></div>
    <section className="addition-comparison-grid" aria-label={ko ? "계획 비교" : "Plan comparison"}>
      <div><span>{ko ? "항목" : "Item"}</span><strong>{ko ? "내 계획" : "Operator plan"}</strong><strong>{ko ? "코치 참고안" : "Coach reference"}</strong></div>
      <div><span>{ko ? "조작·재료" : "Action/material"}</span><strong>{activePlan ? (activePlan.operationType === "oxygen" ? (ko ? "추가 산소" : "Additional oxygen") : activePlan.materialCode) : "–"}</strong><strong>{materialName(recommendation, locale)}</strong></div>
      <div><span>{ko ? "양" : "Amount"}</span><strong>{activePlan ? `${Number(activePlan.amount).toLocaleString()} ${activePlan.unit}` : "–"}</strong><strong>{rangeText(recommendation?.amount, locale)}</strong></div>
      <div><span>{ko ? "시점" : "Timing"}</span><strong>{activePlan?.plannedAt ? new Date(activePlan.plannedAt).toLocaleString(ko ? "ko-KR" : "en-GB") : timingModeLabel(activePlan?.timingMode, locale)}</strong><strong>{timingText(recommendation?.timing, locale)}</strong></div>
      <div className="comparison-result"><span>{ko ? "비교" : "Comparison"}</span><strong>{differenceText(activePlan, recommendation, locale)}</strong><strong>{recommendation?.targetConflicts?.length ? `${ko ? "목표 충돌" : "Target conflict"}: ${recommendation.targetConflicts.join("·")}` : (ko ? "충돌 없음/미확인" : "No conflict / not checked")}</strong></div>
    </section>
    {alternative && <section className="addition-alternative"><span>{ko ? "함께 비교할 대안" : "Alternative to compare"}</span><strong>{modelLabel(alternative.model, locale)} · {materialName(alternative, locale)} · {rangeText(alternative.amount, locale)}</strong><small>{timingText(alternative.timing, locale)}</small></section>}
    <section className="addition-explanation"><h3>{ko ? "계산 근거와 한계" : "Basis and limits"}</h3><dl><div><dt>{ko ? "목적" : "Objective"}</dt><dd>{recommendation ? objectiveLabel(recommendation.objective, locale) : (ko ? "현재 권고 없음" : "No current recommendation")}</dd></div><div><dt>{ko ? "모델" : "Model"}</dt><dd>{coach.profile?.formulaVersion} · {coach.profile?.versionId}</dd></div><div><dt>{ko ? "가정" : "Assumptions"}</dt><dd>{recommendation?.assumptions?.map((item) => assumptionLabel(item, locale)).join(" · ") || "–"}</dd></div><div><dt>{ko ? "문헌" : "Sources"}</dt><dd>{recommendation?.sourceIds?.join(", ") || coach.profile?.sourceIds?.join(", ") || "–"}</dd></div></dl>{!recommendation && <div className="addition-no-reason"><strong>{ko ? "모델별 확인 결과" : "Model checks"}</strong><ul>{coach.modelResults?.map((result) => <li key={result.model}><span>{modelLabel(result.model, locale)}</span>{reasonLabel(result.reason, locale)}{result.allowedStages?.length ? ` · ${ko ? "허용" : "allowed"} ${result.allowedStages.join("·")}` : ""}</li>)}</ul></div>}</section>
    <form className="addition-plan-form" onSubmit={savePlan}><div className="panel-title"><h3>{ko ? "내 계획 입력(선택)" : "Operator plan (optional)"}</h3><span>{ko ? "계획만 저장 · 실제값 아님" : "Plan only · not actual"}</span></div>
      {!canWrite && <div className="addition-plan-error" role="alert">{ko ? "현재 작업공간이 저장 잠금 상태입니다. 비교 내용은 볼 수 있지만 계획·판단은 저장할 수 없습니다. 이 창을 닫고 상단 저장 상태 안내를 먼저 해결하십시오." : "Workspace saving is currently locked. You can review the comparison, but cannot save a plan or decision. Close this dialog and resolve the storage status banner first."}</div>}
      {dirty && <div className="draft-status" role="status"><strong>{restored ? (ko ? "미저장 계획 초안을 복구했습니다." : "Unsaved plan draft restored.") : (ko ? "계획 초안이 자동 보관됩니다." : "Plan draft is autosaved.")}</strong><button type="button" onClick={discard}>{ko ? "초안 버리기" : "Discard"}</button></div>}
      <div className="addition-plan-fields"><label><span>{ko ? "조작" : "Action"}</span><select value={form.operationType} onChange={(event) => set("operationType", event.target.value)}><option value="material">{ko ? "재료 투입" : "Material"}</option><option value="oxygen">{ko ? "추가 산소" : "Additional oxygen"}</option></select></label>{form.operationType === "material" && <label><span>{ko ? "재료" : "Material"}</span><select value={form.materialCode} onChange={(event) => set("materialCode", event.target.value)}>{materialOptions.map((material) => <option key={material.code} value={material.code}>{material.code} · {ko ? material.nameKo : material.nameEn}</option>)}</select></label>}<label><span>{ko ? "예상량" : "Planned amount"}</span><div className="input-with-unit"><input type="number" min="0" step="0.001" value={form.amount} aria-invalid={dirty && formValidation.reason === "plan_amount_invalid"} aria-describedby={dirty && !valid ? "addition-plan-error" : undefined} onChange={(event) => set("amount", event.target.value)} /><span>{form.operationType === "oxygen" ? "Nm³" : "kg"}</span></div></label><label><span>{ko ? "예정 기준" : "Timing basis"}</span><select value={form.timingMode} onChange={(event) => set("timingMode", event.target.value)}><option value="now">{ko ? "지금" : "Now"}</option><option value="local_time">{ko ? "로컬 시각" : "Local time"}</option><option value="elapsed">{ko ? "취련 경과" : "Elapsed time"}</option><option value="oxygen">{ko ? "누적 산소" : "Cumulative oxygen"}</option></select></label>{form.timingMode === "local_time" && <label><span>{ko ? "예정 시각" : "Planned time"}</span><input type="datetime-local" step="1" value={form.plannedAt} aria-invalid={dirty && formValidation.reason === "plan_time_invalid"} aria-describedby={dirty && !valid ? "addition-plan-error" : undefined} onChange={(event) => set("plannedAt", event.target.value)} /></label>}{form.timingMode === "elapsed" && <label><span>{ko ? "취련 경과" : "Elapsed"} (min)</span><input type="number" min="0" step="0.1" value={form.elapsedMinutes} aria-invalid={dirty && formValidation.reason === "plan_elapsed_invalid"} aria-describedby={dirty && !valid ? "addition-plan-error" : undefined} onChange={(event) => set("elapsedMinutes", event.target.value)} /></label>}{form.timingMode === "oxygen" && <label><span>{ko ? "누적 산소" : "Cumulative oxygen"} (Nm³)</span><input type="number" min="0" step="1" value={form.cumulativeOxygenNm3} aria-invalid={dirty && formValidation.reason === "plan_oxygen_invalid"} aria-describedby={dirty && !valid ? "addition-plan-error" : undefined} onChange={(event) => set("cumulativeOxygenNm3", event.target.value)} /></label>}</div>
      {dirty && !valid && <div id="addition-plan-error" className="addition-plan-error" role="alert">{planValidationMessage(formValidation.reason, locale)}</div>}
      <div className="addition-plan-actions"><button type="submit" className="secondary-button" disabled={!valid || !canWrite || busy}>{ko ? "내 계획 저장" : "Save operator plan"}</button><button type="button" className="primary-button" disabled={!recommendation || copyDecisionRecorded || !canWrite || busy} onClick={copyCoach}>{copyDecisionRecorded ? (ko ? "코치안 복사 기록됨" : "Coach copy recorded") : (ko ? "코치안을 계획으로 복사" : "Copy coach to plan")}</button></div>
    </form>
    <div className="addition-decision-help"><span>{ko ? "아래 선택은 입력 중인 초안을 저장하지 않습니다. 위 표에 이미 저장된 계획에 대한 판단만 기록합니다." : "The choices below do not save the form draft. They only record a decision about the saved plan shown above."}</span>{actionMessage && <strong className={actionMessage.type} role={actionMessage.type === "error" ? "alert" : "status"}>{actionMessage.text}</strong>}</div>
    <div className="modal-actions"><button type="button" className="secondary" disabled={!activePlan || !latestProposal?.id || keepDecisionRecorded || !canWrite || busy} onClick={keepSavedPlan}>{keepDecisionRecorded ? (ko ? "내 계획 채택 기록됨" : "Operator plan recorded") : (ko ? "저장된 내 계획 채택" : "Keep saved operator plan")}</button><button type="button" className="secondary" disabled={!latestProposal?.id || !canWrite || busy} onClick={deferUntilSample}>{ko ? "샘플 후 다시 보기" : "Review after sample"}</button><button type="button" className="primary" onClick={onClose}>{ko ? "닫기" : "Close"}</button></div>
  </div></div>;
}

export function AdditionCoachBar({ heat, settings, endpoint, locale, canWrite = true, onRefresh, onSavePlan, onDecision, onSetHidden }) {
  const [open, setOpen] = useState(false);
  const coach = calculateAdditionCoach(heat, settings, endpoint);
  const primary = coach.primary;
  const ko = locale === "ko";
  if (heat.additionCoach?.hidden) return <section className="addition-coach-bar collapsed" aria-label={ko ? "투입 코치 접힘" : "Addition coach collapsed"}><div><CaretDown /><strong>{ko ? "투입 코치" : "Addition coach"}</strong><span>{ko ? "이번 차지에서 접혀 있습니다. G단계 진행에는 영향이 없습니다." : "Hidden for this heat. Stage progression is unaffected."}</span></div><button type="button" disabled={!canWrite} onClick={() => onSetHidden(false)}>{ko ? "다시 보기" : "Show again"}</button></section>;
  function openComparison() { if (canWrite) onRefresh("viewed"); setOpen(true); }
  return <>
    <section className={`addition-coach-bar ${primary ? "has-recommendation" : "no-recommendation"}`} aria-label={ko ? "투입 코치" : "Addition coach"}>
      <div className="addition-coach-title"><ArrowsLeftRight /><strong>{ko ? "투입 코치" : "Addition coach"}</strong><span className={`addition-mode ${coach.mode}`}>{statusLabel(coach.mode, locale)}</span></div>
      <div className="addition-coach-summary"><span>{primary ? (ko ? "투입 검토" : "Review addition") : (ko ? "현재 권고 없음" : "No current recommendation")}</span><strong>{primary ? `${materialName(primary, locale)} · ${rangeText(primary.amount, locale)}` : (ko ? "현재 입력과 목표범위에서 즉시 검토할 조작이 없습니다." : "No immediate action is indicated by the current inputs and targets.")}</strong>{primary && <small><Clock /> {timingText(primary.timing, locale)}</small>}</div>
      <div className="addition-coach-actions"><button type="button" onClick={openComparison}><CaretUp />{ko ? "비교 보기" : "Compare"}</button><button type="button" onClick={openComparison}><PlusCircle />{ko ? "내 계획" : "My plan"}</button><button type="button" disabled={!canWrite} onClick={() => onSetHidden(true)}>{ko ? "이번 차지에서 접기" : "Hide for heat"}</button></div>
    </section>
    {open && <AdditionComparisonDialog heat={heat} settings={settings} coach={coach} locale={locale} canWrite={canWrite} onClose={() => setOpen(false)} onSavePlan={onSavePlan} onDecision={onDecision} />}
  </>;
}
