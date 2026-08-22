import { getActionAvailability, getNextStage, hasEndpointReviewSample, validateStageAdvance } from "./processStages.js";

const initialPredictionFields = ["hotMetalKg", "hotMetalC", "scrapKg", "scrapC", "plannedTotalOxygenNm3", "hotMetalTemperatureC"];
const initialAccuracyFields = ["hotMetalSi", "hotMetalMn", "hotMetalP", "fluxKg"];

function hasValue(value) {
  return value !== "" && value !== null && value !== undefined && Number.isFinite(Number(value));
}

function localized(locale, ko, en) {
  return locale === "ko" ? ko : en;
}

function stageEventExists(heat, type) {
  const stageStart = [...(heat.stageHistory ?? [])].reverse().find((entry) => (entry.status ?? "active") === "active" && entry.to === heat.stage)?.occurredAt;
  return (heat.events ?? []).some((event) => {
    if ((event.status ?? "active") !== "active") return false;
    if (event.type !== type) return false;
    if (event.stage) return event.stage === heat.stage;
    return stageStart ? new Date(event.occurredAt).getTime() >= new Date(stageStart).getTime() : false;
  });
}

function stageSamples(heat) {
  return (heat.samples ?? [])
    .filter((sample) => (sample.status ?? "active") === "active" && (sample.stage ?? heat.stage) === heat.stage)
    .sort((a, b) => new Date(b.sampledAt) - new Date(a.sampledAt));
}

function sampleHasAnalysis(sample) {
  return Boolean(sample && sample.values && Object.values(sample.values).some(hasValue));
}

function makeStep({ id, kind, action = null, title, body, buttonLabel, status = "pending", optional = false }) {
  return { id, kind, action, title, body, buttonLabel, status, optional };
}

function advanceCopy(heat, locale) {
  const next = getNextStage(heat.stage);
  if (!next) return null;
  return {
    id: "advance",
    kind: "advance",
    title: localized(locale, `${next.code} ${next.labelKo} 단계로 이동`, `Move to ${next.code} ${next.labelEn}`),
    body: localized(locale, "실제 공정이 바뀐 시각과 당시 조업값을 기록합니다.", "Record the actual transition time and operating values."),
    buttonLabel: localized(locale, `${next.code} ${next.labelKo} 단계로 전환`, `Advance to ${next.code} ${next.labelEn}`),
  };
}

function initialStep(readiness, locale) {
  const complete = readiness.predictionComplete;
  return makeStep({
    id: "initial",
    kind: "edit_initial",
    title: complete
      ? localized(locale, "기초 입력값 확인 완료", "Initial inputs ready")
      : localized(locale, "종점 참고예상 기초값 입력", "Enter endpoint-estimate inputs"),
    body: complete
      ? localized(locale, `계산 핵심값 ${readiness.predictionProvided}/${readiness.predictionTotal}개가 입력됐습니다. 필요하면 수정할 수 있습니다.`, `${readiness.predictionProvided}/${readiness.predictionTotal} core calculation inputs are available. You can correct them if needed.`)
      : localized(locale, `계산 핵심값 ${readiness.predictionProvided}/${readiness.predictionTotal}개 입력. 빠진 값은 예상 불가 원인이 됩니다.`, `${readiness.predictionProvided}/${readiness.predictionTotal} core calculation inputs entered. Missing values can make the estimate unavailable.`),
    buttonLabel: localized(locale, "기초 입력 확인·수정", "Review initial inputs"),
    status: complete ? "done" : "current",
  });
}

function eventStep(action, titleKo, titleEn, bodyKo, bodyEn, buttonKo, buttonEn, status = "pending", optional = false) {
  return makeStep({
    id: action,
    kind: "event",
    action,
    title: { ko: titleKo, en: titleEn },
    body: { ko: bodyKo, en: bodyEn },
    buttonLabel: { ko: buttonKo, en: buttonEn },
    status,
    optional,
  });
}

