const guidance = {
  G0: {
    ko: ["장입값 확인", "용선·스크랩·부원료의 중량과 단위를 확인하십시오."],
    en: ["Verify charge inputs", "Confirm hot metal, scrap, flux weights, and units."],
  },
  G1: {
    ko: ["송풍 시작 조건 확인", "시작 시각, 초기 산소량, 랜스 조건을 기록하십시오."],
    en: ["Verify blow-start conditions", "Record start time, initial oxygen, and lance conditions."],
  },
  G2: {
    ko: ["초기 체크포인트 확인", "누적 산소와 랜스 조건의 실제값을 갱신하십시오."],
    en: ["Check the early checkpoint", "Update actual cumulative oxygen and lance conditions."],
  },
  G3: {
    ko: ["중간 체크포인트 확인", "중간 샘플과 누적 산소를 입력해 종점 예상을 다시 확인하십시오."],
    en: ["Check the mid-blow checkpoint", "Enter the mid-blow sample and oxygen total, then review the endpoint estimate."],
  },
  G4: {
    ko: ["후기 샘플 채취", "후기 성분·온도와 조업 조건을 입력해 예상 편차를 확인하십시오."],
    en: ["Take a late-blow sample", "Enter late-blow chemistry, temperature, and operating conditions."],
  },
  G5: {
    ko: ["최종 분석 확인", "최종 성분·온도 분석과 목표 범위를 대조하십시오."],
    en: ["Confirm final analysis", "Compare final chemistry and temperature with their targets."],
  },
  G6: {
    ko: ["출강 전 최종 샘플 채취", "최종 성분을 확인한 뒤 출강 여부를 결정하십시오."],
    en: ["Take final pre-tap sample", "Confirm final chemistry before deciding whether to tap."],
  },
  G7: {
    ko: ["출강 실적 기록", "출강 시각과 실제 종점 성분·온도를 기록하십시오."],
    en: ["Record tap results", "Record tap time and actual endpoint chemistry and temperature."],
  },
  G8: {
    ko: ["후처리 결과 기록", "후처리 투입과 최종 결과를 차지 이력에 남기십시오."],
    en: ["Record post-treatment", "Add post-treatment inputs and final results to the heat history."],
  },
};

const elementNames = {
  ko: { C: "탄소", temperature: "온도", P: "인", Mn: "망간", Si: "규소", S: "황" },
  en: { C: "Carbon", temperature: "Temperature", P: "Phosphorus", Mn: "Manganese", Si: "Silicon", S: "Sulfur" },
};

export function getStageGuidance(stage, locale = "ko") {
  const [title, body] = (guidance[stage] ?? guidance.G0)[locale] ?? guidance.G0.ko;
  return { title, body };
}

export function getOpenChecks(heat, rows, locale = "ko") {
  const checks = [];
  if (["G5", "G6"].includes(heat.stage)) {
    checks.push({
      severity: "warning",
      text: locale === "ko" ? "출강 전 최종 샘플 채취" : "Take final pre-tap sample",
    });
  }

  rows.forEach((row) => {
    if (!row.prediction.available || !["low", "high"].includes(row.predictionState)) return;
    const direction = row.predictionState === "low"
      ? (locale === "ko" ? "하한 미달" : "below target")
      : (locale === "ko" ? "상한 초과" : "above target");
    checks.push({
      severity: "danger",
      text: locale === "ko"
        ? `${elementNames.ko[row.key]} 종점 예상 ${direction}`
        : `${elementNames.en[row.key]} endpoint estimate ${direction}`,
    });
  });

  if (checks.length === 0 && !["G7", "G8"].includes(heat.stage)) {
    checks.push({
      severity: "warning",
      text: locale === "ko" ? "다음 단계 전 실제 입력값 재확인" : "Recheck actual inputs before the next stage",
    });
  }
  return checks.slice(0, 4);
}
