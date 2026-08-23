import { ArrowRight, CheckCircle, Circle, Info, PencilSimple, WarningCircle } from "@phosphor-icons/react";
import { getStageWorkflow } from "../domain/workflowGuidance.js";
import { StageControls } from "./StageControls.jsx";

const statusIcons = {
  done: CheckCircle,
  current: ArrowRight,
  ready: Circle,
  pending: Circle,
  optional: Info,
  blocked: WarningCircle,
};

function ActionButton({ step, onAction, onAdvance, onEditInitial, locale, writeLocked }) {
  if (!step || step.kind === "complete") return null;
  if (step.kind === "advance") return <StageControls heat={step.heat} locale={locale} onAdvance={onAdvance} variant="primary" writeLocked={writeLocked} />;
  const click = step.kind === "edit_initial" ? onEditInitial : () => onAction(step.action);
  return (
    <button type="button" className="workflow-primary-button" onClick={click} disabled={writeLocked}>
      {step.kind === "edit_initial" && <PencilSimple weight="bold" />}
      {step.buttonLabel}
      <ArrowRight weight="bold" />
    </button>
  );
}

function PredictionNotice({ rows, locale, t }) {
  const endpointRows = rows.filter((row) => ["C", "temperature"].includes(row.key));
  const available = endpointRows.every((row) => row.prediction.available);
  const inside = available && endpointRows.every((row) => row.predictionState === "within");
  return (
    <div className={`workflow-prediction ${inside ? "safe" : available ? "warning" : "missing"}`}>
      {inside ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}
      <div><strong>{available ? (inside ? t("predictionNotice") : t("predictionOutside")) : t("requiredMissing")}</strong><span>{locale === "ko" ? "현장 표준과 실제 분석값을 우선하십시오." : "Prioritize site standards and actual analysis."}</span></div>
    </div>
  );
}

export function WorkflowPanel({ heat, locale, rows, t, onAction, onAdvance, onEditInitial, writeLocked = false }) {
  const workflow = getStageWorkflow(heat, locale);
  const current = { ...workflow.current, heat };
  const next = workflow.nextStage;
  const ko = locale === "ko";
  const currentIsAdvance = current.kind === "advance";
  return (
    <section className="workflow-panel panel" aria-labelledby="workflow-title">
      <div className="workflow-current">
        <div className="workflow-eyebrow"><span>{ko ? "현재 해야 할 일" : "Do this now"}</span><b>{workflow.completedCount}/{workflow.totalCount}</b></div>
        <h2 id="workflow-title">{current.title}</h2>
        <p>{current.body}</p>
        <ActionButton step={current} onAction={onAction} onAdvance={onAdvance} onEditInitial={onEditInitial} locale={locale} writeLocked={writeLocked} />
        <div className="workflow-live" role="status" aria-live="polite">{ko ? `현재 단계 ${heat.stage}. ${current.title}` : `Current stage ${heat.stage}. ${current.title}`}</div>
      </div>

      <div className="workflow-checklist">
        <div className="workflow-eyebrow"><span>{ko ? "이 단계의 진행 순서" : "Stage sequence"}</span><b>{heat.stage}</b></div>
        <ol>
          {workflow.steps.map((step, index) => {
            const Icon = statusIcons[step.status] ?? Circle;
            return <li key={step.id} className={step.status}><Icon weight={step.status === "done" ? "fill" : "bold"} /><div><span>{index + 1}. {step.title}</span>{step.optional && <small>{ko ? "권장" : "Recommended"}</small>}</div></li>;
          })}
        </ol>
      </div>

      <div className="workflow-next">
        <PredictionNotice rows={rows} locale={locale} t={t} />
        <div className="workflow-transition-card">
          <span>{next ? (ko ? "다음 단계" : "Next stage") : (ko ? "진행 상태" : "Progress")}</span>
          <strong>{next ? `${next.code} ${ko ? next.labelKo : next.labelEn}` : (ko ? "작업 완료" : "Complete")}</strong>
          {heat.stage === "G6" && <p>{ko ? "출강 기록을 저장하면 G7로 자동 이동합니다." : "Saving the tap record automatically moves to G7."}</p>}
          {next && heat.stage !== "G6" && !currentIsAdvance && <StageControls heat={heat} locale={locale} onAdvance={onAdvance} variant="secondary" writeLocked={writeLocked} />}
          {heat.stage === "G8" && <p>{ko ? "모든 단계 이력이 로컬에 저장됐습니다." : "All stage history is saved locally."}</p>}
        </div>
        {heat.stage !== "G0" && <button type="button" className="workflow-edit-initial" onClick={onEditInitial} disabled={writeLocked}><PencilSimple />{ko ? "기초 입력값 확인·수정" : "Review initial inputs"}</button>}
      </div>
    </section>
  );
}
