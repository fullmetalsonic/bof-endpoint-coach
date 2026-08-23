import { expect, test } from "@playwright/test";
import { advance, clearWorkspace, createHeat, openNewHeat, startEmpty, waitForState } from "./helpers.js";

test.beforeEach(async ({ page }) => {
  await clearWorkspace(page);
});

test("빈 목표값의 신규 강종으로 차지를 만들어도 화면이 중단되지 않는다", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await startEmpty(page);

  await page.locator(".main-nav").getByRole("button", { name: "기준 정보" }).click();
  await page.getByRole("button", { name: /강종 추가/ }).click();
  await page.getByLabel("변경 사유").fill("빈 목표 강종 추가 시험");
  await page.getByRole("button", { name: "설정 저장" }).click();
  await page.locator(".main-nav").getByRole("button", { name: "대시보드" }).click();
  await openNewHeat(page);
  await page.getByLabel("강종").selectOption("GRADE-2");
  await page.getByRole("button", { name: "차지 시작", exact: true }).click();

  await expect(page.getByTestId("dashboard-screen")).toBeVisible();
  await expect(page.getByText("G0 장입 요약")).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("현재 작업 안내가 G0 기초값부터 G3 샘플·분석·체크포인트 순서로 실제 입력을 이끈다", async ({ page }) => {
  await startEmpty(page, "흐름 검증자");
  await createHeat(page, "E2E-GUIDE-001");

  const workflow = page.locator(".workflow-panel");
  await expect(workflow.getByRole("heading", { name: "종점 참고예상 기초값 입력" })).toBeVisible();
  await workflow.getByRole("button", { name: "기초 입력 확인·수정" }).click();
  await page.getByRole("spinbutton", { name: /^용선 중량/ }).fill("230000");
  await page.getByRole("spinbutton", { name: /^용선 탄소/ }).fill("4.5");
  await page.getByRole("spinbutton", { name: "용선 온도 (°C)" }).fill("1350");
  await page.getByRole("spinbutton", { name: /^스크랩 중량/ }).fill("30000");
  await page.getByRole("spinbutton", { name: /^스크랩 탄소/ }).fill("0.2");
  await page.getByRole("spinbutton", { name: "계획 총 산소 (Nm³)" }).fill("13000");
  await page.getByRole("button", { name: "변경값 저장" }).click();

  await expect(workflow.getByRole("heading", { name: "G1 송풍 시작 단계로 이동" })).toBeVisible();
  await expect(page.getByText("기초 입력값을 저장하고 종점 참고예상을 다시 계산했습니다.")).toBeVisible();
  await advance(page, "G0", "G1");

  await expect(workflow.getByRole("heading", { name: "실제 조업값 기록" })).toBeVisible();
  await expect(page.getByRole("button", { name: "체크포인트 기록 · 지금 입력" })).toBeVisible();
  await workflow.getByRole("button", { name: "체크포인트 입력창 열기" }).click();
  await page.getByRole("spinbutton", { name: /누적 산소량/ }).fill("1000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(workflow.getByRole("heading", { name: "G2 용해 초기 단계로 이동" })).toBeVisible();
  await expect(page.getByRole("button", { name: "체크포인트 기록 · 지금 입력" })).toHaveCount(0);

  await advance(page, "G1", "G2");
  await workflow.getByRole("button", { name: "체크포인트 입력창 열기" }).click();
  await page.getByRole("spinbutton", { name: /누적 산소량/ }).fill("3000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await advance(page, "G2", "G3");

  await expect(workflow.getByRole("heading", { name: "공정 샘플 채취" })).toBeVisible();
  await workflow.getByRole("button", { name: "샘플 채취 입력창 열기" }).click();
  await page.getByLabel("샘플 ID").fill("GUIDE-SAMPLE-01");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(workflow.getByRole("heading", { name: "샘플 분석값 입력" })).toBeVisible();

  await workflow.getByRole("button", { name: "분석 결과 입력창 열기" }).click();
  await page.getByRole("spinbutton", { name: /^C / }).fill("0.08");
  await page.getByRole("spinbutton", { name: "T (°C)" }).fill("1650");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(workflow.getByRole("heading", { name: "조업 체크포인트 갱신" })).toBeVisible();

  await workflow.getByRole("button", { name: "체크포인트 입력창 열기" }).click();
  await page.getByRole("spinbutton", { name: /누적 산소량/ }).fill("7000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(workflow.getByRole("heading", { name: "G4 용해 후기 단계로 이동" })).toBeVisible();
  await expect(workflow.locator("li.done")).toHaveCount(3);
});

test("수동 단위 환산부터 G8 완료까지 실제 입력 흐름과 재실행 저장이 이어진다", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await startEmpty(page, "교대 A");
  await createHeat(page, "E2E-FULL-001", { fullInputs: true });

  let state = await waitForState(page, (stored) => stored.heats.some((item) => item.id === "E2E-FULL-001"));
  let heat = state.heats.find((item) => item.id === "E2E-FULL-001");
  expect(heat.initial.hotMetalKg).toBe(230000);
  expect(heat.initial.scrapKg).toBe(30000);
  expect(heat.initial.fluxKg).toBe(12000);
  expect(heat.initial.hotMetalP).toBeCloseTo(0.176);
  expect(heat.initial.inputMetadata.original.hotMetalKg).toEqual({ value: "230", unit: "t" });
  expect(heat.demo).toBe(false);

  await advance(page, "G0", "G1");
  await page.getByRole("button", { name: "체크포인트 기록" }).click();
  await page.getByRole("spinbutton", { name: /누적 산소량/ }).fill("5000");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("button", { name: "체크포인트 기록" }).click();
  await page.getByRole("spinbutton", { name: /누적 산소량/ }).fill("4900");
  await expect(page.getByRole("alert")).toContainText("누적 산소량은 이전 기록보다 작아질 수 없습니다");
  await expect(page.getByRole("button", { name: "저장", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "초안 버리기", exact: true }).click();

  await advance(page, "G1", "G2");
  await advance(page, "G2", "G3");
  await advance(page, "G3", "G4");
  await advance(page, "G4", "G5");

  await page.getByRole("button", { name: "샘플 채취 기록" }).click();
  await page.getByLabel("샘플 ID").fill("FINAL-001");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.locator(".workflow-panel").getByRole("button", { name: "분석 결과 입력창 열기" }).click();
  await page.getByRole("spinbutton", { name: /^C / }).fill("0.06");
  await page.getByRole("spinbutton", { name: /^P / }).fill("200");
  await page.getByRole("combobox", { name: "P 단위" }).selectOption("ppm");
  await page.getByRole("spinbutton", { name: "T (°C)" }).fill("1670");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("button", { name: "재취련 기록" }).click();
  await page.getByRole("spinbutton", { name: /추가 산소/ }).fill("200");
  await page.getByRole("spinbutton", { name: /시간 \(min\)/ }).fill("1");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await advance(page, "G5", "G6");

  await page.getByRole("button", { name: "출강 기록" }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^G7 / })).toBeVisible();

  await page.getByRole("button", { name: "자재 투입 기록" }).click();
  await page.getByRole("spinbutton", { name: /수량/ }).fill("1");
  await page.getByRole("combobox", { name: "단위" }).selectOption("t");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await advance(page, "G7", "G8");

  await page.waitForTimeout(500);
  state = await waitForState(page, (stored) => stored.heats.find((item) => item.id === "E2E-FULL-001")?.status === "completed");
  heat = state.heats.find((item) => item.id === "E2E-FULL-001");
  expect(heat.status).toBe("completed");
  expect(heat.stageHistory).toHaveLength(9);
  expect(heat.initial.fluxKg).toBe(12000);
  expect(heat.samples[0].values.P).toBeCloseTo(0.02);
  expect(heat.events.find((event) => event.type === "material").payload.originalUnit).toBe("t");
  expect(heat.events.find((event) => event.type === "material").payload.amountKg).toBe(1000);
  expect(new Set(heat.events.map((event) => event.type))).toEqual(new Set(["heat_created", "checkpoint", "sample", "analysis", "reblow", "tap", "material"]));

  await page.reload();
  await expect(page.getByRole("heading", { name: /^G8 / })).toBeVisible();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth <= body.clientWidth)).toBe(true);
  expect(pageErrors).toEqual([]);
  await expect(page.locator(".vite-error-overlay")).toHaveCount(0);
});

