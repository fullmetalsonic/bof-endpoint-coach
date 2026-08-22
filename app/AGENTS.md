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
