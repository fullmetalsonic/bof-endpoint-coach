# 취련 코치 · BOF Endpoint Coach

[한국어](#한국어) · [English](#english)

작업자가 오프라인 회사 PC에서 조업·샘플·종점·실제 투입 데이터를 직접 입력하면, 공개 문헌 시나리오에서 시작해 사업소·설비별 오차를 안전하게 누적하고 **C·온도·P·Mn·Si·S 종점 참고예상과 선택형 투입량·시점 참고안을 개선하는 단일 HTML 보조도구**입니다.

> **안전·품질 고지:** 현재 공개 버전은 합성 DEMO와 공개 문헌 시나리오만 포함합니다. 실제 BOF 정확도와 현장 적합성은 검증되지 않았습니다. 설비 제어, 인터록, 표준작업, 실험실 분석, 출강 승인 또는 취련사의 판단을 대체하지 않습니다.

![취련 코치 v0.7.3 선택형 용존산소 입력](docs/manual/screenshots/v0.7.3/03-analysis-optional-filled.png)

## 한국어

### v0.7.3 핵심 변화

- **선택형 용존산소 기록:** 분석 결과의 `추가 측정값`을 펼쳐 용강 내 용존산소 `[O]`를 ppm으로 기록
- **미측정 명시:** 값이 없으면 공란으로 저장하며 내부에는 `미측정` 상태를 보존해 0 ppm과 구분
- **계산과 분리:** 현재 종점예상·투입 코치·단계 진행·학습계수에는 사용하지 않는 기록 전용 데이터
- **원장·정정·내보내기:** 전체 이력에서 기록 여부를 확인하고 수정·무효 처리하며 JSON·CSV·Excel에 함께 보존
- **하위 호환:** v0.7.2 이하 JSON은 용존산소 미측정으로 복원되고, 값만 있는 분석 기록도 기존 채택 분석을 자동 교체하지 않음

![접혀 있는 선택 입력](docs/manual/screenshots/v0.7.3/01-analysis-optional-collapsed.png)

### v0.7.2 기반 기능

- **선택형 투입 코치:** Flux·냉각재·합금·가탄재·추가 산소의 참고량과 시점을 한 줄로 표시하며 사용하지 않아도 G단계 진행 가능
- **작업자 계획 비교:** 수기 예상량·예정시각과 코치안을 나란히 비교하되 계획·권고·실제 투입을 별도 원장으로 보존
- **문헌 모델에서 현장 보정으로:** 공개 문헌 시험계수로 즉시 계산하고 실제 투입 전·후 효과 오차가 쌓이면 검토용 투입계수 후보 생성
- **독립 학습 관문:** 10/30/50/70건, 최신 20건 독립검증, 10일·작업자 3명·투입량 3구간·시점 3구간을 확인하며 자동 적용 금지
- **투입계수 비상복구 카드:** 양·시점·효과 핵심 6개를 `BOFARC1` 문자열·화면·인쇄·수기로 기록하고 검증 후 설정 초안으로 복구
- **전체 데이터 연계:** IndexedDB 자동저장, 단일 JSON, CSV·Excel, 설정·모델·후보 버전 이력에 투입 코치 자료 포함

![작업자 계획과 코치 참고안 비교](docs/manual/screenshots/v0.7.2/02-addition-plan-comparison.png)

> 화면 주: 위 이미지는 v0.7.2 초기 후보 캡처입니다. 최종 교정본은 하단 `내 계획 유지`를 `저장된 내 계획 채택`으로 바꾸고, 저장된 활성 계획이 있을 때만 허용하며 완료·실패·중복 방지를 표시합니다.

### v0.6.1 기반 기능

- **보정계수 비상복구 카드:** 현재 적용 중인 C·온도·P·Mn·Si·S 핵심 6개와 선택 학습 실행의 상세 18개를 화면·인쇄·복구문자열로 기록
- **수동 비상복구:** 프로필·계수버전·계산식·기준지문·확인코드를 검사하고 현재값 비교 후 설정 초안으로만 반영
- **근거 보존 원칙:** 카드 복구는 잃어버린 차지·오차·학습 근거를 만들어내지 않으며, 정상 백업은 계속 단일 JSON 사용
- **상세 설명서:** 기존 v0.6.0의 28개 화면과 v0.6.1 카드 절차 6개 화면을 합쳐 명칭·단위·오류·복구 한계를 설명
- **발표용 설명서:** 10~15분 발표 순서, 화면별 대본, 30초 요약과 예상 질문·답변을 제공
- **구두 기능 소개서:** 처음 보는 사용자에게 90초 또는 7~10분으로 자연스럽게 설명하는 말하기 대본과 화면 지시를 제공

![보정계수 핵심 6개 비상복구 카드](docs/manual/screenshots/v0.6.1/02-recovery-card-core.png)

### v0.6 기반 기능

- **오프라인 자동저장 기반 강화:** IndexedDB revision, 저장시각, 다중 창 충돌 감지와 쓰기 잠금
- **단일 JSON 전체 백업:** 차지·설정·오차·학습 실행·모델·유효 복구점을 canonical UTF-8 JSON 한 파일로 저장
- **복원 전 무결성 검증:** 50 MiB 제한, SHA-256, 스키마, 위험 키, 참조, 시각, 설정, 학습 실행을 검사한 뒤에만 적용
- **전체 교체 안전장치:** 현재/백업 요약 비교, 명시적 확인, 적용 직전 보호 복구점, 7일 `마지막 불러오기 취소`
- **내부 복구점:** 단계 전환·출강·계수 변경·삭제·초기화 등 중요 작업 직전 생성, 일반 20개/30일, 보호 항목 유지
- **재현 가능한 학습 실행:** 사용·제외 데이터, 학습/검증 분할, MAE·편향·중앙절대오차·목표 적중률, 후보 오프셋, SHA-256 고정
- **실행 수명주기:** 새 데이터나 계수 변경 시 과거 실행을 삭제하지 않고 `오래됨`으로 표시
- **예상 근거 설명:** `문헌 기본 + 최신 채택 샘플 보정 + 승인된 현장 오프셋 = 표시 종점예상`
- **Excel 개선:** 여러 계수 프로필의 후보를 각 프로필 기준으로 분리해 내보냄
- **중간폭 회귀 보정:** 1280~1400px에서 2단 헤더로 바꿔 우측 상태·작업자 잘림 방지
- **실제 화면이 포함된 상세 설명서**와 한영 요약 설명서

![저장·복구·보고서](docs/manual/screenshots/v0.6.0/01-storage-recovery.png)

### 바로 사용하기

1. [Releases](https://github.com/fullmetalsonic/bof-endpoint-coach/releases/latest)에서 `BOF_Endpoint_Coach_v0.7.3.html`을 받습니다.
2. 회사 PC의 고정 폴더에 저장하고 Edge 또는 Chrome에서 엽니다.
3. 작업자 표시 이름을 입력하고 합성 `DEMO로 체험` 또는 `빈 작업으로 시작`을 선택합니다.
4. 실제 사용 전 `기준 정보`에서 강종·재료·관리게이트·단위·설비·계수를 확인합니다.
5. `신규 차지`에서 실제 G0 값과 실제 시각을 입력합니다.
6. 중앙 `현재 해야 할 일`의 큰 파란 버튼을 따라 조업·샘플·분석·체크포인트·재취련·출강을 기록합니다.
7. 투입량·시점 참고가 필요하면 대시보드 `투입 코치 > 비교 보기`에서 자신의 계획과 비교합니다. 사용하지 않아도 됩니다.
8. 실제 투입은 하단 `자재 투입 기록` 또는 `재송풍 기록`으로 별도 저장합니다.
9. 현재 계수의 최후 수기 복구본이 필요하면 `학습 · 계수`에서 종점계수·투입계수 복구 카드를 각각 기록합니다.
10. 교대·브라우저 정리·PC 이동·계수 변경 전 `분석 · 리포트 > 전체 데이터 JSON으로 저장`을 실행합니다.

요약 절차는 [한영 사용 설명서](docs/user-guide.md), 모든 명칭·단위·입력 예·오류조건은 [v0.7.3 상세 설명서](docs/manual/취련코치_상세_설명서_v0.7.3.md), 기술 발표에는 [v0.7.2 발표용 설명서](docs/manual/취련코치_발표용_설명서_v0.7.2.md), 처음 보는 사용자에게 말로 소개할 때는 [v0.7.2 구두 기능 소개서](docs/manual/취련코치_구두_기능소개_v0.7.2.md), 이번 변경의 검증 결과는 [v0.7.3 종합감사](docs/audits/v0.7.3_선택형_용존산소_기능_UI_UX_데이터_회귀감사_2026-08-24.md)에 있습니다.

### 종점 참고예상

![종점예상 근거](docs/manual/screenshots/v0.6.0/04-prediction-explanation.png)

- C: 정적 물질수지 + 최신 채택 샘플 보정 + 승인 오프셋
- 온도: 정적 열수지 + 산소·시간 보정 + 최신 채택 샘플 보정 + 승인 오프셋
- P·Mn·Si·S: 공개 문헌 시나리오 + 조업 진행 궤적 + 최신 채택 샘플 보정 + 승인 오프셋
- 저·고값: 입력·계수 민감도를 나타내는 문헌 시나리오이며 통계적 신뢰구간이 아님
- 실제 회사 기준과 계수는 공개 저장소에 포함하지 않음

상세 명세는 [v0.5 학습형 종점예상 구현명세](docs/product/v0.5_학습형_종점예상_구현명세_2026-08-23.md), [v0.6 오프라인 AI 기획안](docs/product/v0.6_오프라인_AI_취련코치_기획안_2026-08-23.md), [문헌 근거 매트릭스](docs/research/종점계수_문헌근거매트릭스_2026-08-22.md)에 있습니다.

### 학습 선순환

![학습·계수 실행](docs/manual/screenshots/v0.6.0/05-learning-coefficient-runs.png)

1. 문헌모델이 종점 참고예상을 저장합니다.
2. 출강 후 작업자가 확정 종점 분석을 명시합니다.
3. 실제차지만 강종·설비·식·계수버전별 오차대장에 들어갑니다.
4. 같은 그룹 70건 이상이면 앞쪽 n−20을 학습, 최신 20을 검증에 사용합니다.
5. 최신 검증의 MAE·편향·목표 적중률이 좋아져야 승인 가능한 후보로 표시됩니다.
6. 추천은 설정 초안으로만 전달되며 사람이 현장 승인·사유와 함께 새 계수버전으로 저장합니다.
7. 새 데이터·정정·계수변경이 생기면 과거 실행은 보존한 채 `오래됨`으로 바뀝니다.

현재 알고리즘은 설명 가능한 성분별 편향 오프셋 추천입니다. 신경망·강화학습·설비제어 모델을 자칭하지 않습니다.

### 데이터 저장과 복구

| 기능 | 용도 | 특징 |
| --- | --- | --- |
| IndexedDB 자동저장 | 같은 PC·브라우저에서 이어서 작업 | 약 250ms 지연 저장, revision 충돌 감지 |
| 단일 JSON | 외부 백업·PC 이동·전체 복원 | SHA-256, 즉시 재읽기, 전체 구조 검증 |
| 비상복구 카드 | 핵심 보정계수의 사진·수기 최후 복구 | 핵심 6개 + 선택 상세 18개, 기준지문·확인코드 |
| 내부 복구점 | 중요 작업 직전 빠른 되돌리기 | 일반 20개/30일, 보호 점 유지 |
| 호환 CSV ZIP | v0.5 호환·CSV 확인 | JSON이 v0.6 기본 백업 |
| XLSX | 사람이 열람·보고 | 복원 입력 불가 |

JSON 복원은 자동 병합하지 않고 전체 교체합니다. 현재/백업의 차지·이벤트·오차·학습·복구점 수를 비교한 뒤 체크해야 하며, 직전 작업공간은 보호 복구점으로 남아 7일간 복원 취소가 가능합니다.

### 주요 사용성 원칙

- 한 화면에 한 개의 현재 주 행동
- `입력 → 확인 → 단계 전환` 순서를 중앙에서 표시
- 여러 진행 차지를 상단 탭으로 전환
- 실제 발생시각은 현재시각 기본값을 수정 가능
- 마지막 단계만 복귀하고 과거 수치는 단계 유지 상태에서 정정
- 출강 이후에는 일반 되돌리기 대신 출강 기록 정정과 종점 실제값 지정
- 색뿐 아니라 상태 문구와 막대 위치를 함께 표시
- 1920×1080 주 화면과 1280·760px 회귀 확인

### 로컬 개발과 검증

```bash
cd app
npm ci
npm run check
npm run test:e2e
```

`npm run check`는 lint, 182개 단위·통합 시험, 일반 빌드, 단일 HTML 빌드, Sites worker 시험을 실행합니다. Chromium·Chrome·Edge 각각 31개 E2E는 공정입력, 선택형 용존산소, 다중차지, 정정·출강, JSON 전체복원·취소, 오프라인 단일파일, 다중 창 충돌, 두 종류의 비상복구 카드, 투입계획 비교·학습, 반응형과 문서 렌더링을 확인합니다. 브라우저 시험은 구형 개발 서버를 재사용하지 않으며 현재 작업공간·버전·필수 소스·5173 포트를 사전검사합니다. 실제 회사 PC 정책은 별도 환경 검증이 필요합니다.

### 공개 저장소 보안 원칙

- 공개 데이터는 모두 합성 DEMO이며 실제 회사·설비·작업자를 나타내지 않습니다.
- 실제 차지·사내 기준·개인정보·현장 계수·자격증명을 커밋하지 마십시오.
- 운영 데이터는 브라우저 로컬 IndexedDB와 사용자가 저장한 JSON에만 존재합니다.
- 비상복구 카드·복구문자열·사진·출력물에도 현장 보정계수가 포함될 수 있으므로 회사 승인 보관·폐기 기준을 적용하십시오.
- 네트워크 전송, 텔레메트리, PLC·HMI·SCC·MES·LIMS 연동은 없습니다.
- 자세한 내용은 [SECURITY.md](SECURITY.md)를 확인하십시오.

## English

BOF Endpoint Coach v0.7.3 is a single-file, offline desktop assistant. Operators manually enter heat, process, sample, confirmed endpoint, actual-addition, and optional dissolved-oxygen data. The tool starts with transparent public-literature scenarios and preserves separate endpoint and addition-effect residual evidence so reviewed estimates can improve over time.

### What v0.7.3 adds

- An optional collapsed `[O]` field records dissolved oxygen in ppm only when a measurement is available.
- Blank means **not measured**, which remains distinct from a measured value of 0 ppm.
- The value, source, and note are record-only and do not affect endpoint estimates, addition coaching, stage gates, or current learning coefficients.
- Timeline correction, JSON, CSV, and Excel retain the optional record; pre-v0.7.3 backups migrate as not measured.

### v0.7.2 foundation

- Optional one-line addition coach for fluxes, coolants, alloys, carburizers, and additional oxygen; stage progression never depends on using it
- Side-by-side operator-plan versus coach-reference comparison while plans, proposals, and actual events remain separate records
- Literature-test amount/timing models followed by actual pre/post-effect residual evidence and human-reviewed addition-coefficient candidates
- 10/30/50/70 row gates plus a latest-20 holdout, ten days, three operators, three amount bands, and three timing bands; no automatic application
- BOFARC1 emergency card for six applied amount, timing, and effect corrections; verified restores enter a settings draft only
- IndexedDB, canonical JSON, CSV/Excel, version history, and migration coverage for all addition-coach data

![Addition coach learning](docs/manual/screenshots/v0.7.2/03-addition-learning.png)

### v0.6.1 foundation

- Emergency recovery card for the six applied C, temperature, P, Mn, Si, and S offsets
- Optional 18-value learning detail view: value at run, recommended delta, and candidate for each target
- Manual recovery gated by profile, coefficient version, formula, 12-character base fingerprint, and 8-character check code
- Compare-first draft workflow; normal settings save is still required to create a new coefficient version
- Recovery never fabricates lost heats, residuals, training evidence, or approval history

### v0.6 foundation

- Revisioned IndexedDB autosave and cross-window write-conflict protection
- One canonical UTF-8 JSON containing workspace, settings, residuals, training runs, model registry, and valid recovery points
- SHA-256 plus schema, reference, time, settings, and learning-run validation before restore
- Full-replace preview, protected pre-restore recovery point, and seven-day undo
- Rotating and protected recovery points before critical operations
- Reproducible training-run records with included/excluded data, split, metrics, offsets, and dataset/run hashes
- Current/stale training-run lifecycle without deleting prior evidence
- Estimate explanation: literature baseline + adopted-sample adjustment + approved site offset
- Updated bilingual guides with 28 current screenshots
- A presentation guide with a 10–15 minute talk track, screen cues, a 30-second summary, and expected Q&A

### Quick start

1. Download `BOF_Endpoint_Coach_v0.7.3.html` from the [latest release](https://github.com/fullmetalsonic/bof-endpoint-coach/releases/latest).
2. Open it in Microsoft Edge or Google Chrome at 100% zoom; 1920×1080 is recommended.
3. Set a local operator display name, then choose synthetic DEMO or an empty workspace.
4. Review grade, material, gate, unit, equipment, and coefficient settings.
5. Create a heat from real G0 inputs and follow the central current-action panel.
6. After tapping, explicitly mark a confirmed endpoint analysis before the heat can enter learning.
7. Record the six-value emergency card if you need a screenshot, print, or handwritten last-resort coefficient record.
8. Export the full verified JSON before handover, browser cleanup, PC transfer, or coefficient changes.

### Learning boundary

Only non-DEMO completed heats with a saved endpoint prediction and an explicitly confirmed endpoint analysis are eligible. Data stays separated by grade, equipment, formula, coefficient version, and real/DEMO status. The current learner recommends interpretable per-element bias offsets; it is not a neural network, reinforcement-learning controller, or automatic plant-control system.

### Safety boundary

All six endpoint values are unvalidated public-literature reference estimates. Scenario ranges are not confidence intervals. The tool never replaces plant standards, laboratory results, interlocks, tap authorization, or operator judgment. Do not commit real plant data, internal standards, personal information, site coefficients, credentials, or recovery-card copies to this public repository.