function localizeStep(step, locale) {
  const value = (field) => typeof step[field] === "object" ? step[field][locale === "ko" ? "ko" : "en"] : step[field];
  return { ...step, title: value("title"), body: value("body"), buttonLabel: value("buttonLabel") };
}

export function getInitialInputReadiness(heat) {
  const initial = heat?.initial ?? {};
  const predictionProvided = initialPredictionFields.filter((field) => hasValue(initial[field])).length;
  const accuracyProvided = initialAccuracyFields.filter((field) => hasValue(initial[field])).length;
  return {
    predictionProvided,
    predictionTotal: initialPredictionFields.length,
    predictionComplete: predictionProvided === initialPredictionFields.length,
    accuracyProvided,
    accuracyTotal: initialAccuracyFields.length,
    missingPredictionFields: initialPredictionFields.filter((field) => !hasValue(initial[field])),
  };
}

export function getStageWorkflow(heat, locale = "ko") {
  const readiness = getInitialInputReadiness(heat);
  const availability = getActionAvailability(heat);
  const currentSamples = stageSamples(heat);
  const latestSample = currentSamples[0] ?? null;
  const currentSampleAnalyzed = sampleHasAnalysis(latestSample);
  const checkpointDone = stageEventExists(heat, "checkpoint");
  const materialDone = stageEventExists(heat, "material");
  const endpointReady = hasEndpointReviewSample(heat);
  const advanceValidation = validateStageAdvance(heat);
  const advance = advanceCopy(heat, locale);
  const steps = [];

  if (heat.stage === "G0") {
    steps.push(initialStep(readiness, locale));
    steps.push(makeStep({ ...advance, status: readiness.predictionComplete ? "current" : "ready" }));
  } else if (["G1", "G2"].includes(heat.stage)) {
    steps.push(localizeStep(eventStep("checkpoint", "실제 조업값 기록", "Record actual operating values", "누적 산소량·랜스 높이·산소 유량을 현재값으로 갱신합니다.", "Update cumulative oxygen, lance height, and oxygen flow.", "체크포인트 입력창 열기", "Open checkpoint entry", checkpointDone ? "done" : "current"), locale));
    steps.push(makeStep({ ...advance, status: checkpointDone ? "current" : "ready" }));
  } else if (["G3", "G4"].includes(heat.stage)) {
    steps.push(localizeStep(eventStep("sample", "공정 샘플 채취", "Collect process sample", "실제 채취 시각과 샘플 ID를 기록합니다.", "Record the actual sampling time and sample ID.", "샘플 채취 입력창 열기", "Open sample entry", latestSample ? "done" : "current"), locale));
    steps.push(localizeStep(eventStep("analysis", "샘플 분석값 입력", "Enter sample analysis", "채취한 샘플의 C·온도와 확인 가능한 성분을 입력합니다.", "Enter C, temperature, and available chemistry for the sample.", "분석 결과 입력창 열기", "Open analysis entry", currentSampleAnalyzed ? "done" : latestSample ? "current" : "pending"), locale));
    steps.push(localizeStep(eventStep("checkpoint", "조업 체크포인트 갱신", "Update operating checkpoint", "샘플 시점의 누적 산소와 조업 조건을 확인합니다.", "Confirm oxygen total and operating conditions at the sample time.", "체크포인트 입력창 열기", "Open checkpoint entry", checkpointDone ? "done" : currentSampleAnalyzed ? "current" : "pending"), locale));
    steps.push(makeStep({ ...advance, status: checkpointDone ? "current" : "ready" }));
  } else if (heat.stage === "G5") {
    steps.push(localizeStep(eventStep("sample", "종점 검토 샘플 채취", "Collect endpoint-review sample", "종점 검토에 사용할 실제 샘플을 기록합니다.", "Record the actual sample used for endpoint review.", "샘플 채취 입력창 열기", "Open sample entry", latestSample ? "done" : endpointReady ? "done" : "current"), locale));
    steps.push(localizeStep(eventStep("analysis", "C·온도 최종 분석 입력", "Enter final C and temperature", "G6 전환에는 채택된 샘플의 C와 온도가 필요합니다.", "An adopted sample with C and temperature is required before G6.", "분석 결과 입력창 열기", "Open analysis entry", endpointReady ? "done" : latestSample ? "current" : "pending"), locale));
    steps.push(localizeStep(eventStep("checkpoint", "최종 조업값 확인", "Confirm final operating values", "누적 산소와 잔여시간을 실제값으로 갱신합니다.", "Update oxygen total and remaining time with actual values.", "체크포인트 입력창 열기", "Open checkpoint entry", checkpointDone ? "done" : endpointReady ? "current" : "pending", true), locale));
    steps.push(makeStep({ ...advance, status: advanceValidation.ok ? (endpointReady ? "current" : "ready") : "blocked" }));
  } else if (heat.stage === "G6") {
    steps.push(localizeStep(eventStep("sample", "출강 전 최종 샘플", "Final pre-tap sample", "현장 기준에 따라 필요하면 출강 직전 샘플을 추가로 기록합니다.", "If required by site practice, record a final sample immediately before tap.", "최종 샘플 채취 입력", "Enter final sample", latestSample ? "done" : "current", true), locale));
    steps.push(localizeStep(eventStep("analysis", "최종 샘플 분석 확인", "Confirm final sample analysis", "추가 샘플을 채취했다면 C·온도 분석을 입력합니다.", "If a new sample was taken, enter its C and temperature analysis.", "최종 분석 결과 입력", "Enter final analysis", latestSample ? (currentSampleAnalyzed ? "done" : "current") : "optional", true), locale));
    steps.push(localizeStep(eventStep("tap", "출강 기록 및 G7 이동", "Record tap and move to G7", "출강이 실제로 시작된 시각을 기록하면 G7로 이동합니다.", "Record the actual tap time to move to G7.", "출강 기록창 열기", "Open tap record", currentSampleAnalyzed || !latestSample ? "ready" : "pending"), locale));
  } else if (heat.stage === "G7") {
    steps.push(localizeStep(eventStep("material", "후처리 투입 기록", "Record post-treatment additions", "실제 투입한 합금철·부원료가 있으면 기록합니다.", "Record any actual alloy or material additions.", "후처리 자재 투입 입력", "Enter post-treatment addition", materialDone ? "done" : "current", true), locale));
    steps.push(localizeStep(eventStep("sample", "최종 샘플·결과 기록", "Record final sample and result", "최종 확인 샘플이 있으면 채취 후 분석값을 남깁니다.", "If a final verification sample exists, record it and its analysis.", "최종 샘플 채취 입력", "Enter final sample", latestSample ? "done" : "optional", true), locale));
    steps.push(makeStep({ ...advance, status: "ready" }));
  } else {
    steps.push(makeStep({
      id: "complete",
      kind: "complete",
      title: localized(locale, "차지 작업 완료", "Heat workflow complete"),
      body: localized(locale, "G0부터 G8까지의 입력과 단계 이력이 저장됐습니다.", "Inputs and stage history from G0 through G8 are saved."),
      buttonLabel: "",
      status: "done",
    }));
  }

  const actionable = steps.filter((step) => step.kind !== "complete");
  const current = actionable.find((step) => step.status === "current")
    ?? actionable.find((step) => step.status === "ready" && step.kind !== "advance")
    ?? actionable.find((step) => step.status === "ready")
    ?? steps[0];
  const completedCount = steps.filter((step) => step.status === "done").length;
  const recommendedAction = current?.kind === "event" && availability[current.action] ? current.action : null;

  return {
    steps,
    current,
    completedCount,
    totalCount: steps.length,
    recommendedAction,
    readiness,
    availability,
    nextStage: getNextStage(heat.stage),
    advanceValidation,
  };
}
