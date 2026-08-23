import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle, ClipboardText, WarningCircle } from "@phosphor-icons/react";
import { parseCoreRecoveryString } from "../../calibration/recoveryCardCodec.js";
import { RECOVERY_CARD_FIELDS, formatRecoveryValue } from "../../calibration/recoveryCardFields.js";
import { buildManualRecoveryProfile, validateManualCoefficientRecovery } from "../../domain/manualCoefficientRecovery.js";

const ERROR_LABELS = {
  recovery_check_code_mismatch: ["핵심 확인코드가 값과 일치하지 않습니다.", "The core check code does not match the values."],
  recovery_offsets_invalid: ["핵심 6개 값의 빈칸·숫자·범위를 확인하십시오.", "Check the six core values for blanks, numbers, and ranges."],
  recovery_check_code_missing: ["핵심 확인코드를 입력하십시오.", "Enter the core check code."],
  profile_id_mismatch: ["카드의 계수 프로필 ID가 복구 대상과 다릅니다.", "The card profile ID differs from the recovery target."],
  formula_version_mismatch: ["계산식 버전이 달라 안전하게 적용할 수 없습니다.", "The formula version differs, so the offsets cannot be applied safely."],
  base_fingerprint_mismatch: ["28개 실제 적용 기준값의 지문이 다릅니다. JSON 전체 백업이 필요합니다.", "The 28-value base fingerprint differs. A full JSON backup is required."],
  operator_missing: ["복구 작업자 이름을 입력하십시오.", "Enter the recovery operator name."],
  reason_too_short: ["복구 사유를 3자 이상 입력하십시오.", "Enter a recovery reason of at least three characters."],
  detail_incomplete: ["상세 참고값은 한 성분의 3개 값을 모두 입력하거나 모두 비워야 합니다.", "Enter all three detailed values for an item or leave all three blank."],
  detail_equation_mismatch: ["추천 후보값이 학습 당시값 + 추천 증감과 일치하지 않습니다.", "Candidate offset does not equal learning current plus recommended delta."],
  detail_out_of_range: ["상세 참고값의 허용 범위를 확인하십시오.", "Check the detailed reference-value range."],
  target_profile_missing: ["복구 대상 계수 프로필을 선택하십시오.", "Select a target coefficient profile."],
};

function blankOffsets() {
  return Object.fromEntries(RECOVERY_CARD_FIELDS.map((field) => [field.key, ""]));
}
function blankDetails() {
  return RECOVERY_CARD_FIELDS.map((field) => ({ element: field.key, currentOffset: "", recommendedDelta: "", candidateOffset: "" }));
}

function fieldLabel(field, locale) {
  return locale === "ko" ? field.labelKo : field.labelEn;
}

