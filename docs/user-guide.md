# 취련 코치 v0.2.0 사용 설명서 / BOF Endpoint Coach v0.2.0 User Guide

이 문서는 회사 공용 PC에서 단일 HTML 파일을 열어 사용하는 초기 공개본의 조작 순서와 안전 경계를 설명합니다. 모든 화면과 예시는 합성 DEMO 데이터입니다.

> **중요:** 이 도구의 C·온도 값은 공개 문헌 시나리오 기반 참고예상입니다. 설비 제어, 안전 인터록, 표준작업, 실험실 분석, 출강 승인 또는 취련사의 판단을 대체하지 않습니다. 실제 현장 적용 전에는 완료 차지 그림자 검증과 현장 승인이 필요합니다.

## 1. 실행 전 준비

1. `BOF_Endpoint_Coach_v0.2.0.html`과 이 사용 설명서를 공용 PC의 작업 폴더에 저장합니다.
2. 실행 파일을 Microsoft Edge 또는 Google Chrome으로 엽니다. 서버 설치나 인터넷 연결은 필요하지 않습니다.
3. 브라우저 배율은 100%를 권장하며, 화면은 1280px 이상 데스크톱용입니다. 1920×1080 모니터에서 검증했습니다.
4. 첫 실제 입력 전에 `기준 정보`의 강종·재료·설비·계수를 반드시 확인합니다.

## 2. 화면을 빠르게 읽는 법

