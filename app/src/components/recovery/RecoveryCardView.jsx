import { CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { formatRecoveryValue } from "../../calibration/recoveryCardFields.js";

const STAGE_LABELS = {
  no_evidence: ["근거 없음", "No evidence"],
  synthetic_only: ["DEMO 전용", "DEMO only"],
  ledger_only: ["오차 기록", "Residual ledger"],
  bias_direction: ["편향 방향", "Bias direction"],
  provisional_candidate: ["임시 후보", "Provisional"],
  validation_set_pending: ["검증 대기", "Awaiting validation"],
  validation_ready: ["독립 검증 가능", "Validation ready"],
};

function groupLabel(group, locale) {
  if (!group) return locale === "ko" ? "학습 비교군 미선택" : "No learning group selected";
  return `${group.gradeCode} · ${group.equipmentProfileId} · ${group.mode}`;
}
export function RecoveryCardView({ snapshot, detailed, groups, groupKey, onGroupChange, locale }) {
  const ko = locale === "ko";
  if (!snapshot) return <div className="recovery-card-loading">{ko ? "복구 카드 확인코드를 계산하고 있습니다…" : "Calculating the recovery-card check code…"}</div>;
  return (
    <article className="recovery-card-sheet" data-testid="recovery-card-sheet">
      <header className="recovery-card-title">
        <div><span>BOF COEFFICIENT EMERGENCY RECOVERY CARD · {snapshot.cardVersion}</span><h3>{ko ? "보정계수 비상복구 카드" : "Coefficient emergency recovery card"}</h3></div>
        <div className="recovery-card-code"><span>{ko ? "핵심 확인코드" : "Core check code"}</span><strong>{snapshot.checkCode}</strong></div>
      </header>

      <dl className="recovery-card-meta">
        <div><dt>{ko ? "계수 프로필" : "Coefficient profile"}</dt><dd>{ko ? snapshot.profile.nameKo : snapshot.profile.nameEn}<small>{snapshot.profile.id}</small></dd></div>
        <div><dt>{ko ? "계수 버전" : "Coefficient version"}</dt><dd>{snapshot.profile.versionId}</dd></div>
        <div><dt>{ko ? "계산식 버전" : "Formula version"}</dt><dd>{snapshot.profile.formulaVersion}</dd></div>
        <div><dt>{ko ? "기준지문" : "Base fingerprint"}</dt><dd><code>{snapshot.baseFingerprint}</code><small>{ko ? "28개 실제 적용 기준값" : "28 effective base values"}</small></dd></div>
        <div><dt>{ko ? "생성 시각" : "Created"}</dt><dd>{new Date(snapshot.generatedAt).toLocaleString(ko ? "ko-KR" : "en-GB")}</dd></div>
        <div><dt>{ko ? "작업자" : "Operator"}</dt><dd>{snapshot.operatorName || (ko ? "미입력" : "Not set")}</dd></div>
      </dl>

      {detailed && <div className="recovery-card-group-select">
        <label><span>{ko ? "상세 학습 비교군" : "Detailed learning group"}</span><select value={groupKey} onChange={(event) => onGroupChange(event.target.value)}><option value="">{ko ? "비교군 없음 · 핵심값만" : "No group · core values only"}</option>{groups.map((group) => <option key={group.groupKey} value={group.groupKey}>{groupLabel(group, locale)} · {group.elementCount}/6</option>)}</select></label>
        <small>{snapshot.group ? snapshot.group.groupKey : (ko ? "후보값을 다른 강종·설비·계수 버전과 섞지 않습니다." : "Candidate values are never mixed across grade, equipment, or coefficient versions.")}</small>
      </div>}

      <div className="table-scroll recovery-card-table-wrap"><table className="recovery-card-table"><thead><tr><th>{ko ? "성분" : "Item"}</th><th>{ko ? "현재 적용(핵심)" : "Applied core"}</th>{detailed && <><th>{ko ? "학습 당시값" : "Learning current"}</th><th>{ko ? "추천 증감" : "Recommended delta"}</th><th>{ko ? "추천 후보값" : "Candidate"}</th></>}<th>{ko ? "단위" : "Unit"}</th>{detailed && <th>{ko ? "근거·상태" : "Evidence · status"}</th>}</tr></thead><tbody>
        {snapshot.rows.map((row) => <tr key={row.key} className={row.status === "missing" ? "recovery-missing-row" : ""}><th>{ko ? row.labelKo : row.labelEn}</th><td className="recovery-core-value">{formatRecoveryValue(row.appliedOffset, row.key, { signed: true })}</td>{detailed && <><td>{formatRecoveryValue(row.learningCurrentOffset, row.key, { signed: true })}</td><td>{formatRecoveryValue(row.recommendedDelta, row.key, { signed: true })}</td><td>{formatRecoveryValue(row.candidateOffset, row.key, { signed: true })}</td></>}<td>{row.unit}</td>{detailed && <td><span className={`recovery-evidence-status ${row.synthetic ? "synthetic" : row.status}`}>{row.status === "current" && !row.synthetic ? <CheckCircle weight="fill" /> : <WarningCircle weight="fill" />}{STAGE_LABELS[row.stage]?.[ko ? 0 : 1] ?? row.stage}</span><small>{row.evidenceCount ? `${row.evidenceCount}${ko ? "행" : " rows"} · ${row.heatCount}${ko ? "차지" : " heats"}` : "–"}</small></td>}</tr>)}
      </tbody></table></div>

      <div className="recovery-card-equation"><strong>{ko ? "복구 범위" : "Recovery boundary"}</strong><span>{ko ? "실제 적용에 필요한 값은 굵게 표시한 핵심 6개입니다. 상세 18개는 마지막 학습 상태를 사람이 참고하기 위한 값이며 원본 학습 데이터가 아닙니다." : "Only the six bold core values are required for application. The optional 18 values describe the last learning state and are not source training data."}</span></div>
      <div className="recovery-card-string"><span>{ko ? "핵심 복구문자열" : "Core recovery string"}</span><code>{snapshot.recoveryString}</code></div>
      <footer className="recovery-card-footer"><WarningCircle weight="fill" /><div><strong>{ko ? "JSON 전체 백업을 대체하지 않습니다." : "This does not replace a full JSON backup."}</strong><span>{ko ? "차지·샘플·종점 실측·오차 대장·학습 실행은 이 카드로 복구되지 않습니다. 현장 계수가 포함될 수 있으므로 공개 저장소나 승인되지 않은 외부 메일에 올리지 마십시오." : "Heats, samples, endpoint actuals, residuals, and training runs cannot be restored from this card. It may contain plant coefficients; do not post it publicly or send it through unapproved external mail."}</span></div></footer>
    </article>
  );
}
