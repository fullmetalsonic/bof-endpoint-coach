import { useEffect, useRef } from "react";

const focusableSelector = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[href]",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function useDialogFocus({ onClose, closeOnEscape = true } = {}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const previousFocus = document.activeElement;
    const focusables = [...dialog.querySelectorAll(focusableSelector)];
    (focusables[0] ?? dialog).focus();

    function onKeyDown(event) {
      if (event.key === "Escape" && closeOnEscape && onCloseRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const current = [...dialog.querySelectorAll(focusableSelector)];
      if (current.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = current[0];
      const last = current.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [closeOnEscape]);

  return dialogRef;
}