![취련 코치 한국어 대시보드](https://raw.githubusercontent.com/fullmetalsonic/bof-endpoint-coach/main/docs/screenshots/dashboard-ko.png)

| 구역 | 확인 내용 |
| --- | --- |
| 상단 차지 탭 | 동시에 진행 중인 차지를 선택하고 `신규 차지`를 생성 |
| 상단 요약 | 강종, 목표 C, 현재 단계, 경과시간, 누적 산소, 예상 출강시각, 다음 행동 |
| 좌측 G0~G8 | 장입부터 후처리까지 현재 공정 게이트 |
| 중앙 다음 행동 | 현재 단계와 C·온도 상태에 따른 확인 항목 |
| 품질 막대 | 검은 점은 최신 실측, 흰 점은 기준 종점 참고예상, 얇은 범위는 문헌 저/고 시나리오, 녹색은 강종 목표 |
| 최근 분석 표 | 채취 시각, 샘플 ID, C·Si·Mn·P·S·온도, 분석 방법 |
| Data Ledger | 입력 최신성, 미완료 확인, 계산식·계수·근거·설비 프로필 |
| 하단 6개 버튼 | 자재, 샘플, 분석, 체크포인트, 재취련, 출강 입력 |

P·Mn·Si·S는 현장 승인 계산식이 없으므로 실측과 목표만 표시하고 종점 예상값을 만들지 않습니다.

## 3. 최초 기준 정보 설정

### 3.1 강종군

- 강종 코드는 중복되지 않게 입력합니다.
- C·온도·P·Mn·Si·S의 최소/최대 목표를 설정합니다.
- 최소값이 최대값보다 크거나 코드가 비어 있으면 저장할 수 없습니다.

### 3.2 재료와 단위

- 자재 코드, 분류, 기본 단위와 C·Si·Mn·P·S·CaO 조성을 기록할 수 있습니다.
- kg·t·g 입력은 내부에서 kg로 환산됩니다.
- 현재 계산에는 `flux` 분류의 투입 중량만 열수지에 반영됩니다. 합금 수율 계산은 아직 제공하지 않습니다.

### 3.3 설비·조업 조건

- 전로 용량, 취련 방식, 랜스 프로필, 저취 가스를 설비 프로필로 관리합니다.
- 초기 공개본은 PLC·HMI·SCC와 연결되지 않으므로 작업자가 실제 값을 입력해야 합니다.

## 4. 문헌 계수와 현장 수정·승인

![문헌 계수와 현장 수정값 설정](https://raw.githubusercontent.com/fullmetalsonic/bof-endpoint-coach/main/docs/screenshots/settings-ko.png)

계수 화면은 `문헌 원본`, `현장 수정값`, `실제 적용값`, `근거 ID`를 분리해 보여줍니다.

1. 수정값을 비워 두면 공개 문헌 기본값을 사용합니다.
2. 숫자를 입력하면 즉시 계산에 사용되며 상태는 `사용자 수정 · 미승인`으로 표시됩니다.
3. 현장 승인값으로 지정하려면 `현장 승인값`을 선택하고 승인자/역할과 승인 근거·사유를 모두 입력합니다.
4. 승인된 값을 다시 수정하면 기존 승인은 자동 해제됩니다.
5. `수정값 전체 지우기`를 누르면 문헌 기본값으로 돌아갑니다.

적용 순서는 `현장 승인 수정값 → 사용자 수정값(미승인) → 문헌 원본값`입니다. PCR, 열손실률, 종점 슬래그 FeO의 저·고값은 통계적 신뢰구간이 아니라 민감도 시나리오입니다.

## 5. 신규 차지 시작

1. 상단 `신규 차지`를 누릅니다.
2. 차지 번호, 강종, 설비, 계수 프로필을 선택합니다.
3. 시작 시각은 현재 시각이 기본이며 실제 시각으로 수정할 수 있습니다.
4. 용선·스크랩 질량과 C, 용선 온도, 계획 총 산소량, 초기 누적 산소, 산소 유량, 랜스 높이를 입력합니다.
5. 용선 Si·Mn·P를 알고 있으면 입력합니다. 비워 두면 계수 프로필의 문헌 참고값이 쓰이며 Data Ledger에 대체 입력으로 표시됩니다.

차지를 만들면 G0에서 시작하며, 상단 탭을 클릭해 여러 진행 차지를 번갈아 볼 수 있습니다.

## 6. 취련 중 입력 순서

모든 입력창의 시각 기본값은 현재 시각입니다. 실제 발생 시각이 다르면 저장 전에 수정합니다.

1. **자재 투입 기록:** 재료, 중량, 단위, 투입 시각을 기록합니다.
2. **샘플 채취 기록:** 샘플 ID와 실제 채취 시각을 기록합니다. 당시 누적 산소·유량·랜스 높이가 함께 저장됩니다.
3. **분석 결과 입력:** 사용할 샘플을 선택하고 C·Si·Mn·P·S·온도와 분석 방법을 입력합니다. 채택된 샘플 하나가 계산 기준이 됩니다.
4. **체크포인트 기록:** 실제 누적 산소, 산소 유량, 랜스 높이, 예상 잔여시간을 갱신합니다.
5. **재취련 기록:** 추가 산소량과 시간을 기록합니다.
6. **출강 기록:** 실제 출강 시각을 기록하고 차지를 완료 상태로 전환합니다.

## 7. 종점 참고예상 해석

```text
C_end = C_sample + C_literature(O_plan) - C_literature(O_sample)
T_end = T_sample + T_literature(O_plan) - T_literature(O_sample)
```

- 채택 샘플에 당시 누적 산소가 있으면 실제 C·온도에 문헌 모델의 이후 변화량을 더합니다.
- 샘플이 없으면 장입값과 계획 산소량을 이용한 정적 물질·열수지 참고값을 표시합니다.
- 현재 누적 산소나 유량을 바꾸면 예상 잔여시간과 계산 시각이 갱신됩니다.
- 결과 옆의 계산식 버전, 계수 프로필, 적용 상태, 근거 ID, 계획값 포함 여부를 같이 확인합니다.
- 목표 범위 안에 있어도 최종 분석과 현장 표준을 우선합니다.

## 8. 저장, 백업, 복원, 보고서

- 입력 내용은 현재 브라우저의 IndexedDB에 자동 저장됩니다.
- 교대, PC 변경, 브라우저 초기화 전에는 `분석 · 리포트`에서 CSV 백업 ZIP을 저장합니다.
- 백업 ZIP은 CSV 7종과 `manifest.csv`를 포함하고, 복원 전에 SHA-256 무결성을 검사합니다.
- 복원은 이 도구가 만든 ZIP만 사용합니다. 일부 CSV를 직접 수정하면 무결성 검사에 실패합니다.
- XLSX는 사람이 확인하는 보고서이며 복원 파일로 사용할 수 없습니다.
- v0.2.0은 v0.1.0 백업 스키마와 호환됩니다.

## 9. 문제가 생겼을 때

| 증상 | 확인 순서 |
| --- | --- |
| 예상값이 `–`로 표시됨 | 계획 산소량, 필수 장입값, 계수 프로필 오류, 해당 원소 계산식 제공 여부 확인 |
| 설정 저장 버튼 비활성 | 화면 상단 정합성 경고에서 코드 중복, 범위 역전, 계수 순서, 승인정보 누락 확인 |
| 과거 데이터가 보이지 않음 | 같은 브라우저·같은 파일 위치인지 확인하고 저장한 CSV ZIP 복원 시도 |
| 화면이 잘리거나 너무 작음 | Edge/Chrome, 100% 배율, 1280px 이상 해상도 확인 |
| 결과가 현장 경험과 다름 | 이 도구의 문헌 시나리오를 조업 기준으로 사용하지 말고 실제 분석·현장 표준을 우선 |

## 10. English quick guide

![BOF Endpoint Coach English dashboard](https://raw.githubusercontent.com/fullmetalsonic/bof-endpoint-coach/main/docs/screenshots/dashboard-en.png)

1. Open `BOF_Endpoint_Coach_v0.2.0.html` in Edge or Chrome at 100% zoom.
2. Review grade, material, equipment, and coefficient profiles before entering a real heat.
3. Create a heat and record actual timestamps and values with the six bottom action buttons.
4. Read the black marker as the latest actual, the white marker as the base endpoint estimate, the thin band as the literature sensitivity range, and the green segment as the grade target.
5. Literature originals are preserved. Priority is site-approved override, unapproved user override, then literature original.
6. Export a CSV ZIP backup before shift handover, browser reset, or PC change. XLSX is for viewing only.
7. The tool is not plant-validated and does not replace controls, safety interlocks, SOPs, laboratory results, tap authorization, or operator judgment.

추가 계산 경계와 공개 근거는 [README](https://github.com/fullmetalsonic/bof-endpoint-coach/blob/main/README.md), [종점 참고 계산식](https://github.com/fullmetalsonic/bof-endpoint-coach/blob/main/docs/domain/%EC%A2%85%EC%A0%90%EC%B0%B8%EA%B3%A0%EA%B3%84%EC%82%B0%EC%8B%9D_%EC%B4%88%EC%95%88.md), [검증·승인 계획](https://github.com/fullmetalsonic/bof-endpoint-coach/blob/main/docs/product/%EC%A2%85%EC%A0%90%EC%B0%B8%EA%B3%A0%EC%98%88%EC%83%81_%EA%B2%80%EC%A6%9D%EB%B0%8F%EC%8A%B9%EC%9D%B8%EA%B3%84%ED%9A%8D_%EC%B4%88%EC%95%88.md)을 참고하십시오.
