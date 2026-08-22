import { CheckCircle, PlayCircle } from "@phosphor-icons/react";

const gates = [
  ["G0", "장입", "Charge"],
  ["G1", "송풍 시작", "Blow start"],
  ["G2", "용해 초기", "Early blow"],
  ["G3", "용해 중기", "Mid blow"],
  ["G4", "용해 후기", "Late blow"],
  ["G5", "정련", "Refining"],
  ["G6", "출강 검토", "Tap review"],
  ["G7", "출강", "Tap"],
  ["G8", "후처리", "Post-process"],
];

export function ProcessRail({ heat, locale, calculatedAt }) {
  const currentIndex = gates.findIndex(([id]) => id === heat.stage);
  const elapsedMinutes = Math.max(0, Math.floor((new Date(calculatedAt) - new Date(heat.startedAt)) / 60000));
  return (
    <aside className="process-rail" aria-label="Process gates">
      {gates.map(([id, ko, en], index) => {
        const complete = index < currentIndex;
        const active = index === currentIndex;
        return (
          <div className={`gate-card ${active ? "active" : ""}`} key={id}>
            <strong>{id}</strong>
            <span>{locale === "ko" ? ko : en}<small>{complete ? `${String(index * 3 + 2).padStart(2, "0")}:${String(index * 7 % 60).padStart(2, "0")}` : active ? `${String(elapsedMinutes).padStart(2, "0")}:00` : "–"}</small></span>
            {complete ? <CheckCircle weight="fill" /> : active ? <PlayCircle weight="fill" /> : null}
          </div>
        );
      })}
    </aside>
  );
}
