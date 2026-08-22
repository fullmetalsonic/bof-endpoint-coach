import { useMemo } from "react";
import { COEFFICIENT_FIELDS, coefficientBasisLabel, resolveCoefficientProfile } from "../../calculation/coefficientProfile.js";

function valueOrBlank(value) {
  return value === null || value === undefined ? "" : value;
}

export function CoefficientProfilesEditor({ draft, setDraft, locale }) {
  const profile = draft.coefficientProfiles[0];
  const resolved = useMemo(() => resolveCoefficientProfile(profile), [profile]);
  const updateProfile = (updater) => setDraft((previous) => ({
    ...previous,
    coefficientProfiles: [updater(previous.coefficientProfiles[0]), ...previous.coefficientProfiles.slice(1)],
  }));

  function updateOverride(key, rawValue) {
    updateProfile((previous) => {
      const overrideValues = { ...(previous.overrideValues ?? {}) };
      if (rawValue === "") delete overrideValues[key];
      else overrideValues[key] = Number(rawValue);
      return {
        ...previous,
        overrideValues,
        overrideStatus: Object.keys(overrideValues).length ? "user_modified" : "none",
        approvedBy: "",
        approvalReason: "",
        approvedAt: null,
        modifiedAt: new Date().toISOString(),
      };
    });
  }

  function updateStatus(status) {
    updateProfile((previous) => ({
      ...previous,
      overrideStatus: status,
      approvedAt: status === "site_approved" ? new Date().toISOString() : null,
    }));
  }

  function updateMetadata(key, value) {
    updateProfile((previous) => ({ ...previous, [key]: value }));
  }

  function clearOverrides() {
    updateProfile((previous) => ({
      ...previous,
      overrideValues: {},
      overrideStatus: "none",
      approvedBy: "",
      approvalReason: "",
      approvedAt: null,
      modifiedAt: new Date().toISOString(),
    }));
  }

  const hasOverrides = resolved.overrideFields.length > 0;
  return (
    <div className="coefficient-editor">
      <div className="coefficient-heading">
        <div><h2>{locale === "ko" ? "계산 · 보정 계수" : "Calculation · correction"} <small>{profile.id}</small></h2><p>{locale === "ko" ? "문헌값은 원본으로 보존되며, 입력한 수정값이 실제 계산에 우선 적용됩니다." : "Literature values remain read-only; entered overrides are used by the calculation."}</p></div>
        <span className={`basis-status ${resolved.status}`}>{coefficientBasisLabel(resolved.status, locale)}</span>
      </div>
      <div className="settings-warning">
        {locale === "ko" ? "문헌 시나리오는 공개 자료 기반의 시작점이며 현장 정확도가 검증된 값은 아닙니다. 승인 전 수정값도 계산에는 사용되지만 '미승인'으로 표시됩니다." : "The literature scenario is a public-source starting point, not a plant-validated model. Unapproved overrides are used but clearly marked as unapproved."}
      </div>
      <div className="coefficient-control-row">
        <label><span>{locale === "ko" ? "수정값 상태" : "Override status"}</span><select value={hasOverrides ? profile.overrideStatus : "none"} disabled={!hasOverrides} onChange={(event) => updateStatus(event.target.value)}><option value="none">{locale === "ko" ? "문헌 기본" : "Literature base"}</option><option value="user_modified">{locale === "ko" ? "사용자 수정 · 미승인" : "User modified · unapproved"}</option><option value="site_approved">{locale === "ko" ? "현장 승인값" : "Site approved"}</option></select></label>
        <label><span>{locale === "ko" ? "승인자/역할" : "Approver / role"}</span><input value={profile.approvedBy ?? ""} disabled={profile.overrideStatus !== "site_approved"} onChange={(event) => updateMetadata("approvedBy", event.target.value)} placeholder={locale === "ko" ? "예: 취련 책임자" : "e.g. BOF supervisor"} /></label>
        <label className="approval-reason"><span>{locale === "ko" ? "승인 근거·사유" : "Approval basis / reason"}</span><input value={profile.approvalReason ?? ""} disabled={profile.overrideStatus !== "site_approved"} onChange={(event) => updateMetadata("approvalReason", event.target.value)} /></label>
        <button className="secondary-button" type="button" disabled={!hasOverrides} onClick={clearOverrides}>{locale === "ko" ? "수정값 전체 지우기" : "Clear overrides"}</button>
      </div>
      <div className="coefficient-table-wrap">
        <table className="coefficient-table">
          <thead><tr><th>{locale === "ko" ? "항목" : "Item"}</th><th>{locale === "ko" ? "문헌 원본" : "Literature original"}</th><th>{locale === "ko" ? "현장 수정값" : "Site override"}</th><th>{locale === "ko" ? "실제 적용값" : "Effective value"}</th><th>{locale === "ko" ? "근거" : "Sources"}</th></tr></thead>
          <tbody>{COEFFICIENT_FIELDS.map((field) => {
            const override = profile.overrideValues?.[field.key];
            const overridden = override !== undefined && override !== null && override !== "";
            return <tr key={field.key} className={overridden ? "overridden" : ""}>
              <th><strong>{locale === "ko" ? field.labelKo : field.labelEn}</strong><span>{field.unit}</span></th>
              <td>{profile.literatureValues[field.key]}</td>
              <td><input aria-label={`${field.key}-override`} type="number" step={field.step} value={valueOrBlank(override)} onChange={(event) => updateOverride(field.key, event.target.value)} placeholder={locale === "ko" ? "문헌값 사용" : "Use literature"} /></td>
              <td><strong>{resolved.effectiveValues[field.key]}</strong>{overridden && <small>{locale === "ko" ? "수정" : "override"}</small>}</td>
              <td>{field.sourceIds.join(", ")}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <p className="coefficient-source-note">{locale === "ko" ? "근거 ID의 상세 서지정보와 적용 경계는 docs/research 카탈로그에 기록되어 있습니다." : "Full citations and applicability limits for each source ID are recorded in the docs/research catalog."}</p>
    </div>
  );
}
