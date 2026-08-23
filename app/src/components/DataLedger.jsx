import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { getOpenChecks } from "../domain/operationalGuidance.js";

function formatTime(value) {
  return value ? new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(new Date(value)) : "–";
}

function relativeAge(value, now, locale) {
  if (!value) return "–";
  const seconds = Math.max(0, Math.floor((new Date(now) - new Date(value)) / 1000));
  if (seconds < 60) return locale === "ko" ? `${seconds}초 전` : `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  return locale === "ko" ? `${minutes}분 전` : `${minutes}m ago`;
}

export function DataLedger({ heat, calculation, rows, saveStatus, t, locale }) {
  const latestAnalysis = [...heat.samples].filter((sample) => (sample.status ?? "active") === "active" && sample.analyzedAt).sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt))[0];
  const latestProcessEvent = [...(heat.events ?? []), ...(heat.stageHistory ?? [])].filter((record) => (record.status ?? "active") === "active").sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))[0];
  const latestAnalysisAt = latestAnalysis?.analyzedAt;
  const checks = getOpenChecks(heat, rows, locale);
  const storageLabels = {
    saved: locale === "ko" ? "저장 완료" : "Saved",
    saving: locale === "ko" ? "저장 중" : "Saving",
    stale: locale === "ko" ? "다른 창 변경 감지" : "Changed in another window",
    conflict: locale === "ko" ? "저장 충돌 · 입력 잠금" : "Conflict · input locked",
    error: locale === "ko" ? "저장 실패 · 입력 잠금" : "Save failed · input locked",
  };
  const inputBasis = calculation.inputMode === "incomplete"
    ? (locale === "ko" ? "계산 입력 부족" : "Calculation inputs incomplete")
    : calculation.usesPlannedValues ? t("plannedIncluded") : t("actualOnly");
  return (
    <aside className="data-ledger">
      <h2>{t("dataLedger")}</h2>
      <section className="ledger-card">
        <div className="ledger-heading"><strong>{t("freshness")}</strong></div>
        <dl>
          <div><dt>{t("processData")}</dt><dd>{formatTime(latestProcessEvent?.occurredAt)} <em>({relativeAge(latestProcessEvent?.occurredAt, calculation.calculatedAt, locale)})</em></dd></div>
          <div><dt>{t("sampleResult")}</dt><dd>{formatTime(latestAnalysisAt)} <em>({relativeAge(latestAnalysisAt, calculation.calculatedAt, locale)})</em></dd></div>
          <div><dt>{t("calculation")}</dt><dd>{formatTime(calculation.calculatedAt)} <em>({locale === "ko" ? "현재" : "now"})</em></dd></div>
          <div><dt>{locale === "ko" ? "로컬 저장" : "Local storage"}</dt><dd>{storageLabels[saveStatus] ?? saveStatus}</dd></div>
          <div><dt>{locale === "ko" ? "외부 연동" : "External link"}</dt><dd>{locale === "ko" ? "미연동 · 수동 입력" : "Not connected · manual"}</dd></div>
        </dl>
      </section>
      <section className="ledger-card">
        <div className="ledger-heading"><strong>{t("unresolved")} ({checks.length})</strong></div>
        <ul className="check-list">{checks.map((check) => <li key={check.text} className={check.severity}>{check.severity === "danger" ? <WarningCircle weight="fill" /> : <CheckCircle weight="fill" />}<span>{check.text}</span></li>)}</ul>
      </section>
      <section className="ledger-card calc-card">
        <div className="ledger-heading"><strong>{t("calculationInfo")}</strong></div>
        <dl>
          <div><dt>{t("formulaVersion")}</dt><dd>{calculation.formulaVersion ?? "–"}</dd></div>
          <div><dt>{t("coefficientVersion")}</dt><dd>{calculation.coefficient?.versionId ?? calculation.coefficient?.id ?? "–"}</dd></div>
          <div><dt>{t("coefficientBasis")}</dt><dd>{locale === "ko" ? calculation.basis?.labelKo : calculation.basis?.labelEn}</dd></div>
          <div><dt>{t("literatureSources")}</dt><dd>{calculation.basis?.sourceIds?.join(", ") ?? "–"}</dd></div>
          <div><dt>{t("assumedInputs")}</dt><dd>{calculation.assumedInputs?.length ?? 0}</dd></div>
          <div><dt>{t("equipmentProfile")}</dt><dd>{calculation.equipment?.id ?? "–"}</dd></div>
          <div><dt>{t("calculatedAt")}</dt><dd>{formatTime(calculation.calculatedAt)}</dd></div>
        </dl>
        <div className={`input-basis ${calculation.basis?.status ?? ""}`}>{inputBasis} · {locale === "ko" ? calculation.basis?.labelKo : calculation.basis?.labelEn}</div>
      </section>
    </aside>
  );
}