test("여러 차지의 공정값은 서로 섞이지 않고 초안 삭제 후에도 남은 차지가 유지된다", async ({ page }) => {
  await startEmpty(page);
  await createHeat(page, "E2E-A");
  await advance(page, "G0", "G1");
  await page.getByRole("button", { name: "체크포인트 기록" }).click();
  await page.getByRole("spinbutton", { name: /누적 산소량/ }).fill("3200");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await createHeat(page, "E2E-B");

  let state = await waitForState(page, (stored) => stored.heats.some((heat) => heat.id === "E2E-B"));
  expect(state.heats.find((heat) => heat.id === "E2E-A").process.cumulativeOxygenNm3).toBe(3200);
  expect(state.heats.find((heat) => heat.id === "E2E-B").process.cumulativeOxygenNm3).toBe(0);

  await page.locator(".heat-tabs").getByRole("button", { name: /E2E-A/ }).click();
  await expect(page.getByText("3,200 Nm³")).toBeVisible();
  await page.locator(".main-nav").getByRole("button", { name: "차지 이력" }).click();
  const rowB = page.getByRole("row").filter({ hasText: "E2E-B" });
  await rowB.getByRole("button", { name: "삭제" }).click();
  await page.getByRole("button", { name: "차지 삭제" }).click();
  await expect(page.getByRole("row").filter({ hasText: "E2E-B" })).toHaveCount(0);
  state = await waitForState(page, (stored) => stored.heats.every((heat) => heat.id !== "E2E-B"));
  expect(state.heats.map((heat) => heat.id)).toEqual(["E2E-A"]);
});

