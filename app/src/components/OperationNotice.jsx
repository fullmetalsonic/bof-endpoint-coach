import { CheckCircle, X } from "@phosphor-icons/react";

export function OperationNotice({ notice, onClose, locale }) {
  if (!notice) return null;
  return (
    <div className="operation-notice" role="status" aria-live="polite">
      <CheckCircle weight="fill" />
      <div><strong>{locale === "ko" ? "기록 완료" : "Saved"}</strong><span>{notice.message}</span></div>
      <button type="button" onClick={onClose} aria-label={locale === "ko" ? "알림 닫기" : "Close notification"}><X /></button>
    </div>
  );
}
