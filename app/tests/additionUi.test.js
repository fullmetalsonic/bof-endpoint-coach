// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { AdditionCoachBar } from "../src/components/addition/AdditionCoachBar.jsx";
import { AdditionLearningPanel } from "../src/components/addition/AdditionLearningPanel.jsx";
import { AdditionRecoveryCardDialog } from "../src/components/addition/AdditionRecoveryCardDialog.jsx";
import { calculateEndpoint } from "../src/calculation/endpoint.js";
import { createDemoState, createEmptyState } from "../src/data/demoState.js";

afterEach(cleanup);

describe("addition coach UI", () => {
  it("opens the comparison in read-only mode without writing a viewed proposal", () => {
    const state = createDemoState();
    const heat = state.heats[0];
    const onRefresh = vi.fn();
    render(createElement(AdditionCoachBar, { heat, settings: state.settings, endpoint: calculateEndpoint(heat, state.settings), locale: "ko", canWrite: false, onRefresh, onSavePlan: vi.fn(), onDecision: vi.fn(), onSetHidden: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "비교 보기" }));
    expect(screen.getByRole("dialog", { name: "투입 계획 비교" })).toBeTruthy();
    expect(screen.getByText(/코치안은 참고 계획이며 실제 투입 기록이 아닙니다/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/([\d,]+)–\1 (?:kg|Nm³)/);
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("makes the addition learning boundary and empty-state instruction visible", () => {
    const state = createEmptyState();
    render(createElement(AdditionLearningPanel, { state, locale: "ko", canWrite: true, onBringCandidate: vi.fn(), onOpenRecoveryCard: vi.fn() }));
    expect(screen.getByRole("heading", { name: "투입 코치 오차학습" })).toBeTruthy();
    expect(screen.getByText(/실제 투입 전·후 분석/)).toBeTruthy();
    expect(screen.getByText(/코치안과 연결된 실제 투입 뒤에 분석값/)).toBeTruthy();
  });

  it("opens a recovery card with literature defaults when a legacy settings object has no addition profile", () => {
    const state = createEmptyState();
    const legacySettings = structuredClone(state.settings);
    delete legacySettings.additionModelProfiles;
    render(createElement(AdditionRecoveryCardDialog, { settings: legacySettings, heats: [], locale: "ko", canWrite: true, onClose: vi.fn(), onApply: vi.fn() }));
    expect(screen.getByRole("dialog", { name: "투입계수 비상복구 카드" })).toBeTruthy();
    expect(screen.getAllByRole("row")).toHaveLength(7);
  });
});
