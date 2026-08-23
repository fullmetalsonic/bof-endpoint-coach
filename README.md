# 취련 코치 · BOF Endpoint Coach

[한국어](#한국어) · [English](#english)

오프라인 공용 PC에서 작업자가 직접 입력한 값으로 **C·온도·P·Mn·Si·S 종점을 참고 예상**하고, 여러 차지의 단계·샘플·오차·보정계수·백업을 함께 관리하는 단일 HTML 보조도구입니다.

> **안전·품질 고지:** 공개 문헌식과 합성 DEMO 계수를 사용하며 실제 BOF 현장 정확도는 검증되지 않았습니다. 설비 제어, 안전 인터록, 표준작업, 실험실 분석, 출강 승인 또는 취련사의 판단을 대체하지 않습니다.

![취련 코치 G6 대시보드](docs/manual/screenshots/v0.5.0/14-dashboard-1280-g6.png)

검은 점은 최신 채택 실측, 흰 점은 종점 참고예상, 녹색 선은 강종 목표 범위, 옅은 범위는 문헌 민감도 시나리오입니다. 시나리오 범위는 통계적 신뢰구간이 아닙니다.

## 한국어

### v0.5.0 핵심 변화

- C·온도뿐 아니라 P·Mn·Si·S도 공개 문헌식으로 수치 참고예상
- 중간 샘플마다 문헌 궤적 기대값과 실측 오차를 비교하고, 최신 채택 분석 하나만 종점에 재고정
- 출강 후 확정 분석을 `종점 실제값`으로 지정해 6개 예상/실제/오차 누적
- 강종·설비·계산식·**계수버전**·DEMO/실제 조건을 분리한 오차대장
- 실제 같은 그룹 데이터 1~9/10~29/30~49/50~69/70+ 단계별 계수 후보
- 70건 이상이면 앞쪽 n−20개 학습, 최신 20개 독립 검증
- DEMO와 과거 계수버전은 현재 현장 추천 적용 금지
- 추천은 자동 적용하지 않고 설정 초안으로만 전달
- 계수 변경·복구마다 날짜형 새 버전 생성, 과거 버전과 사유·작업자 보존
- CSV ZIP에 `coefficient_versions.csv`, `calibration_residuals.csv` 추가
- XLSX에 `Residual ledger`, `Calibration candidates`, `Coefficient versions`를 포함한 9개 시트
- 25개 최종 감사 화면을 연결한 [초상세 처음사용자 설명서](docs/manual/취련코치_초상세_처음사용자_설명서_v0.5.0.md)

![학습 오차대장](docs/manual/screenshots/v0.5.0/03-learning-ledger.png)

### 기존 운영·안전 기능

- 첫 실행에서 작업자 표시명을 정하고 빈 작업 또는 선택형 합성 DEMO 시작
- 여러 진행 차지를 탭으로 전환하고 G0 장입부터 G8 후처리까지 실제 시각·값을 수동 기록
- 중앙 `현재 해야 할 일`이 샘플·분석·체크포인트·단계 전환의 다음 행동을 안내
- 용선·스크랩·부원료·산소·랜스·유량·분석의 kg/t/g, %/wt%/ppm 명시적 환산
- 강종과 C·온도·P·Mn·Si·S 목표 범위, 재료 금속성분·슬래그 산화물, 설비·계수 프로필 추가·수정
- 분석·투입·체크포인트 수정·무효, 한 단계 전환 취소, 출강 기록 정정
- 원본을 지우지 않는 정정대장과 영향 미리보기·사유·작업자·시각
- 같은 HTML 여러 창의 저장 revision 충돌 차단과 읽기 전용 전환
- 신규 차지·이벤트·단계·정정·설정 폼의 로컬 초안 복구·명시적 폐기
- IndexedDB 읽기 실패 안전 정지, 저장 재시도, 비상 백업, 이탈 경고
- CSV ZIP 생성 직후 자체 재읽기와 SHA-256·행 수·참조·공정 이력 검증
- 한국어·영어 전환, 1920×1080 기준 산업용 UI, 1366×768·760px 보조 반응형

### 바로 사용하기

1. [Releases](https://github.com/fullmetalsonic/bof-endpoint-coach/releases/latest)에서 `BOF_Endpoint_Coach_v0.5.0.html`을 받습니다.
2. 회사 공용 PC의 Microsoft Edge 또는 Google Chrome에서 엽니다. 서버와 인터넷 연결은 필요하지 않습니다.
3. 작업자 표시명을 입력하고 `빈 작업으로 시작` 또는 `DEMO로 체험`을 선택합니다.
4. 실제 입력 전 `기준 정보`에서 강종·재료·설비·계수를 검토합니다.
5. `신규 차지`의 계산 핵심 6개와 알고 있는 실제 성분을 입력합니다.
6. 중앙 파란 `현재 해야 할 일`을 따라 실제 발생 시각과 값을 기록합니다.
7. 출강 후 확정 분석을 `종점 실제값`으로 지정해 오차대장을 만듭니다.
8. 교대·브라우저 초기화 전에 `분석 · 리포트`에서 CSV ZIP 백업을 저장합니다.

단계별 요약은 [한영 사용 설명서](docs/user-guide.md), 화면별 모든 명칭·단위·예시·검증조건은 [초상세 설명서](docs/manual/취련코치_초상세_처음사용자_설명서_v0.5.0.md), 검증 근거는 [v0.5.0 최종 감사](docs/audits/v0.5.0_최종_기능_UI_UX_회귀감사_2026-08-23.md)에 있습니다.

### 계산과 학습 경계

공개 계산식 버전은 `BOF-REF-CALC 0.3.0`입니다.

```text
sample anchored endpoint
= latest adopted actual
+ literature model change from sample oxygen to planned endpoint oxygen

endpoint residual = confirmed actual endpoint - saved tap-time prediction
candidate offset = current offset + trimmed mean(training residuals)
```

- C는 산소 물질수지, 온도는 축약 열수지, Si·P·Mn·S는 원소수지·슬래그 조성·온도 기반 공개 문헌식을 사용합니다.
- 강종 목표값은 계산 입력이 아니라 계산 후 높음/낮음/범위 내 판정에만 사용합니다.
- 최신 채택 분석만 현재 종점을 고정하며 다른 샘플은 오차 비교로 보존합니다.
- 문헌값 적용 우선순위는 `현장 승인 수정값 → 사용자 수정·미승인값 → 문헌 원본값`입니다.
- P·Mn·Si·S까지 값은 나오지만 현장별 수율·슬래그·분석 특성에 민감합니다. 화면의 문헌 신뢰도와 실제 오차를 함께 보십시오.
- 취련 중 Alloy·Scrap 투입은 등록 조성과 질량을 반영하되 별도 현장 수율계수가 없어 명목 100% 금속 회수를 가정합니다. 실제 합금 수율로 해석하지 마십시오.
- 목표범위, 계수 또는 모델을 자동으로 저장·배포하지 않습니다.
- 실제 추천을 현장 적용하려면 같은 비교군 데이터, 최신 20개 독립 검증, 원인 검토와 현장 승인이 필요합니다.

상세 계산 명세는 [v0.5 학습형 종점예상 구현명세](docs/product/v0.5_학습형_종점예상_구현명세_2026-08-23.md), [문헌 근거 매트릭스](docs/research/종점계수_문헌근거매트릭스_2026-08-22.md), [공개자료 카탈로그](docs/research/catalog/자료카탈로그_2026-08-22.md)에 있습니다.

### 계수 버전과 복구

![계수 버전 이력](docs/manual/screenshots/v0.5.0/08-settings-coefficient-history.png)

- 오프셋 또는 계산계수를 바꾸고 변경 사유와 함께 저장하면 이전 상태를 보관하고 새 계수버전을 만듭니다.
- 과거 버전의 `초안으로 복구`는 현재 이력을 덮어쓰지 않고 과거값을 새 초안으로 복사합니다.
- 복구 초안을 저장하면 또 하나의 새 버전이 생기므로 잘못된 축적 보정 뒤에도 날짜별로 되돌릴 수 있습니다.
- 각 예측 스냅샷과 오차행은 실제 사용한 계수버전 ID를 함께 보존합니다.

### 데이터와 보안

- 운영 데이터는 현재 브라우저의 IndexedDB에만 자동 저장됩니다.
- CSV ZIP은 `manifest.csv`와 복원용 CSV 9종을 포함하며 SHA-256과 행 수를 검사합니다.
- XLSX 9개 시트는 열람·보고용이며 복원 파일이 아닙니다.
- 실제 회사 차지, 사내 기준, 개인 정보, 현장 계수 또는 자격 증명을 공개 저장소에 커밋하지 마십시오.
- PLC·HMI·SCC·MES·LIMS 연동은 없습니다. 모든 공정값은 작업자가 수동 입력합니다.

자세한 보안 원칙은 [SECURITY.md](SECURITY.md)에 있습니다.

### 개발과 검증

```powershell
cd app
npm ci
npm run lint
npm test
npm run build
npm run build:single
npm run test:sites
```

v0.5.0 최종 후보 기준:

- ESLint: PASS
- Vitest: 21개 파일, 108개 테스트 PASS
- Vite production·Sites 패키징: PASS
- 앱 내 브라우저 실제 조작 감사: PASS
- 1920×1080, 1280×905, 1366×768, 760×900 화면 감사: PASS
- CSV ZIP 생성·자체 재읽기·SHA-256: PASS
- Excel 9개 시트 생성: PASS
- 브라우저 error/warn 로그: 0건
- 실제 BOF 종점 정확도: **검증 전**

## English

BOF Endpoint Coach v0.5.0 is a single-file, offline desktop assistant for manually logging multiple BOF heats and producing **reference endpoint estimates for C, temperature, P, Mn, Si, and S**.

### What v0.5.0 adds

- Public-literature endpoint models for all six quality items.
- Per-sample trajectory residuals while only the latest adopted analysis anchors the current endpoint.
- Post-tap validation using a separately confirmed actual endpoint analysis.
- Residual groups separated by grade, equipment, formula, coefficient version, and DEMO/field status.
- Evidence stages at 1–9, 10–29, 30–49, 50–69, and 70+ rows, with the latest 20 held out for validation at 70+.
- Review-only coefficient candidates; no automatic application, target changes, or redeployment.
- Dated coefficient versions with non-destructive restore into a new draft.
- Integrity-checked CSV ZIP backup including coefficient versions and calibration residuals.
- A nine-sheet XLSX report and a screenshot-backed detailed first-user guide.

### Quick start

1. Download `BOF_Endpoint_Coach_v0.5.0.html` from the [latest release](https://github.com/fullmetalsonic/bof-endpoint-coach/releases/latest).
2. Open it in Microsoft Edge or Google Chrome. No server or internet connection is required.
3. Enter a local operator display name and choose an empty workspace or synthetic DEMO.
4. Review grade, material, equipment, and coefficient settings.
5. Create a heat and follow the central **Do this now** panel using actual times and values.
6. After tapping, select a confirmed analysis as the **Actual endpoint** to build the residual ledger.
7. Export a CSV ZIP backup before shift handover, browser reset, or PC change.

### Important limitations

- Formula version `BOF-REF-CALC 0.3.0` is a public-literature starting point, not a plant-approved model.
- Literature confidence differs by element, and plant accuracy has not been validated.
- Scenario ranges are sensitivity cases, not statistical confidence intervals.
- The tool does not replace equipment control, interlocks, SOPs, laboratory results, tap authorization, or operator judgment.
- It has no PLC, HMI, SCC, MES, or LIMS integration.
- DEMO residuals and historical coefficient-version residuals cannot be applied as current field recommendations.
- Each coefficient recommendation requires human review, a reasoned settings revision, and site approval where applicable.

See the [bilingual operating guide](docs/user-guide.md), [ultra-detailed first-user guide](docs/manual/취련코치_초상세_처음사용자_설명서_v0.5.0.md), and [final v0.5.0 audit](docs/audits/v0.5.0_최종_기능_UI_UX_회귀감사_2026-08-23.md).

## Source layout

| Path | Purpose |
| --- | --- |
| `app/src/calculation/` | Six-item endpoint and trajectory models |
| `app/src/calibration/` | Residual ledger and reviewed recommendations |
| `app/src/domain/` | Process gates, correction, coefficient versions, validation |
| `app/src/components/` | Dashboard, dialogs, quality bars, settings editors |
| `app/src/storage/` | IndexedDB and persistence integrity |
| `app/src/reports/` | CSV ZIP backup/restore and XLSX generation |
| `app/tests/` | Calculation, storage, backup, report, UI, and validation tests |
| `docs/` | Product, research, audit, governance, and manuals |
| `release/` | Public single-file app and offline guides |

## License

[MIT](LICENSE). Linked public sources retain their original copyrights and licenses.
