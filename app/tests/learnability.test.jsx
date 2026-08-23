// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionBar } from "../src/components/ActionBar.jsx";
import { HeatModal } from "../src/components/HeatModal.jsx";
import { OperatorModal } from "../src/components/OperatorModal.jsx";
import { createReferenceSettings } from "../src/data/referenceSettings.js";
import { translate } from "../src/i18n/translations.js";
import { EmptyDashboard } from "../src/screens/EmptyDashboard.jsx";
import { HelpScreen } from "../src/screens/HelpScreen.jsx";

afterEach(cleanup);

describe("first-use learnability", () => {
  it("explains the two first-run modes before the operator chooses one", () => {
    render(<OperatorModal locale="ko" firstRun onSave={vi.fn()} />);
    expect(screen.getByText(/합성 차지로 버튼·단계·정정 흐름/)).toBeTruthy();
    expect(screen.getByText(/차지 없이 시작해 기준 정보를 확인/)).toBeTruthy();
    expect(screen.getByText(/작업자 이름을 입력하면/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "DEMO로 체험" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "빈 작업으로 시작" }).disabled).toBe(true);
  });

  it("shows an explicit three-step path on an empty workspace", () => {
    render(<EmptyDashboard locale="ko" onNewHeat={vi.fn()} onLoadDemo={vi.fn()} onOpenSettings={vi.fn()} onOpenHelp={vi.fn()} />);
    expect(screen.getByText("기준 확인")).toBeTruthy();
    expect(screen.getByText("차지 생성")).toBeTruthy();
    expect(screen.getByText("안내 따라 기록")).toBeTruthy();
    expect(screen.getByRole("button", { name: /기준 정보 먼저 확인/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /명칭·단위 도움말/ })).toBeTruthy();
  });

  it("warns when calculation-core values are incomplete and explains units", () => {
    const settings = createReferenceSettings();
    render(<HeatModal settings={settings} existingHeatIds={[]} locale="ko" t={(key) => translate("ko", key)} onClose={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByText("계산 핵심 0/6 입력")).toBeTruthy();
    expect(screen.getByText(/비어 있는 핵심값 때문에/)).toBeTruthy();
    expect(screen.getByText("계획 총 산소 / 누적 산소")).toBeTruthy();
    expect(screen.getByText("Nm³ / Nm³/min")).toBeTruthy();
  });

  it("puts the availability reason inside every disabled action", () => {
    const availability = { material: true, sample: false, analysis: false, checkpoint: false, reblow: false, tap: false };
    render(<ActionBar t={(key) => translate("ko", key)} locale="ko" onAction={vi.fn()} availability={availability} recommendedAction="material" />);
    expect(screen.getByRole("button", { name: /샘플 채취 기록 · G2~G7/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /분석 결과 입력 · G2~G7·샘플 후/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /출강 기록 · G6 전용/ })).toBeTruthy();
  });

  it("provides a persistent glossary and stage map from the main navigation", () => {
    render(<HelpScreen locale="ko" onStart={vi.fn()} onSettings={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "처음 사용하는 분을 위한 화면 도움말" })).toBeTruthy();
    expect(screen.getByText("차지(Heat)")).toBeTruthy();
    expect(screen.getByText("Nm³")).toBeTruthy();
    expect(screen.getByText("Data Ledger")).toBeTruthy();
    expect(screen.getByText(/P·Mn·Si·S 종점 예상은/)).toBeTruthy();
  });

  it("provides real English definitions instead of a generic fallback", () => {
    render(<HelpScreen locale="en" onStart={vi.fn()} onSettings={vi.fn()} />);
    expect(screen.getByText("Cumulative oxygen")).toBeTruthy();
    expect(screen.getByText(/Normalized oxygen volume supplied per minute/)).toBeTruthy();
    expect(screen.getByText(/Review the final sample, analysis, and site criteria/)).toBeTruthy();
  });
});
