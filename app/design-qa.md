# Design QA — BOF Endpoint Coach v0.1.0

## Comparison setup

- Source reference: `D:\Codex\취련 코치\.codex-remote-attachments\01a02829-911d-7c30-b89f-b4b8e9e13c08\6b3516d3-f500-4236-89d3-3e0a22a0a92c\1-Photo-1.jpg`
- Implementation screenshot: `D:\Codex\취련 코치\docs\screenshots\dashboard-ko.png`
- Combined comparison: `D:\Codex\취련 코치\work\design-qa\reference-vs-dashboard-ko.png`
- Reference dimensions: 1280 × 912
- Browser viewport: 1280 × 912
- Tested state: synthetic DEMO heat `DEMO-260822-01`, G6 tap review, Korean and English
- Additional widths: 1440 × 900; 1160 × 800 desktop-minimum audit

## Core interactions exercised

- Switch between two simultaneous heats and retain the selected heat.
- Open the analysis modal and confirm the latest real sample is selected.
- Create a new heat from G0 with initial hot metal, scrap, flux, oxygen, lance, grade, equipment, and coefficient inputs.
- Open grade, material-composition, unit-conversion, equipment, and coefficient settings.
- Add a new grade and a new material profile in the settings draft.
- Open backup/report controls and reset the synthetic demo.
- Switch Korean ↔ English and re-check long-label layout.
- Reload in a fresh browser tab and inspect browser error/warning logs.

## Findings and fixes

### Pass 1

- P1 behavior: G3 showed a G6 final-sample instruction and claimed estimates were within target even when C was low and temperature was high. Fixed with gate-specific operational guidance and target-state checks.
- P1 data consistency: G3 elapsed time and sample freshness were hard-coded. Fixed by calculating elapsed/freshness from timestamps and current local time.
- P1 input flow: the analysis modal defaulted to a sample ID that did not exist. Fixed to select the latest existing sample.
- P2 content: the heading repeated “tap review.” Fixed to render `gate + gate label + summary`.

### Pass 2

- P1 workflow gap: operators could not create a heat or add grade/material profiles. Added a G0 new-heat form plus modular grade and material editors.
- P1 calculation meaning: a sample-free G0 heat used cumulative oxygen as if it were endpoint oxygen. Fixed the static fallback to use planned total endpoint oxygen.
- P1 process factor: oxygen flow did not affect projected remaining time. Added `remaining oxygen ÷ oxygen flow` and connected it to the temperature projection.
- P2 unit handling: material mass was fixed to kg. Added kg/t/g selection and normalization to kg with tests.
- P2 settings consistency: duplicate/blank codes and reversed min/max targets could be saved. Added validation that blocks save.

### Pass 3

- P2 English layout: `Temperature` overlapped its adjacent value column. Added English-specific row height/type sizing.
- P2 summary readability: long English grade and next-action strings were truncated to one line. Added two-line clamping and native title text.
- P2 table visibility: six quality rows compressed the sample table behind the fixed action bar. Reduced Korean row height while retaining larger English rows for readability.
- Browser console: fresh-session errors 0; warnings 0.

## Accessibility and resilience

- Visible keyboard focus rings are present for buttons, inputs, and selects.
- Modal dialogs expose dialog roles, accessible headings, close labels, and labeled inputs.
- Iconography uses one consistent Phosphor icon family; no emoji, handcrafted SVG, or CSS illustration substitutes are used.
- The initial product is intentionally a desktop control-room tool. 1280 and 1440 layouts pass without overlap. At 1160, the dense dashboard remains operable via horizontal scrolling; mobile reflow is outside v0.1 scope and documented as unsupported.
- The tool does not use motion, gradients, decorative imagery, or unverified plant branding.

## Final result

passed

---

# Design QA — GitHub형 README 메일 본문 수정

## Comparison setup

- Source visual truth: `D:\Codex\취련 코치\.codex-remote-attachments\01a02829-911d-7c30-b89f-b4b8e9e13c08\21ca6ba7-ef1d-4db6-b886-9bd0218c11ff\1-Photo-1.jpg` through `5-Photo-5.jpg`
- Implementation preview: `D:\Codex\취련 코치\release\BOF_Endpoint_Coach_EMAIL_PREVIEW_v0.1.0.html`
- Implementation screenshot: `D:\Codex\취련 코치\work\email-qa\implementation-email-preview-1280x960.png`
- Full-page screenshot: `D:\Codex\취련 코치\work\email-qa\implementation-email-preview-full-1280.png`
- Mobile-width screenshot: `D:\Codex\취련 코치\work\email-qa\implementation-email-preview-720x960.png`
- Combined comparison: `D:\Codex\취련 코치\work\email-qa\reference-vs-email-preview-1280x960.png`
- Source and implementation viewport: 1280 × 960 CSS px; device density differences were normalized by drawing both captures into equal 1280 × 960 comparison regions.
- Additional responsive viewport: 720 × 960 CSS px.
- State: README opening section with Korean dashboard visible, followed by all Korean/English sections and three inline screenshots.

## Full-view and focused evidence

- The combined first-view comparison confirms the same information order and hierarchy: H1 title, Korean/English links, product summary, safety blockquote, and dashboard screenshot above the Korean feature section.
- The full-page capture confirms that the feature list, quick start, role table, settings screenshot, calculation boundary, security, development verification, English screenshot, and English limitations remain present in README order.
- A separate focused crop was unnecessary because the 1280 × 960 first-view comparison keeps the title, paragraph styling, blockquote, and dashboard screenshot readable at 1:1 viewport size.

## Comparison history

### Pass 1 — blocked

- P1 typography/content: the generic `a` tag styling expression also matched the opening `article` tag, turning most of the README into one underlined link surface. This materially differed from the GitHub reference and reduced readability.
- Fix: constrained inline-style matching to complete tag names with `(?=\\s|>)`, then rebuilt the email body and preview.

### Pass 2 — passed

- Post-fix visual evidence shows underline only on actual links. Headings, paragraph text, bold emphasis, blockquote, lists, code blocks, and tables render independently.
- First dashboard screenshot is visible above the fold at 1280 × 960 and remains fully scaled without horizontal overflow at 720 × 960.
- Browser error/warning logs: 0.

## Required fidelity surfaces

- Fonts and typography: system UI/Segoe UI/Noto Sans KR fallbacks, 32px H1, 24px H2, 20px H3, 16px body, 1.6–1.65 line height, and 700 emphasis preserve the GitHub README hierarchy without Markdown syntax leakage.
- Spacing and layout rhythm: 960px email container, 42px content padding, GitHub-like section spacing, divider rules, table cells, and blockquote inset remain consistent. GitHub repository tabs/sidebar are intentionally omitted because they are site chrome, not README content.
- Colors and tokens: white content, `#f6f8fa` page surface, `#d1d9e0` borders, `#1f2328` text, and `#0969da` links match the visible GitHub light theme. The yellow correction notice is an intentional email-only status banner.
- Image quality and asset fidelity: all three original public README PNG assets are used directly; no placeholders, CSS art, custom SVG substitutes, external image URLs, or recompression are introduced. Email delivery uses CID inline parts.
- Copy and content: the complete public README is retained in Korean and English. The only added copy explains why this corrected email replaces the attachment-only message.
- Responsiveness and accessibility: 720px preview has `scrollWidth == clientWidth`; images are complete and scaled to 597px without clipping. Existing image alt text, heading hierarchy, table semantics, and readable link contrast are retained.

## Final result

passed
