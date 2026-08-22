import { Truck, Flask, ClipboardText, CheckSquare, Wind, Drop } from "@phosphor-icons/react";

export function ActionBar({ t, onAction, availability, recommendedAction, locale }) {
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
        return <button key={id} type="button" className={recommended ? "recommended" : ""} disabled={!availability[id]} onClick={() => onAction(id)} aria-label={`${t(key)}${recommended ? (locale === "ko" ? " · 지금 입력" : " · enter now") : ""}`}><span>{index + 1}</span><Icon weight={recommended ? "bold" : "regular"} /><strong>{t(key)}</strong>{recommended && <em>{locale === "ko" ? "지금 입력" : "Enter now"}</em>}</button>;
      })}
    </div>
  );
}