export function RecoveryCardForm({ profiles, operatorName, locale, canWrite, onApply }) {
  const ko = locale === "ko";
  const [targetProfileId, setTargetProfileId] = useState(profiles[0]?.id ?? "");
  const [recoveryText, setRecoveryText] = useState("");
  const [core, setCore] = useState({ profileId: "", coefficientVersionId: "", formulaVersion: "", baseFingerprint: "", checkCode: "", offsets: blankOffsets() });
  const [detailRows, setDetailRows] = useState(blankDetails);
  const [enteredBy, setEnteredBy] = useState(operatorName ?? "");
  const [reason, setReason] = useState("");
  const [parseMessage, setParseMessage] = useState(null);
  const [review, setReview] = useState(null);
  const [reviewSignature, setReviewSignature] = useState("");
  const [busy, setBusy] = useState(false);
  const targetProfile = profiles.find((profile) => profile.id === targetProfileId);
  const signature = useMemo(() => JSON.stringify({ targetProfileId, core, detailRows, enteredBy, reason }), [targetProfileId, core, detailRows, enteredBy, reason]);
  const reviewCurrent = review?.valid && reviewSignature === signature;

  function invalidateReview() {
    setReview(null);
    setReviewSignature("");
  }

  function updateCore(key, value) {
    invalidateReview();
    setCore((previous) => ({ ...previous, [key]: value }));
  }

  function updateOffset(key, value) {
    invalidateReview();
    setCore((previous) => ({ ...previous, offsets: { ...previous.offsets, [key]: value } }));
  }

  function updateDetail(element, key, value) {
    invalidateReview();
    setDetailRows((previous) => previous.map((row) => row.element === element ? { ...row, [key]: value } : row));
  }

  function parseText() {
    invalidateReview();
    try {
      const parsed = parseCoreRecoveryString(recoveryText);
      setCore({
        profileId: parsed.profileId,
        coefficientVersionId: parsed.coefficientVersionId,
        formulaVersion: parsed.formulaVersion,
        baseFingerprint: parsed.baseFingerprint,
        checkCode: parsed.checkCode,
        offsets: Object.fromEntries(RECOVERY_CARD_FIELDS.map((field) => [field.key, String(parsed.offsets[field.key])])),
      });
      setTargetProfileId(profiles.some((profile) => profile.id === parsed.profileId) ? parsed.profileId : targetProfileId);
      setParseMessage({ type: "success", text: ko ? "복구문자열을 6개 핵심값과 식별정보로 나눴습니다." : "The recovery string was split into identity and six core values." });
    } catch (error) {
      setParseMessage({ type: "error", text: ko ? `복구문자열 형식을 확인하십시오. (${error.message})` : `Check the recovery-string format. (${error.message})` });
    }
  }

  async function validateAndCompare() {
    setBusy(true);
    const result = await validateManualCoefficientRecovery({ targetProfile, coreInput: core, detailRows, operatorName: enteredBy, reason });
    setReview(result);
    setReviewSignature(signature);
    setBusy(false);
  }

  function apply() {
    if (!reviewCurrent) return;
    const profile = buildManualRecoveryProfile(targetProfile, review, { operatorName: enteredBy, reason });
    onApply({ profileId: targetProfile.id, profile, reason: `${ko ? "비상복구 카드 수동 복구" : "Manual emergency-card recovery"}: ${reason.trim()}` });
  }

  return <div className="recovery-manual-form" data-testid="recovery-manual-form">
    <div className="recovery-manual-intro"><WarningCircle weight="fill" /><div><strong>{ko ? "핵심 6개만 종점예상에 적용됩니다." : "Only the six core values affect endpoint estimates."}</strong><span>{ko ? "상세 18개를 입력해도 과거 차지·오차·학습 근거를 만들지 않습니다. 계산식과 기준지문이 모두 일치해야 계수 초안으로 옮길 수 있습니다." : "The optional 18 values do not recreate heats, residuals, or learning evidence. Formula and base fingerprint must both match before creating a coefficient draft."}</span></div></div>

    <section className="recovery-form-section"><div className="recovery-form-heading"><span>1</span><div><h4>{ko ? "복구문자열 붙여넣기 또는 수기 입력" : "Paste a recovery string or enter the card by hand"}</h4><p>{ko ? "스크린샷에 한 줄 문자열이 있으면 붙여넣기가 가장 빠릅니다." : "Pasting the one-line string from a screenshot is fastest."}</p></div></div>
      <label className="recovery-string-input"><span>{ko ? "핵심 복구문자열" : "Core recovery string"}</span><textarea rows="3" value={recoveryText} onChange={(event) => { setRecoveryText(event.target.value); setParseMessage(null); }} placeholder="BOFRC1|PROFILE=…|CHECK=…" /></label>
      <button type="button" className="secondary-button recovery-parse-button" disabled={!recoveryText.trim()} onClick={parseText}><ClipboardText />{ko ? "문자열 나누기" : "Parse string"}</button>
      {parseMessage && <p className={`recovery-parse-message ${parseMessage.type}`} role="status">{parseMessage.text}</p>}
      <div className="recovery-identity-grid">
        <label><span>{ko ? "복구 대상 프로필" : "Target profile"}</span><select value={targetProfileId} onChange={(event) => { invalidateReview(); setTargetProfileId(event.target.value); }}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{ko ? profile.nameKo : profile.nameEn} · {profile.id}</option>)}</select></label>
        <label><span>{ko ? "카드 프로필 ID" : "Card profile ID"}</span><input value={core.profileId} onChange={(event) => updateCore("profileId", event.target.value)} /></label>
        <label><span>{ko ? "카드 계수 버전" : "Card coefficient version"}</span><input value={core.coefficientVersionId} onChange={(event) => updateCore("coefficientVersionId", event.target.value)} /></label>
        <label><span>{ko ? "계산식 버전" : "Formula version"}</span><input value={core.formulaVersion} onChange={(event) => updateCore("formulaVersion", event.target.value)} /></label>
        <label><span>{ko ? "기준지문 12자리" : "12-character base fingerprint"}</span><input maxLength="12" value={core.baseFingerprint} onChange={(event) => updateCore("baseFingerprint", event.target.value.toUpperCase())} /></label>
        <label><span>{ko ? "핵심 확인코드 8자리" : "8-character core check code"}</span><input maxLength="8" value={core.checkCode} onChange={(event) => updateCore("checkCode", event.target.value.toUpperCase())} /></label>
      </div>
      <div className="recovery-core-input-grid">{RECOVERY_CARD_FIELDS.map((field) => <label key={field.key}><span>{fieldLabel(field, locale)} <small>{field.unit}</small></span><input aria-label={`recovery-${field.key}`} type="number" step={field.step} value={core.offsets[field.key]} onChange={(event) => updateOffset(field.key, event.target.value)} /></label>)}</div>
    </section>

    <details className="recovery-detail-input"><summary>{ko ? "선택: 상세 학습 참고값 18개 입력" : "Optional: enter 18 detailed learning-reference values"}</summary><p>{ko ? "한 성분을 입력하려면 3개 값을 모두 입력하십시오. 비워 두어도 핵심 6개 복구에는 영향이 없습니다." : "Enter all three values for an item. Leaving them blank does not affect recovery of the six core values."}</p><div className="table-scroll"><table><thead><tr><th>{ko ? "성분" : "Item"}</th><th>{ko ? "학습 당시값" : "Learning current"}</th><th>{ko ? "추천 증감" : "Recommended delta"}</th><th>{ko ? "추천 후보값" : "Candidate"}</th><th>{ko ? "단위" : "Unit"}</th></tr></thead><tbody>{detailRows.map((row) => { const field = RECOVERY_CARD_FIELDS.find((item) => item.key === row.element); return <tr key={row.element}><th>{fieldLabel(field, locale)}</th>{["currentOffset", "recommendedDelta", "candidateOffset"].map((key) => <td key={key}><input aria-label={`recovery-detail-${row.element}-${key}`} type="number" step={field.step} value={row[key]} onChange={(event) => updateDetail(row.element, key, event.target.value)} /></td>)}<td>{field.unit}</td></tr>; })}</tbody></table></div></details>

    <section className="recovery-form-section"><div className="recovery-form-heading"><span>2</span><div><h4>{ko ? "작업자·사유와 적용 전 비교" : "Operator, reason, and pre-apply comparison"}</h4><p>{ko ? "검사 결과가 바뀌지 않은 경우에만 초안 반영 버튼이 활성화됩니다." : "The draft button is enabled only while the validated input remains unchanged."}</p></div></div><div className="recovery-operator-grid"><label><span>{ko ? "복구 작업자" : "Recovery operator"}</span><input value={enteredBy} onChange={(event) => { invalidateReview(); setEnteredBy(event.target.value); }} /></label><label><span>{ko ? "복구 사유" : "Recovery reason"}</span><input value={reason} onChange={(event) => { invalidateReview(); setReason(event.target.value); }} placeholder={ko ? "예: PC 초기화 후 종이 카드 복구" : "e.g. Paper-card recovery after PC reset"} /></label></div>
      <button type="button" className="primary-button recovery-review-button" disabled={busy} onClick={validateAndCompare}>{busy ? (ko ? "검사 중…" : "Validating…") : (ko ? "값 검사하고 현재 계수와 비교" : "Validate and compare with current offsets")}</button>
      {review && !review.valid && <div className="recovery-validation-errors" role="alert"><strong>{ko ? "복구값을 적용할 수 없습니다." : "The recovery values cannot be applied."}</strong><ul>{review.errors.map((error, index) => <li key={`${error.code}-${error.field ?? index}`}>{ERROR_LABELS[error.code]?.[ko ? 0 : 1] ?? error.code}{error.field ? ` · ${error.field}` : ""}</li>)}</ul></div>}
      {review?.valid && <div className="recovery-compare-result"><div className="recovery-compare-ok"><CheckCircle weight="fill" /><div><strong>{ko ? "식별정보·확인코드·값 검사를 통과했습니다." : "Identity, check code, and values passed validation."}</strong><span>{ko ? "아래 값은 아직 적용 전입니다. 초안 반영 후 설정 저장까지 해야 새 차지에 사용됩니다." : "Nothing is applied yet. After moving to the draft, save settings to use it for new heats."}</span></div></div><div className="table-scroll"><table><thead><tr><th>{ko ? "성분" : "Item"}</th><th>{ko ? "현재" : "Current"}</th><th></th><th>{ko ? "복구값" : "Recovered"}</th><th>{ko ? "차이" : "Difference"}</th><th>{ko ? "단위" : "Unit"}</th></tr></thead><tbody>{review.comparison.map((row) => <tr key={row.key}><th>{fieldLabel(row, locale)}</th><td>{formatRecoveryValue(row.current, row.key, { signed: true })}</td><td><ArrowRight /></td><td><strong>{formatRecoveryValue(row.recovered, row.key, { signed: true })}</strong></td><td>{formatRecoveryValue(row.delta, row.key, { signed: true })}</td><td>{row.unit}</td></tr>)}</tbody></table></div></div>}
    </section>

    <div className="recovery-apply-bar"><div><strong>{ko ? "기존 계수를 덮어쓰지 않습니다." : "The current coefficient is not overwritten."}</strong><span>{ko ? "새 설정 초안으로 복사한 뒤 기존 설정 저장 절차에서 새 계수 버전을 만듭니다." : "Values are copied to a settings draft, then saved as a new coefficient version through the normal settings flow."}</span></div><button type="button" className="primary-button" disabled={!canWrite || !reviewCurrent} onClick={apply}>{ko ? "검증된 값을 계수 초안에 반영" : "Apply verified values to coefficient draft"}</button></div>
  </div>;
}