test("검증된 JSON으로 전체 교체·취소하고 Excel도 생성한다", async ({ page }) => {
  await startEmpty(page);
  await createHeat(page, "E2E-BACKUP");
  await page.locator(".main-nav").getByRole("button", { name: "분석 · 리포트" }).click();

  const backupDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /전체 데이터 JSON으로 저장/ }).click();
  const backup = await backupDownload;
  expect(backup.suggestedFilename()).toMatch(/BOF_Coach_Backup_.*\.json/);

  await page.getByRole("button", { name: "작업공간 초기화" }).click();
  await page.getByRole("button", { name: "빈 작업으로 초기화" }).click();
  await waitForState(page, (stored) => stored.heats.length === 0);
  await page.locator('input[type="file"][accept*=".json"]').setInputFiles(await backup.path());
  await expect(page.getByText("파일 검증 통과")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("checkbox", { name: /전체 교체를 진행/ }).check();
  await page.getByRole("button", { name: "검증된 백업으로 전체 교체" }).click();
  let state = await waitForState(page, (stored) => stored.heats.some((heat) => heat.id === "E2E-BACKUP"));
  expect(state.heats.map((heat) => heat.id)).toContain("E2E-BACKUP");
  await expect(page.getByRole("button", { name: "마지막 불러오기 취소" })).toBeVisible();
  await page.getByRole("button", { name: "마지막 불러오기 취소" }).click();
  await expect(page.getByText(/직전 작업공간을 복원했습니다/)).toBeVisible();

  const excelDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /Excel 보고서/ }).click();
  const excel = await excelDownload;
  expect(excel.suggestedFilename()).toBe("bof-endpoint-coach-report.xlsx");
});

test("작업자 변경, 차지 취소·보관, 초기화 복구와 금일 현황이 같은 이력을 유지한다", async ({ page }) => {
  await startEmpty(page, "초기작업자");
  await page.getByRole("button", { name: "초기작업자" }).click();
  await page.getByLabel("작업자 이름").fill("교대작업자");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await createHeat(page, "E2E-CANCEL");
  await advance(page, "G0", "G1");

  await page.locator(".main-nav").getByRole("button", { name: "차지 이력" }).click();
  const row = page.getByRole("row").filter({ hasText: "E2E-CANCEL" });
  await row.getByRole("button", { name: "취소" }).click();
  await expect(page.getByRole("button", { name: "차지 취소" })).toBeDisabled();
  await page.getByLabel("취소 사유").fill("확장 검증 중단");
  await page.getByRole("button", { name: "차지 취소" }).click();
  await expect(row).toContainText("취소");
  await row.getByRole("button", { name: "보관" }).click();
  await page.getByRole("button", { name: "차지 보관" }).click();
  await expect(row).toContainText("보관");

  await page.locator(".main-nav").getByRole("button", { name: "금일 현황" }).click();
  await expect(page.getByRole("button", { name: "E2E-CANCEL" })).toBeVisible();
  await page.locator(".main-nav").getByRole("button", { name: "분석 · 리포트" }).click();
  await page.getByRole("button", { name: "작업공간 초기화" }).click();
  await page.getByRole("button", { name: "빈 작업으로 초기화" }).click();
  const resetRecovery = page.getByRole("row").filter({ hasText: "작업공간 초기화 전" }).first();
  await resetRecovery.getByRole("button", { name: "복원" }).click();
  await resetRecovery.getByRole("button", { name: "복원 확인" }).click();

  const state = await waitForState(page, (stored) => stored.heats.some((heat) => heat.id === "E2E-CANCEL" && heat.status === "archived"));
  const restored = state.heats.find((heat) => heat.id === "E2E-CANCEL");
  expect(state.operatorProfile.displayName).toBe("교대작업자");
  expect(restored.cancellationReason).toBe("확장 검증 중단");
  expect(restored.lifecycleRecordedBy.displayName).toBe("교대작업자");
});

