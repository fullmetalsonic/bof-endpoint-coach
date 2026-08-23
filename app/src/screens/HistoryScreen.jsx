import { useMemo, useState } from "react";
import { calculateEndpoint, qualityRows } from "../calculation/endpoint.js";
import { canDeleteHeat } from "../domain/heatOperations.js";
import { getOpenChecks } from "../domain/operationalGuidance.js";

const PAGE_SIZE = 25;

function statusText(status, locale) {
  const labels = {
    in_progress: ["진행 중", "In progress"], tapped: ["출강 후", "Tapped"], completed: ["완료", "Completed"], cancelled: ["취소", "Cancelled"], archived: ["보관", "Archived"],
  };
  return labels[status]?.[locale === "ko" ? 0 : 1] ?? status;
}

function lastActivity(heat) {
  return [...(heat.events ?? []), ...(heat.stageHistory ?? []), ...(heat.samples ?? []).flatMap((sample) => [sample, ...(sample.analysisResults ?? [])])]
    .map((item) => item.recordedAt ?? item.occurredAt ?? item.analyzedAt ?? item.sampledAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b) - new Date(a))[0] ?? heat.startedAt;
}

function operatorNames(heat) {
  return [...(heat.events ?? []), ...(heat.stageHistory ?? []), ...(heat.samples ?? []).flatMap((sample) => [sample, ...(sample.analysisResults ?? [])])]
    .map((item) => item.recordedBy?.displayName)
    .filter(Boolean);
}

