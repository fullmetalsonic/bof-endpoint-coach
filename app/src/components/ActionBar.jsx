import { Truck, Flask, ClipboardText, CheckSquare, Wind, Drop } from "@phosphor-icons/react";

const availabilityNotes = {
  material: { ko: "G0~G5·G7", en: "G0–G5 · G7" },
  sample: { ko: "G2~G7", en: "G2–G7" },
  analysis: { ko: "G2~G7·샘플 후", en: "G2–G7 · after sample" },
  checkpoint: { ko: "G1~G6", en: "G1–G6" },
  reblow: { ko: "G5~G6", en: "G5–G6" },
  tap: { ko: "G6 전용", en: "G6 only" },
};

export function ActionBar({ t, onAction, availability, recommendedAction, locale, writeLocked = false }) {
  const actions = [
    ["material", "materialEvent", Truck],
    ["sample", "sampleEvent", Flask],
    ["analysis", "analysisEvent", ClipboardText],
    ["checkpoint", "checkpointEvent", CheckSquare],
    ["reblow", "reblowEvent", Wind],
    ["tap", "tapEvent", Drop],
  ];
  return (
    <div className="action-bar">
      {actions.map(([id, key, Icon], index) => {
        const recommended = recommendedAction === id && availability[id];
        const unavailable = writeLocked || !availability[id];
        const note = writeLocked ? (locale === "ko" ? "저장 복구 필요" : "Restore storage") : availabilityNotes[id][locale === "ko" ? "ko" : "en"];
        return <button key={id} type="button" className={recommended ? "recommended" : ""} disabled={unavailable} onClick={() => onAction(id)} aria-label={`${t(key)}${recommended ? (locale === "ko" ? " · 지금 입력" : " · enter now") : unavailable ? ` · ${note}` : ""}`}><span>{index + 1}</span><Icon weight={recommended ? "bold" : "regular"} /><strong>{t(key)}</strong>{recommended && <em>{locale === "ko" ? "지금 입력" : "Enter now"}</em>}{unavailable && <em className="availability-note">{note}</em>}</button>;
      })}
    </div>
  );
}
