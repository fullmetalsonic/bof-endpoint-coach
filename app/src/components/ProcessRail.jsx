import { ArrowRight, CheckCircle, PlayCircle } from "@phosphor-icons/react";
import { PROCESS_STAGES } from "../domain/processStages.js";

function formatTime(value, locale) {
  return value ? new Intl.DateTimeFormat(locale === "ko" ? "ko-KR" : "en-GB", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "–";
}

export function ProcessRail({ heat, locale }) {
  const currentIndex = PROCESS_STAGES.findIndex((stage) => stage.code === heat.stage);
  return (
    <aside className="process-rail" aria-label="Process gates">
      {PROCESS_STAGES.map(({ code: id, labelKo: ko, labelEn: en }, index) => {
        const complete = index < currentIndex;
        const active = index === currentIndex;
        const next = index === currentIndex + 1;
        const transition = [...(heat.stageHistory ?? [])].reverse().find((entry) => (entry.status ?? "active") === "active" && entry.to === id);
        return (
          <div className={`gate-card ${active ? "active" : ""} ${next ? "next" : ""}`} key={id}>
            <strong>{id}</strong>
            <span>{locale === "ko" ? ko : en}<small>{next ? (locale === "ko" ? "다음 단계" : "Next stage") : formatTime(transition?.occurredAt, locale)}</small></span>
            {complete ? <CheckCircle weight="fill" /> : active ? <PlayCircle weight="fill" /> : next ? <ArrowRight weight="bold" /> : null}
          </div>
        );
      })}
    </aside>
  );
}