export function HistoryScreen({ state, locale, t, onSelect, onLifecycle, canWrite = true }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [grade, setGrade] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const ko = locale === "ko";
  const gradeCodes = useMemo(() => [...new Set(state.heats.map((heat) => heat.gradeCode))].sort(), [state.heats]);
  const rows = useMemo(() => state.heats.map((heat) => {
    const calculation = calculateEndpoint(heat, state.settings);
    return { heat, calculation, activityAt: lastActivity(heat), operators: operatorNames(heat), checks: getOpenChecks(heat, qualityRows(heat, state.settings, calculation), locale) };
  }).filter((row) => {
    const needle = query.trim().toLocaleLowerCase();
    const matchesQuery = !needle || [row.heat.id, row.heat.gradeCode, ...row.operators].some((value) => String(value).toLocaleLowerCase().includes(needle));
    const started = new Date(row.heat.startedAt);
    const afterStart = !fromDate || started >= new Date(`${fromDate}T00:00:00`);
    const beforeEnd = !toDate || started <= new Date(`${toDate}T23:59:59.999`);
    return matchesQuery && (status === "all" || row.heat.status === status) && (grade === "all" || row.heat.gradeCode === grade) && afterStart && beforeEnd;
  }).sort((a, b) => sort === "heat" ? a.heat.id.localeCompare(b.heat.id) : sort === "stage" ? a.heat.stage.localeCompare(b.heat.stage) : sort === "risk" ? b.checks.filter((check) => check.severity === "danger").length - a.checks.filter((check) => check.severity === "danger").length || b.checks.length - a.checks.length || new Date(b.activityAt) - new Date(a.activityAt) : new Date(b.activityAt) - new Date(a.activityAt)), [fromDate, grade, locale, query, sort, state.heats, state.settings, status, toDate]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const changeFilter = (setter) => (event) => { setter(event.target.value); setPage(1); };
  return (
    <main className="workspace-screen history-screen" data-testid="history-screen">
      <div className="workspace-heading"><div><span>Data Ledger</span><h1>{t("historyTitle")}</h1><p>{ko ? "완료·진행 차지의 입력, 확인 필요 항목과 계산 기준을 검색합니다." : "Search active and completed heats, open checks, and calculation references."}</p></div></div>
      <section className="history-toolbar panel" aria-label={ko ? "차지 이력 검색과 필터" : "Heat history search and filters"}>
        <label><span>{ko ? "검색" : "Search"}</span><input type="search" value={query} onChange={changeFilter(setQuery)} placeholder={ko ? "차지 번호·강종·작업자" : "Heat, grade, or operator"} /></label>
        <label><span>{t("status")}</span><select value={status} onChange={changeFilter(setStatus)}><option value="all">{ko ? "전체 상태" : "All statuses"}</option>{["in_progress", "tapped", "completed", "cancelled", "archived"].map((value) => <option key={value} value={value}>{statusText(value, locale)}</option>)}</select></label>
        <label><span>{t("grade")}</span><select value={grade} onChange={changeFilter(setGrade)}><option value="all">{ko ? "전체 강종" : "All grades"}</option>{gradeCodes.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>{ko ? "시작일(부터)" : "Started from"}</span><input type="date" value={fromDate} onChange={changeFilter(setFromDate)} /></label>
        <label><span>{ko ? "시작일(까지)" : "Started to"}</span><input type="date" value={toDate} onChange={changeFilter(setToDate)} /></label>
        <label><span>{ko ? "정렬" : "Sort"}</span><select value={sort} onChange={changeFilter(setSort)}><option value="recent">{ko ? "최근 입력순" : "Latest activity"}</option><option value="risk">{ko ? "위험·확인 필요순" : "Risk and open checks"}</option><option value="heat">{ko ? "차지 번호순" : "Heat number"}</option><option value="stage">{ko ? "단계순" : "Stage"}</option></select></label>
        <strong>{ko ? `${rows.length}건` : `${rows.length} results`}</strong>
      </section>
      <section className="panel history-table"><div className="table-scroll"><table><thead><tr><th>{t("heatNo")}</th><th>{t("grade")}</th><th>{t("status")}</th><th>{t("stage")}</th><th>{ko ? "최근 입력" : "Last activity"}</th><th>{ko ? "확인 필요" : "Open checks"}</th><th>{ko ? "계산 기준" : "Reference"}</th><th>C</th><th>T</th><th>{t("details")}</th></tr></thead><tbody>{pageRows.map(({ heat, calculation, activityAt, checks }) => <tr key={heat.id}><td><strong>{heat.id}</strong></td><td>{heat.gradeCode}</td><td><span className={`status-pill ${heat.status}`}>{statusText(heat.status, locale)}</span></td><td>{heat.stage}</td><td>{new Date(activityAt).toLocaleString(ko ? "ko-KR" : "en-GB")}</td><td><span className={checks.some((check) => check.severity === "danger") ? "check-count danger" : "check-count"}>{checks.length}</span></td><td>{calculation.referenceMode === "demo_data" ? "DEMO DATA" : calculation.referenceMode === "demo_reference" ? "DEMO REF" : (ko ? calculation.basis?.labelKo : calculation.basis?.labelEn) ?? "–"}</td><td>{calculation.carbon.available ? `${calculation.carbon.value.toFixed(3)} %` : "–"}</td><td>{calculation.temperature.available ? `${calculation.temperature.value.toFixed(0)} °C` : "–"}</td><td><div className="history-actions"><button type="button" onClick={() => onSelect(heat.id)}>{t("details")}</button>{canDeleteHeat(heat) && <button type="button" disabled={!canWrite} className="danger-link" onClick={() => onLifecycle(heat, "delete")}>{ko ? "삭제" : "Delete"}</button>}{["in_progress", "tapped"].includes(heat.status) && !canDeleteHeat(heat) && <button type="button" disabled={!canWrite} className="danger-link" onClick={() => onLifecycle(heat, "cancel")}>{ko ? "취소" : "Cancel"}</button>}{["completed", "cancelled"].includes(heat.status) && <button type="button" disabled={!canWrite} onClick={() => onLifecycle(heat, "archive")}>{ko ? "보관" : "Archive"}</button>}</div></td></tr>)}{pageRows.length === 0 && <tr><td colSpan="10">{ko ? "조건에 맞는 차지가 없습니다." : "No heats match these filters."}</td></tr>}</tbody></table></div><div className="history-pagination"><button type="button" disabled={safePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{ko ? "이전" : "Previous"}</button><span>{safePage} / {pageCount}</span><button type="button" disabled={safePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))}>{ko ? "다음" : "Next"}</button></div></section>
    </main>
  );
}
