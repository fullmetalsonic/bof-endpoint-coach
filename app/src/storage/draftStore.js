const PREFIX = "bof-endpoint-coach:draft:";
const DRAFT_SCHEMA = 1;

function storageAvailable() {
  return typeof localStorage !== "undefined";
}

export function loadDraft(key, baseVersion) {
  if (!storageAvailable()) return null;
  try {
    const parsed = JSON.parse(localStorage.getItem(`${PREFIX}${key}`));
    if (parsed?.schema !== DRAFT_SCHEMA || parsed.baseVersion !== baseVersion || !parsed.value) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveDraft(key, baseVersion, value) {
  if (!storageAvailable()) return false;
  try {
    localStorage.setItem(`${PREFIX}${key}`, JSON.stringify({ schema: DRAFT_SCHEMA, baseVersion, savedAt: new Date().toISOString(), value }));
    return true;
  } catch {
    return false;
  }
}

export function clearDraft(key) {
  if (!storageAvailable()) return;
  try {
    localStorage.removeItem(`${PREFIX}${key}`);
  } catch {
    // Draft cleanup must never block the operational save path.
  }
}