test("미래·역행 시각과 중복 차지는 화면에서 저장되지 않는다", async ({ page }) => {
  await startEmpty(page);
  await openNewHeat(page);
  await page.getByLabel("차지 번호").fill("E2E-TIME");
  await page.getByLabel("시각").fill("2099-01-01T00:00");
  await expect(page.getByRole("alert")).toContainText("미래인 시각");
  await expect(page.getByRole("button", { name: "차지 시작", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "초안 버리기", exact: true }).click();

  await createHeat(page, "E2E-TIME");
  await page.getByRole("button", { name: /G0 → G1/ }).click();
  await page.getByLabel("실제 전환 시각").fill("2000-01-01T00:00");
  await expect(page.getByRole("alert")).toContainText("차지 시작 이전");
  await expect(page.getByRole("button", { name: /기록하고 이동$/ })).toBeDisabled();
  await page.getByRole("button", { name: "취소", exact: true }).click();

  await openNewHeat(page);
  await page.getByLabel("차지 번호").fill("E2E-TIME");
  await expect(page.getByRole("alert")).toContainText("이미 존재하는 차지 번호");
  await expect(page.getByRole("button", { name: "차지 시작", exact: true })).toBeDisabled();
});

test("상단 메뉴와 기준 정보의 모든 탭이 실제 화면으로 전환되고 저장된다", async ({ page }) => {
  await startEmpty(page, "메뉴 검증자");
  const navigation = [
    ["차지 이력", "history-screen"],
    ["금일 현황", null],
    ["알림", null],
    ["분석 · 리포트", "reports-screen"],
  ];
  for (const [name, testId] of navigation) {
    await page.locator(".main-nav").getByRole("button", { name }).click();
    if (testId) await expect(page.getByTestId(testId)).toBeVisible();
    else await expect(page.locator("main.workspace-screen")).toBeVisible();
  }

  await page.locator(".main-nav").getByRole("button", { name: "기준 정보" }).click();
  for (const name of ["강종군", "재료", "관리 게이트", "단위 · 환산", "설비 · 조업 조건", "계산 · 보정 계수", "버전 · 승인"]) {
    await page.locator(".settings-tabs").getByRole("button", { name }).click();
    await expect(page.locator(".settings-content")).toBeVisible();
  }
  await page.locator(".settings-tabs").getByRole("button", { name: "강종군" }).click();
  await page.getByLabel("한글 명칭").fill("가상 저탄소강 검증");
  await page.getByLabel("변경 사유").fill("메뉴 저장 흐름 검증");
  await page.getByRole("button", { name: "설정 저장" }).click();
  const state = await waitForState(page, (stored) => stored.operationLog.some((entry) => entry.type === "settings_updated"));
  expect(state.operatorProfile.displayName).toBe("메뉴 검증자");
});

test("선택형 DEMO 차지는 실제로 모두 삭제할 수 있고 Ledger에는 가짜 새로고침 버튼이 없다", async ({ page }) => {
  await page.getByLabel("작업자 이름").fill("DEMO 검증자");
  await page.getByRole("button", { name: "DEMO로 체험" }).click();
  await expect(page.locator(".data-ledger")).toContainText("미연동 · 수동 입력");
  await expect(page.locator(".data-ledger").getByRole("button")).toHaveCount(0);

  await page.locator(".main-nav").getByRole("button", { name: "차지 이력" }).click();
  for (const id of ["DEMO-260822-01", "DEMO-260822-02"]) {
    const row = page.getByRole("row").filter({ hasText: id });
    await row.getByRole("button", { name: "삭제" }).click();
    await page.getByRole("button", { name: "차지 삭제" }).click();
    await expect(page.getByRole("row").filter({ hasText: id })).toHaveCount(0);
  }
  const state = await waitForState(page, (stored) => stored.heats.length === 0);
  expect(state.operatorProfile.displayName).toBe("DEMO 검증자");
});

test("분석 수정·무효와 마지막 단계 취소가 원본을 보존하고 예상값을 다시 계산한다", async ({ page }) => {
  await page.getByLabel("작업자 이름").fill("정정 검증자");
  await page.getByRole("button", { name: "DEMO로 체험" }).click();
  await page.locator(".analysis-table").getByRole("button", { name: "전체 이력·정정" }).click();
  await expect(page.getByTestId("heat-detail-screen")).toBeVisible();

  let activeAnalysisRow = page.locator("tr.record-active").filter({ hasText: "S-DEMO-03" }).first();
  await activeAnalysisRow.getByRole("button", { name: "수정", exact: true }).click();
  await page.getByLabel("C (%)").fill("0.071");
  await page.getByLabel("정정·취소 사유").fill("분석 전사값 확인");
  await page.getByRole("button", { name: "영향 확인 후 적용" }).click();

  let state = await waitForState(page, (stored) => stored.heats[0].correctionLog.length === 1);
  let heat = state.heats[0];
  expect(heat.samples.at(-1).analysisResults).toHaveLength(2);
  expect(heat.samples.at(-1).analysisResults[0].status).toBe("superseded");
  expect(heat.samples.at(-1).values.C).toBe(0.071);
  expect(heat.predictionSnapshots.at(-1).triggerType).toBe("correction");

  activeAnalysisRow = page.locator("tr.record-active").filter({ hasText: "S-DEMO-03" }).first();
  await activeAnalysisRow.getByRole("button", { name: "무효", exact: true }).click();
  await page.getByLabel("정정·취소 사유").fill("분석실 재통보로 제외");
  await page.getByRole("button", { name: "영향 확인 후 적용" }).click();
  state = await waitForState(page, (stored) => stored.heats[0].correctionLog.length === 2);
  heat = state.heats[0];
  expect(heat.samples.at(-1).analysisResults.at(-1).status).toBe("voided");
  expect(heat.samples.at(-1).adopted).toBe(false);

  await page.getByRole("button", { name: "대시보드 보기" }).click();
  await page.getByRole("button", { name: "마지막 단계 전환 취소" }).click();
  await page.getByLabel("정정·취소 사유").fill("G6 전환 오입력");
  await page.getByRole("button", { name: "영향 확인 후 적용" }).click();
  await expect(page.getByRole("heading", { name: /^G5 / })).toBeVisible();
  state = await waitForState(page, (stored) => stored.heats[0].stage === "G5");
  expect(state.heats[0].stageHistory.find((entry) => entry.to === "G6").status).toBe("voided");
});

test("출강 이후에는 출강 시각 정정과 종점 실제값 지정이 별도 흐름으로 동작한다", async ({ page }) => {
  await page.getByLabel("작업자 이름").fill("출강 검증자");
  await page.getByRole("button", { name: "DEMO로 체험" }).click();
  await page.locator(".action-bar").getByRole("button", { name: /^출강 기록/ }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^G7 / })).toBeVisible();

  let state = await waitForState(page, (stored) => stored.heats[0].stage === "G7");
  const originalTap = state.heats[0].tappedAt;
  await page.locator(".analysis-table").getByRole("button", { name: "전체 이력·정정" }).click();
  await page.getByRole("button", { name: "출강 기록 정정" }).click();
  const correctedDate = new Date(new Date(originalTap).getTime() - 1_000);
  const localDate = new Date(correctedDate.getTime() - correctedDate.getTimezoneOffset() * 60_000).toISOString().slice(0, 19);
  await page.getByLabel("실제 발생 시각").fill(localDate);
  await page.getByLabel("정정·취소 사유").fill("출강 시작 시각 재확인");
  await page.getByRole("button", { name: "영향 확인 후 적용" }).click();

  state = await waitForState(page, (stored) => stored.heats[0].correctionLog.some((entry) => entry.type === "tap_corrected"));
  expect(state.heats[0].tappedAt).not.toBe(originalTap);
  expect(state.heats[0].events.filter((event) => event.type === "tap")).toHaveLength(2);

  const activeAnalysisRow = page.locator("tr.record-active").filter({ hasText: "S-DEMO-03" }).first();
  await activeAnalysisRow.getByRole("button", { name: "종점 실제값" }).click();
  await page.getByLabel("정정·취소 사유").fill("출강 후 최종 분석 확정");
  await page.getByRole("button", { name: "영향 확인 후 적용" }).click();
  state = await waitForState(page, (stored) => Boolean(stored.heats[0].actualEndpointAnalysisId));
  expect(state.heats[0].actualEndpointAnalysisId).toBe(state.heats[0].samples.at(-1).adoptedAnalysisId);
  await expect(page.locator(".validation-comparison")).toContainText("종점 실제값으로 사용");
});
