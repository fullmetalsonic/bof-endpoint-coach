import { useCallback, useEffect, useState } from "react";

export function useOperationNotice() {
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 4200);
    return () => clearTimeout(timer);
  }, [notice]);

  const showNotice = useCallback((message) => {
    setNotice({ id: crypto.randomUUID(), message });
  }, []);

  return { notice, showNotice, clearNotice: () => setNotice(null) };
}
