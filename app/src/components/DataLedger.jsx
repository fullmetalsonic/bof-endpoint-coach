import { ArrowClockwise, CheckCircle, WarningCircle } from "@phosphor-icons/react";
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
  const latest = [...heat.samples].sort((a, b) => new Date(b.sampledAt) - new Date(a.sampledAt))[0];
  const latestProcessEvent = [...heat.events].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))[0];
  const checks = getOpenChecks(heat, rows, locale);
  return (
    <aside className="data-ledger">
      <h2>{t("dataLedger")}</h2>
      <section className="ledger-card">
        <div className="ledger-heading"><strong>{t("freshness")}</strong><ArrowClockwise /></div>
        <dl>
          <div><dt>{t("processData")}</dt><dd>{formatTime(latestProcessEvent?.occurredAt)} <em>({relativeAge(latestProcessEvent?.occurredAt, calculation.calculatedAt, locale)})</em></dd></div>
          <div><dt>{t("sampleResult")}</dt><dd>{formatTime(latest?.sampledAt)} <em>({relativeAge(latest?.sampledAt, calculation.calculatedAt, locale)})</em></dd></div>
          <div><dt>{t("calculation")}</dt><dd>{formatTime(calculation.calculatedAt)} <em>({locale === "ko" ? "현재" : "now"})</em></dd></div>
          <div><dt>{t("equipmentState")}</dt><dd>{saveStatus === "saved" ? t("saved") : saveStatus}</dd></div>
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
          <div><dt>{t("coefficientVersion")}</dt><dd>{calculation.coefficient?.id ?? "–"}</dd></div>
          <div><dt>{t("coefficientBasis")}</dt><dd>{locale === "ko" ? calculation.basis?.labelKo : calculation.basis?.labelEn}</dd></div>
          <div><dt>{t("literatureSources")}</dt><dd>{calculation.basis?.sourceIds?.join(", ") ?? "–"}</dd></div>
          <div><dt>{t("assumedInputs")}</dt><dd>{calculation.assumedInputs?.length ?? 0}</dd></div>
          <div><dt>{t("equipmentProfile")}</dt><dd>{calculation.equipment?.id ?? "–"}</dd></div>
          <div><dt>{t("calculatedAt")}</dt><dd>{formatTime(calculation.calculatedAt)}</dd></div>
        </dl>
        <div className={`input-basis ${calculation.basis?.status ?? ""}`}>{calculation.usesPlannedValues ? t("plannedIncluded") : t("actualOnly")} · {locale === "ko" ? calculation.basis?.labelKo : calculation.basis?.labelEn}</div>
      </section>
    </aside>
  );
}
