# 취련 코치 · BOF Endpoint Coach

[한국어](#한국어) · [English](#english)

오프라인 공용 PC에서 취련사가 직접 입력한 값으로 **종점 탄소(C)와 온도를 참고 예상**하고, 여러 차지의 공정 이력·샘플·기준·백업을 함께 관리하는 단일 HTML 보조도구입니다.

> **안전·품질 고지:** 현재 소스는 합성 DEMO 차지와 공개 문헌 시나리오를 사용하며 **현장 정확도가 검증되지 않았습니다**. 설비 제어, 안전 인터록, 표준작업, 출강 승인 또는 취련사의 판단을 대체하지 않습니다.

![취련 코치 한국어 대시보드](docs/screenshots/dashboard-ko.png)

위 화면은 합성 차지의 G6 출강 검토 예시입니다. 검은 점은 최신 실측, 흰 점은 종점 참고 예상, 녹색 구간은 강종 목표 범위입니다. P·Mn·Si·S는 승인된 계산식이 없으므로 실측과 목표만 표시하고 예상값을 만들지 않습니다.

## 한국어

### v0.3.0에서 할 수 있는 것

- 중앙 `현재 해야 할 일`에서 지금 입력할 값, 이 단계의 진행 순서, 완료 수, 다음 단계와 종점 예상 상태를 한 번에 확인
- 현재 작업과 같은 하단 입력 버튼에만 `지금 입력`을 표시하고, 아직 수행하지 않은 단계 전환은 보조 버튼으로 구분
- G0 기초값 → G1·G2 체크포인트 → G3·G4 샘플·분석·체크포인트 → G5 종점 샘플 → G6 최종 확인 → G7 후처리 → G8 완료 흐름을 입력 이력에 따라 자동 안내
- 차지 생성 뒤에도 `기초 입력값 확인·수정`으로 강종·설비·계수와 장입값을 보정하고 수정 작업자·시각을 이력에 보존
- 입력창마다 `필수`, `계산 핵심`, `정확도 권장`, `선택`을 표시하고 저장 결과와 재계산 완료를 화면 알림으로 확인
- 최근 분석의 `수정·무효`, 전체 타임라인의 과거 투입·샘플·분석·체크포인트 정정, 사유·입력자·원본/대체 관계 보존
- `마지막 단계 전환 취소`로 정확히 한 단계만 복귀하고 해당 단계에서 만든 기록을 삭제하지 않고 무효로 보존
- 출강 뒤 `출강 기록 정정`, 복수 분석 결과의 명시적 `채택`, 종점 실제값 지정과 출강 시점 예상 오차 비교
- 차지 시작 당시 강종·설비·계수 설정을 차지별로 고정하고, 입력·정정·단계 전환 뒤 C·온도 예상 스냅샷 누적

- C 종점 참고 예상: C·Si·Mn·P·Fe 산화 산소수지와 PCR·슬래그 FeO 문헌 시나리오 계산
- 온도 종점 참고 예상: 원소별 반응열과 용강·슬래그·배가스 엔탈피, 열손실 문헌 시나리오 계산
- 채택 샘플의 당시 누적 산소 스냅샷이 있으면 문헌 모델의 이후 변화량을 실제 C·온도에 더하는 샘플 앵커 계산
- 문헌 원본값을 보존하면서 `현장 승인값 → 사용자 수정값 → 문헌 기본값` 순서로 계산
- 첫 실행에서 작업자 이름을 정하고 `빈 작업으로 시작` 또는 선택형 DEMO 체험
- 여러 진행 차지를 탭으로 전환하고, 실제 시각을 기록하며 G0 장입부터 G8 후처리까지 수동 전환
- G5에서 C·온도가 입력된 채택 샘플을 확인한 뒤 G6로 이동하고, G6 출강 기록 후 G7→G8 완료 처리
- 자재 투입, 샘플 채취, 분석 결과, 누적 산소·산소 유량·랜스 높이 체크포인트, 재취련, 출강 기록
- 초기·DEMO 차지 삭제, 진행 차지 취소, 완료 차지 보관과 확인 절차가 있는 작업공간 초기화·직전 상태 복구
- 강종을 계속 추가하고 C·온도·P·Mn·Si·S 목표 범위를 직접 설정
- 재료를 추가하고 분류, 기본 단위, C·Si·Mn·P·S·CaO 함량을 관리
- kg·t·g 입력을 kg로, %·wt%·ppm 성분 입력을 %로 환산하고 원래 값·단위를 함께 보존
- 미래·시작 전·단계 역행 시각, 감소하는 누적 산소, 중복 차지·샘플, 빈 분석값과 물리 범위 밖 수치를 저장 전에 차단
- 전로 용량, 취련 방식, 랜스 프로필, 저취 가스, 문헌 원본·수정값·현장 승인 계수 설정
- 브라우저 IndexedDB 자동 저장, 필수 파일·해시·행 수·참조·공정 이력 정합성을 검사하는 UTF-8 CSV ZIP 백업·복원
- 사람이 보는 XLSX 보고서 내보내기
- 한국어·영어 화면 전환

### 바로 사용하기

1. [Releases](https://github.com/fullmetalsonic/bof-endpoint-coach/releases/latest)에서 `BOF_Endpoint_Coach_v0.3.0.html`을 받습니다.
2. 회사 공용 PC의 Edge 또는 Chrome에서 파일을 엽니다. 서버 설치와 인터넷 연결은 필요하지 않습니다.
3. 작업자 이름을 입력하고 `빈 작업으로 시작`을 선택합니다. 합성 데이터를 보려면 `DEMO로 체험`을 선택합니다.
4. `기준 정보`에서 강종·재료·설비·계수를 검토합니다.
5. `신규 차지`에서 G0를 만든 뒤 중앙의 `현재 해야 할 일`을 따라 실제 시각·값을 기록합니다.
6. G6에서 출강을 기록하고 G7 후처리 입력이 끝나면 G8로 전환합니다.
7. 교대·브라우저 초기화 전에 `분석 · 리포트`에서 CSV 백업 ZIP을 저장합니다.

단계별 조작은 [한영 사용 설명서](docs/user-guide.md)에서 확인할 수 있습니다.

초기 공개본은 1280px 이상 데스크톱 화면을 기준으로 설계했습니다. 브라우저 확대/축소는 100%를 권장합니다.

### 화면 설명

| 구역 | 역할 |
| --- | --- |
| 상단 차지 탭·요약 | 동시에 진행 중인 차지를 전환하고 강종, 단계, 경과시간, 산소, 다음 행동을 확인 |
| 좌측 G0~G8 | 장입부터 후처리까지 실제로 입력된 단계 전환 시각을 표시 |
| 중앙 작업 안내판 | 지금 입력할 값, 이 단계의 순서와 완료 상태, C·온도 예상 상태, 다음 단계를 표시 |
| 품질 막대 | 실측·기준 종점 예상·문헌 저/고 시나리오·목표 최소/최대를 같은 축에서 비교 |
| 최근 분석 표 | 채취 시각과 C·Si·Mn·P·S·온도 분석을 확인하고 최근 결과를 수정·무효 처리 |
| 전체 이력·정정 | 유효·정정됨·무효 기록, 분석 채택, 단계 복귀, 출강 정정, 예상 대 실제값을 확인 |
| 우측 Data Ledger | 입력 최신성, 로컬 저장 상태, 외부 연동 여부, 미완료 확인, 계산식·계수·설비 버전을 표시 |
| 하단 입력 버튼 | 자재·샘플·분석·체크포인트·재취련·출강 이벤트를 기록 |

![취련 코치 정정 이력 화면](docs/screenshots/correction-ledger-ko.png)

정정은 원본을 지우지 않습니다. 대상과 영향받는 후속 기록 수를 확인하고 사유를 입력한 뒤 적용하며, 현재값과 참고예상은 유효 기록 기준으로 다시 계산됩니다. 자세한 배치는 [정정·이력 관리 화면 흐름](docs/ui/정정이력_화면흐름_버튼배치_2026-08-23.md)을 참고하십시오.

![강종 목표와 기준 정보 설정](docs/screenshots/settings-ko.png)

강종·재료 설정은 계속 추가할 수 있고 사용되지 않은 항목은 삭제할 수 있습니다. 차지나 이벤트에서 참조 중인 항목과 마지막 남은 항목은 삭제를 막습니다. 코드 중복, 빈 코드, 최소값이 최대값보다 큰 경우에도 저장을 막습니다. 재료 조성은 백업 이력에 보존되지만 합금 수율 계산에는 아직 사용하지 않습니다. `flux` 분류의 투입 중량만 열수지 입력에 반영됩니다.

### 계산 경계

공개 구현의 계산식 버전은 `BOF-REF-CALC 0.2.0`입니다. 샘플 앵커 골격은 다음과 같습니다.

```text
C_end = C_sample + C_literature(O_plan) - C_literature(O_sample)
T_end = T_sample + T_literature(O_plan) - T_literature(O_sample)
effective coefficient = site-approved override > user override > literature original
```

- 기준 온도·압력, 화학량론, PCR, 열손실, 종점 슬래그 FeO, 반응열·엔탈피식은 근거 ID와 함께 보존합니다.
- 문헌 저·고값은 통계적 정확도나 신뢰구간이 아닌 조건부 민감도 시나리오입니다.
- 수치 옆에는 계산식 버전, 계수 프로필, 적용 상태, 문헌 근거 ID, 설비 프로필, 실제/계획 입력 사용 여부가 표시됩니다.
- P·Mn·Si·S 종점 예상은 현장별 승인식과 계수가 없어 비활성입니다.
- 과거 이력 자동 학습·자동 재배포·목표 기준 자동 변경은 하지 않습니다. 초기 버전은 과거 차지의 계산 결과도 자동 고정하지 않습니다.
- 현장 적용 전에는 독립 손계산, 가상 차지, 실제 완료 차지 그림자 검증과 현장 승인이 필요합니다.

상세 명세는 [종점 참고 계산식 초안](docs/domain/종점참고계산식_초안.md), [검증·승인 계획](docs/product/종점참고예상_검증및승인계획_초안.md), [국내·해외 공개자료 카탈로그](docs/research/catalog/자료카탈로그_2026-08-22.md)를 참고하십시오.

### 데이터와 보안

- 운영 데이터는 브라우저의 로컬 IndexedDB에만 자동 저장됩니다.
- 복원 기준 파일은 CSV 7종과 `manifest.csv`를 묶은 ZIP이며, 정정·분석·예상 스냅샷·차지별 기준을 포함하고 복원 전에 SHA-256과 참조 무결성을 검증합니다.
- XLSX는 열람·보고용이며 복원 입력으로 사용하지 않습니다.
- 실제 회사 차지, 사내 기준, 개인 정보 또는 기밀 계수를 이 공개 저장소에 커밋하지 마십시오.
- 공개 DEMO 데이터는 모두 합성이며 실제 회사·설비·작업자를 나타내지 않습니다.

자세한 공개 저장소 보안 원칙은 [SECURITY.md](SECURITY.md)에 있습니다.

### 개발과 검증

```powershell
cd app
npm ci
npm run lint
npm run test
npm run build
npm run build:single
npm run test:e2e
npm run test:sites
```

설치된 브라우저를 별도로 확인하려면 Windows에서 `npm run test:e2e:chrome`과 `npm run test:e2e:edge`를 실행합니다. `npm run build:single`은 `app/package.json`의 버전에 맞춰 루트의 `release/BOF_Endpoint_Coach_v0.3.0.html`을 생성합니다.

검증된 v0.3.0 기준:

- ESLint: PASS
- Vitest: 18개 파일, 91개 테스트 PASS
- 일반 Vite 빌드: PASS
- 단일 오프라인 HTML 빌드: PASS
- 오프라인 호스팅/라우팅: 4개 테스트 PASS
- Chromium·설치된 Google Chrome·Microsoft Edge에서 각각 17개 시나리오 PASS
- 브라우저별 17개에는 실제 조업·정정 흐름 11개, 인간공학·영문 화면 2개, 서버 없는 단일 HTML 1개, 사용 설명서·GitHub형 README·메일 미리보기 3개가 포함
- 작업자 설정→빈 시작→단위 환산→G0~G8→보관·삭제→초기화·복구 흐름: PASS
- DEMO 차지 2건 개별 삭제와 Data Ledger 장식용 새로고침 부재: PASS
- 손상 백업·불가능한 이력·잘못된 단위·시간·값의 저장/복원 차단: PASS
- 분석 수정·무효·한 단계 복귀와 출강 정정·종점 실제값·백업 왕복: PASS
- 서버 없는 단일 HTML 직접 실행·새로고침 후 IndexedDB 보존: PASS
- 한영 전환·1920×1080 한 화면 배치·가로/세로 넘침 없음·주 행동/보조 전환 시각 구분: PASS
- 브라우저 페이지 오류·Vite 오류 오버레이: 0건
- 실제 BOF 종점 예측 정확도: **검증 전**

소스 구조와 결정 이력은 [문서 색인](docs/README.md)과 [누적 이력 관리](docs/governance/누적이력관리.md)에 기록합니다.

## English

BOF Endpoint Coach is a single-file, offline desktop assistant for manual heat logging and **reference endpoint C/temperature estimation**. It supports multiple active heats, G0–G8 event entry, a correction ledger with one-step rollback and post-tap correction, per-heat reference snapshots, local persistence, CSV backup/restore, XLSX reports, and Korean/English UI.

![BOF Endpoint Coach English dashboard](docs/screenshots/dashboard-en.png)

### Important safety boundary

The current source uses synthetic DEMO heats and public-literature scenarios. It is not plant-validated and does not replace equipment control, safety interlocks, standard operating procedures, tap authorization, laboratory results, or operator judgment.

### Quick start

1. Download `BOF_Endpoint_Coach_v0.3.0.html` from the [latest release](https://github.com/fullmetalsonic/bof-endpoint-coach/releases/latest).
2. Open it in Microsoft Edge or Google Chrome on a desktop PC. No server or internet connection is required.
3. Enter an operator display name and choose an empty workspace or optional synthetic DEMO.
4. Review reference profiles, create a heat, and follow the central **Do this now** panel from G0 through G8. It changes from initial inputs to checkpoints, sampling, analysis, tap review, and post-treatment as records are saved.
5. Export a CSV ZIP backup before browser reset, workstation handover, or shift change.

See the [bilingual user guide](docs/user-guide.md) for the complete operating sequence.

### Current limitations

- The public calculation formula version is `BOF-REF-CALC 0.2.0`.
- Endpoint accuracy has not been validated against plant heats.
- Literature originals are preserved; calculation priority is site-approved override, user override, then literature original. An unapproved override is used but clearly labeled.
- Literature low/high outputs are sensitivity scenarios, not statistically validated confidence intervals.
- Only C and temperature have reference equations. P, Mn, Si, and S predictions remain explicitly unavailable.
- Material composition is retained, but alloy-yield prediction is not implemented.
- There is no PLC, HMI, SCC, MES, or LIMS integration.
- Historical correction is enabled, but automatic model training, automatic redeployment, and automatic target changes are not.
- Each heat freezes its starting grade/equipment/coefficient snapshot. A full settings release/diff/approval workflow remains a later feature.
- The UI targets desktop widths of 1280px or wider.

### Source layout

| Path | Purpose |
| --- | --- |
| `app/src/calculation/` | Endpoint calculation and target-state logic |
| `app/src/components/` | Dashboard, dialogs, action bar, and modular settings editors |
| `app/src/domain/` | Gate guidance and settings consistency rules |
| `app/src/storage/` | IndexedDB and CSV handling |
| `app/src/reports/` | Backup/restore and XLSX report generation |
| `app/src/units/` | Explicit unit normalization |
| `app/tests/` | Calculation, storage, backup, report, i18n, validation, and routing tests |
| `docs/` | Product, domain, UI, research, audit, and governance records |
| `release/` | Public single-file offline build |

## License

[MIT](LICENSE). Public documentation sources retain their original copyrights and licenses; this repository links to them rather than redistributing restricted source documents.
