const labels = {
  required: { ko: "필수", en: "Required" },
  calculation: { ko: "계산 핵심", en: "Calculation" },
  recommended: { ko: "정확도 권장", en: "Recommended" },
  optional: { ko: "선택", en: "Optional" },
};

export function FieldLabel({ children, kind = "optional", locale = "ko" }) {
  return <span className="field-label-text"><span>{children}</span><small className={`field-kind ${kind}`} aria-hidden="true">{labels[kind]?.[locale === "ko" ? "ko" : "en"] ?? labels.optional.ko}</small></span>;
}
