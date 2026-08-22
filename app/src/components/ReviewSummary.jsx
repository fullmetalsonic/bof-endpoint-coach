import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { getStageGuidance } from "../domain/operationalGuidance.js";

export function ReviewSummary({ heat, locale, rows, t }) {
  const guidance = getStageGuidance(heat.stage, locale);
  const endpointRows = rows.filter((row) => ["C", "temperature"].includes(row.key));
  const available = endpointRows.every((row) => row.prediction.available);
  const inside = available && endpointRows.every((row) => row.predictionState === "within");
  return (
    <section className="review-summary panel">
      <div className="review-action">
        <span>{t("recommendation")}</span>
        <strong>{guidance.title}</strong>
        <p>{guidance.body}</p>
      </div>
      <div className="review-notes">
        <p>{inside ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />} {available ? (inside ? t("predictionNotice") : t("predictionOutside")) : t("requiredMissing")}</p>
        <p><WarningCircle weight="fill" /> {t("predictionCaution")}</p>
      </div>
    </section>
  );
}
