import { ArrowCounterClockwise, ClockCounterClockwise, Lifebuoy } from "@phosphor-icons/react";
import { restoreCoefficientVersion } from "../../domain/coefficientVersions.js";

const OFFSET_FIELDS = Object.freeze([
  ["C", "C", "%", 0.001], ["temperature", "온도", "°C", 1], ["P", "P", "%", 0.001],
  ["Mn", "Mn", "%", 0.001], ["Si", "Si", "%", 0.001], ["S", "S", "%", 0.001],
]);

function dateTime(value, locale) {
  return value ? new Date(value).toLocaleString(locale === "ko" ? "ko-KR" : "en-GB") : "–";
}

export function CoefficientCalibrationEditor({ profile, updateProfile, locale, candidate, onOpenRecoveryCard }) {
  function updateOffset(key, value) {
    updateProfile((previous) => ({
      ...previous,
      calibrationOffsets: { ...(previous.calibrationOffsets ?? {}), [key]: value === "" ? 0 : Number(value) },
      manualRecoverySource: null,
      recommendationSource: null,
      modifiedAt: new Date().toISOString(),
    }));
  }

  function restoreVersion(versionId) {
    updateProfile((previous) => restoreCoefficientVersion(previous, versionId) ?? previous);
  }

  return (
    <section className="coefficient-calibration" aria-labelledby="calibration-offset-title">
      <div className="subsection-heading">
        <div><h3 id="calibration-offset-title">{locale === "ko" ? "학습 보정 오프셋" : "Learning correction offsets"}</h3><p>{locale === "ko" ? "문헌 모델의 최종 예상값에 더하는 값입니다. 자동 적용되지 않으며 설정 저장 후 새 계수 버전이 됩니다." : "These values are added to the literature estimate. They are never auto-applied and create a new coefficient version when settings are saved."}</p></div>
        <div className="coefficient-version-actions"><span className="coefficient-version-id">{profile.versionId ?? "–"}</span><button type="button" className="secondary-button" onClick={onOpenRecoveryCard}><Lifebuoy />{locale === "ko" ? "비상복구 카드" : "Recovery card"}</button></div>
      </div>
      {candidate && <div className="candidate-draft-note" role="status"><strong>{locale === "ko" ? "추천 계수를 설정 초안으로 가져왔습니다." : "A recommended coefficient was added to this settings draft."}</strong><span>{candidate.element} · {candidate.currentOffset} → {candidate.candidateOffset.toFixed(candidate.element === "temperature" ? 1 : 5)} {candidate.unit} · {locale === "ko" ? "변경 사유를 입력하고 검토 후 저장하십시오." : "Review it, enter a change reason, then save."}</span></div>}
      <div className="calibration-offset-grid">{OFFSET_FIELDS.map(([key, ko, unit, step]) => <label key={key}><span>{locale === "ko" ? ko : key === "temperature" ? "Temperature" : key} <small>{key === "temperature" ? unit : "%p"}</small></span><input aria-label={`calibration-${key}`} type="number" step={step} value={profile.calibrationOffsets?.[key] ?? 0} onChange={(event) => updateOffset(key, event.target.value)} /></label>)}</div>
      <p className="settings-note calibration-unit-note">{locale === "ko" ? "%p는 상대 비율이 아니라 종점 성분의 질량백분율 값에 직접 더하는 퍼센트포인트입니다. 예: P 0.015% + 0.001%p = 0.016%." : "%p is a percentage-point offset added directly to endpoint mass percent, not a relative percentage. Example: P 0.015% + 0.001%p = 0.016%."}</p>
      <div className="coefficient-history-block">
        <div className="subsection-heading"><div><h3><ClockCounterClockwise /> {locale === "ko" ? "계수 버전 이력·복구" : "Coefficient history and restore"}</h3><p>{locale === "ko" ? "복구는 과거 기록을 덮어쓰지 않고 과거 값을 새 설정 초안으로 복사합니다." : "Restore copies old values into a new draft without overwriting history."}</p></div></div>
        <div className="table-scroll"><table><thead><tr><th>{locale === "ko" ? "버전" : "Version"}</th><th>{locale === "ko" ? "생성/보관 시각" : "Created / archived"}</th><th>{locale === "ko" ? "변경자" : "Operator"}</th><th>{locale === "ko" ? "사유" : "Reason"}</th><th>{locale === "ko" ? "동작" : "Action"}</th></tr></thead><tbody>
          <tr className="current-version-row"><td>{profile.versionId ?? "–"}</td><td>{dateTime(profile.createdAt, locale)}</td><td>{profile.approvedBy || "–"}</td><td>{locale === "ko" ? "현재 적용 중" : "Currently applied"}</td><td>–</td></tr>
          {[...(profile.versionHistory ?? [])].reverse().map((version) => <tr key={version.versionId}><td>{version.versionId}</td><td>{dateTime(version.archivedAt, locale)}</td><td>{version.archivedBy || "–"}</td><td>{version.changeReason || "–"}</td><td><button type="button" className="table-action" onClick={() => restoreVersion(version.versionId)}><ArrowCounterClockwise />{locale === "ko" ? "초안으로 복구" : "Restore to draft"}</button></td></tr>)}
          {(profile.versionHistory ?? []).length === 0 && <tr><td colSpan="5">{locale === "ko" ? "아직 보관된 과거 계수 버전이 없습니다." : "No archived coefficient versions yet."}</td></tr>}
        </tbody></table></div>
      </div>
    </section>
  );
}
