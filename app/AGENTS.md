# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## 취련 코치 고정 기준

- 시각 기준선은 `1-Photo-1.jpg`의 전문형 Data Ledger 데스크톱 화면이다.
- 초기 버전의 중심은 종점 C·온도 수치 참고예상이며 단순 기록 앱으로 축소하지 않는다.
- 실제 회사 데이터·계수는 소스에 넣지 않는다. 공개 데모는 항상 `DEMO / 현장 검증 전`으로 표시한다.
- 한국어와 영어를 모두 제공하고, 이모지·그림문자·아이콘만 있는 핵심 버튼은 사용하지 않는다.
- 기능 코드는 계산, 차지, 설정, 저장, 보고서, 다국어, UI 책임으로 분리한다.
- 개발 소스는 모듈형으로 유지하고 `npm run build:single`로 전달용 단일 오프라인 HTML을 만든다.
- 팀·부서명을 코드에 고정하지 않는다. 오프라인 v0은 사용자가 작업자 표시명을 직접 수정하고, 각 기록에는 입력 당시 표시명을 보존한다.
- 실제 동작이 없는 새로고침·상태·알림·단계 표시와 실제 이벤트에서 오지 않은 가상 시각을 화면에 두지 않는다.
- 첫 실행은 DEMO 체험과 빈 작업 시작을 분리하고, DEMO·초안 삭제와 진행/완료 차지의 취소·무효·보관 정책을 구분한다.
- G0~G8은 실제 단계 전환과 이벤트 저장이 작동해야 하며, 릴리스 전 신규 차지부터 출강·후처리까지 브라우저 회귀검증을 수행한다.
- 오입력 복구는 `정정·이력 관리` 한 묶음으로 유지한다. 최근 분석 행에는 수정·무효, 대시보드와 전체 이력 상단에는 한 단계 전환 취소, G7·G8에는 출강 기록 정정을 배치한다. 원본 삭제나 여러 단계 일괄 되감기는 허용하지 않는다.
