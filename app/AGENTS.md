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
- 동일 작업공간을 여러 창에서 열 때는 저장 revision을 비교해 오래된 창의 덮어쓰기를 막고, 변경을 감지한 창은 최신 상태를 다시 읽기 전까지 읽기 전용으로 둔다.
- 신규 차지·이벤트·단계 전환·정정·설정 입력은 폼과 기준 버전별 로컬 초안으로 보존하고, 자동 보존 사실과 명시적 `초안 버리기` 행동을 함께 제공한다.
- 설정 저장은 변경이 있을 때만 허용하며 새 버전, 이전 버전, 변경자, 시각, 사유와 필드별 차이를 이력으로 남긴다. 진행 차지의 시작 시점 설정 스냅샷은 소급 변경하지 않는다.
- 1920×1080의 200% 상당 표시영역에서도 페이지 전체 가로 넘침 없이 핵심 조작을 완료할 수 있어야 한다. 모든 모달은 접근 가능한 이름, Escape 정책, 포커스 순환과 호출 위치 복귀를 제공한다.
- 브라우저 회귀시험은 기존 5173 개발 서버를 재사용하지 않는다. 반드시 `npm run test:e2e` 계열의 사전검사를 통과하고 Playwright가 현재 작업공간의 서버를 새로 시작하게 한다.
- 브라우저 시험이 소스와 맞지 않게 실패하면 코드를 수정하기 전에 포트 점유 프로세스, 현재 작업경로, 앱 버전, 버전별 필수 소스 표식을 확인한다. 구형 서버가 의심되면 `docs/governance/디버그_재발방지_대장.md`의 절차를 따른다.
