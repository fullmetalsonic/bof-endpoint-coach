import { Truck, Flask, ClipboardText, CheckSquare, Wind, Drop } from "@phosphor-icons/react";

export function ActionBar({ t, onAction, availability }) {
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
      {actions.map(([id, key, Icon], index) => <button key={id} type="button" disabled={!availability[id]} onClick={() => onAction(id)}><span>{index + 1}</span><Icon weight="regular" /><strong>{t(key)}</strong></button>)}
    </div>
  );
}
