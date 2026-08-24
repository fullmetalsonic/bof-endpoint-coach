const OBJECTIVES = Object.freeze({
  slag_basicity: ["슬래그 염기도 목표", "Slag basicity target"],
  temperature_upper_limit: ["온도 상한까지 냉각", "Cool to temperature upper limit"],
  carbon_to_target_midpoint: ["탄소 목표 중앙값", "Carbon target midpoint"],
});

const ASSUMPTIONS = Object.freeze({
  endpoint_slag_scenario: ["종점 슬래그 시나리오 범위", "Endpoint slag scenario range"],
  complete_flux_incorporation: ["조재가 완전히 반응한다고 가정", "Complete flux incorporation assumed"],
  cao_sio2_mass_balance: ["CaO/SiO₂ 질량수지", "CaO/SiO2 mass balance"],
  effective_cooling_literature_range: ["문헌 유효냉각열 범위", "Literature effective-cooling range"],
  steel_heat_capacity_linearized: ["강 열용량 선형 근사", "Linearized steel heat capacity"],
  oxide_oxygen_is_theoretical_upper_bound: ["산화물 산소는 이론상 상한", "Oxide oxygen is a theoretical upper bound"],
  master_alloy_mass_balance: ["합금철 성분 질량수지", "Master-alloy mass balance"],
  literature_recovery_scenario: ["문헌 회수율 범위", "Literature recovery scenarios"],
  finite_dissolution_time: ["유한한 용해시간 반영", "Finite dissolution time"],
  carbon_only_stoichiometric_lower_bound: ["탄소 제거만 본 화학량론 하한", "Carbon-only stoichiometric lower bound"],
  post_combustion_scenarios: ["후연소율 시나리오 범위", "Post-combustion scenarios"],
  other_oxygen_demand_not_recalculated: ["Si·Mn·Fe 등 산소수요는 재계산하지 않음", "Other oxygen demands are not recalculated"],
});

const REASONS = Object.freeze({
  model_disabled: ["설정에서 사용하지 않음", "Disabled in settings"],
  stage_not_allowed: ["현재 G단계에서 허용되지 않음", "Not allowed at the current G stage"],
  flux_material_missing: ["CaO 성분이 있는 조재가 없음", "No flux with CaO composition"],
  slag_projection_unavailable: ["슬래그 추정에 필요한 초기 성분이 부족함", "Inputs for slag projection are incomplete"],
  basicity_target_missing: ["염기도 기준이 없음", "Basicity target is missing"],
  no_additional_flux_required: ["추가 조재 필요량이 계산되지 않음", "No additional flux is indicated"],
  temperature_not_high: ["예상 온도가 목표 상한 이하", "Predicted temperature is not above target"],
  estimated_steel_mass_missing: ["추정 용강량이 없음", "Estimated steel mass is missing"],
  coolant_material_missing: ["냉각재가 등록되지 않음", "No coolant is registered"],
  cooling_coefficient_missing: ["유효냉각열 값이 없음", "Effective-cooling value is missing"],
  alloy_material_missing: ["합금철·가탄재가 등록되지 않음", "No alloy or carburizer is registered"],
  no_alloy_shortfall_or_stage_not_allowed: ["성분 부족이 없거나 현재 단계에서 투입 불가", "No element shortfall, or addition is not allowed at this stage"],
  adopted_carbon_sample_required: ["채택된 실제 탄소 샘플이 필요", "An adopted actual carbon sample is required"],
  carbon_not_above_target: ["탄소가 목표 중앙값 이하", "Carbon is not above the target midpoint"],
  oxygen_context_incomplete: ["용강량·산소유량 입력이 부족함", "Steel-mass or oxygen-flow context is incomplete"],
  planned_oxygen_exhausted: ["계획 잔여 산소량이 없음", "No planned oxygen remains"],
  site_limit_conflict: ["설정한 최소·최대 투입한도와 충돌", "Conflicts with configured addition limits"],
});

const MODELS = Object.freeze({ flux: ["조재", "Flux"], coolant: ["냉각재·광석", "Coolant / ore"], alloy: ["합금철·가탄재", "Alloy / carburizer"], oxygen: ["추가 산소", "Additional oxygen"] });
const TIMING_MODES = Object.freeze({ now: ["지금", "Now"], local_time: ["로컬 시각", "Local time"], elapsed: ["취련 경과시간 기준", "Elapsed time"], oxygen: ["누적 산소량 기준", "Cumulative oxygen"] });

const PLAN_VALIDATION_MESSAGES = Object.freeze({
  plan_operation_invalid: ["조작 종류를 선택하십시오.", "Select an action type."],
  plan_amount_invalid: ["예상량은 0보다 큰 수치여야 합니다.", "Planned amount must be greater than zero."],
  plan_timing_mode_invalid: ["예정 기준을 선택하십시오.", "Select a timing basis."],
  plan_material_missing: ["투입할 재료를 선택하십시오.", "Select a material."],
  plan_time_invalid: ["예정 시각은 차지 시작 이후의 유효한 시각이어야 합니다.", "Planned time must be valid and after the heat start."],
  plan_elapsed_invalid: ["취련 경과시간을 0분 이상으로 입력하십시오.", "Enter an elapsed time of zero minutes or more."],
  plan_oxygen_invalid: ["누적 산소량을 0 Nm³ 이상으로 입력하십시오.", "Enter cumulative oxygen of zero Nm³ or more."],
  plan_record_time_invalid: ["계획 기록 시각을 확인하십시오.", "Check the plan record time."],
  plan_save_failed: ["계획을 저장하지 못했습니다. 저장 상태와 입력값을 확인하십시오.", "The plan could not be saved. Check storage status and inputs."],
  plan_decision_failed: ["계획 판단을 기록하지 못했습니다. 저장 상태를 확인하십시오.", "The plan decision could not be recorded. Check storage status."],
  plan_saved_decision_failed: ["내 계획은 저장했지만 비교 판단 이력은 기록하지 못했습니다. 저장된 계획은 그대로 유지됩니다.", "The operator plan was saved, but the comparison decision was not recorded. The saved plan remains available."],
});

function pick(entry, locale) {
  return entry?.[locale === "ko" ? 0 : 1];
}

export function objectiveLabel(objective, locale) {
  if (!objective) return "–";
  const element = objective.match(/^([A-Za-z]+)_target_midpoint$/)?.[1];
  if (element) return locale === "ko" ? `${element} 목표 중앙값` : `${element} target midpoint`;
  return pick(OBJECTIVES[objective], locale) ?? objective;
}

export function assumptionLabel(assumption, locale) {
  return pick(ASSUMPTIONS[assumption], locale) ?? assumption;
}

export function reasonLabel(reason, locale) {
  return pick(REASONS[reason], locale) ?? reason;
}

export function modelLabel(model, locale) {
  return pick(MODELS[model], locale) ?? model;
}

export function timingModeLabel(mode, locale) {
  return pick(TIMING_MODES[mode], locale) ?? mode ?? "–";
}

export function planValidationMessage(reason, locale) {
  return pick(PLAN_VALIDATION_MESSAGES[reason], locale) ?? reason ?? "–";
}
