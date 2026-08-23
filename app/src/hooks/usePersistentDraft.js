import { useEffect, useState } from "react";
import { clearDraft, loadDraft, saveDraft } from "../storage/draftStore.js";

function copy(value) {
  return structuredClone(value);
}

export function usePersistentDraft(keyOrOptions, baseVersionArg, defaultsArg) {
  const options = typeof keyOrOptions === "object" ? keyOrOptions : { key: keyOrOptions, baseVersion: baseVersionArg, defaults: defaultsArg };
  const { key, baseVersion, defaults } = options;
  const [initial] = useState(() => {
    const found = loadDraft(key, baseVersion);
    return { value: copy(found?.value ?? defaults), baseline: JSON.stringify(defaults), restored: Boolean(found) };
  });
  const [value, setValue] = useState(initial.value);
  const [committedSnapshot, setCommittedSnapshot] = useState(initial.baseline);
  const dirty = JSON.stringify(value) !== committedSnapshot;

  useEffect(() => {
    if (dirty) saveDraft(key, baseVersion, value);
    else clearDraft(key);
  }, [baseVersion, dirty, key, value]);

  function commit() {
    const snapshot = JSON.stringify(value);
    setCommittedSnapshot(snapshot);
    clearDraft(key);
  }

  function discard() {
    clearDraft(key);
    setValue(copy(defaults));
    setCommittedSnapshot(JSON.stringify(defaults));
  }

  return { value, setValue, dirty, restored: initial.restored, commit, discard };
}
