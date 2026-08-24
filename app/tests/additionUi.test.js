// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement, useState } from "react";
import { AdditionCoachBar } from "../src/components/addition/AdditionCoachBar.jsx";
import { AdditionLearningPanel } from "../src/components/addition/AdditionLearningPanel.jsx";
import { AdditionRecoveryCardDialog } from "../src/components/addition/AdditionRecoveryCardDialog.jsx";
import { calculateEndpoint } from "../src/calculation/endpoint.js";
import { createDemoState, createEmptyState } from "../src/data/demoState.js";

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe("addition coach UI", () => {
  it("opens the comparison in read-only mode without writing a viewed proposal", () => {
    const state = createDemoState();
    const heat = state.heats[0];
    const onRefresh = vi.fn();
    render(createElement(AdditionCoachBar, { heat, settings: state.settings, endpoint: calculateEndpoint(heat, state.settings), locale: "ko", canWrite: false, onRefresh, onSavePlan: vi.fn(), onDecision: vi.fn(), onSetHidden: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "비교 보기" }));
    expect(screen.getByRole("dialog", { name: "투입 계획 비교" })).toBeTruthy();
    expect(screen.getByText(/코치안은 참고 계획이며 실제 투입 기록이 아닙니다/)).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/현재 작업공간이 저장 잠금 상태/);
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

  it("disables plan saving and explains missing conditional timing inputs", () => {
    const state = createDemoState();
    const heat = state.heats[0];
    render(createElement(AdditionCoachBar, { heat, settings: state.settings, endpoint: calculateEndpoint(heat, state.settings), locale: "ko", canWrite: true, onRefresh: vi.fn(), onSavePlan: vi.fn(), onDecision: vi.fn(), onSetHidden: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "비교 보기" }));
    expect(screen.getByRole("dialog", { name: "투입 계획 비교" })).toBeTruthy();
    const save = screen.getByRole("button", { name: "내 계획 저장" });

    fireEvent.change(screen.getByLabelText("예정 기준"), { target: { value: "elapsed" } });
    expect(save.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toMatch(/취련 경과시간을 0분 이상/);
    fireEvent.change(screen.getByLabelText(/취련 경과 \(min\)/), { target: { value: "3.5" } });
    expect(save.disabled).toBe(false);

    fireEvent.change(screen.getByLabelText("예정 기준"), { target: { value: "oxygen" } });
    expect(save.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toMatch(/누적 산소량을 0 Nm³ 이상/);

    fireEvent.change(screen.getByLabelText("예정 기준"), { target: { value: "local_time" } });
    fireEvent.change(screen.getByLabelText("예정 시각"), { target: { value: "2000-01-01T00:00:00" } });
    expect(save.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toMatch(/차지 시작 이후/);
  });

  it("records keeping only the saved plan and prevents duplicate clicks", async () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[0]);
    heat.additionCoach = {
      hidden: false,
      proposals: [{ id: "P-KEEP", status: "active" }],
      decisions: [],
      operatorPlans: [{ id: "PLAN-KEEP", status: "active", operationType: "oxygen", amount: 10, unit: "Nm³", timingMode: "now", recordedAt: new Date().toISOString() }],
    };
    const onDecision = vi.fn(() => true);
    render(createElement(AdditionCoachBar, { heat, settings: state.settings, endpoint: calculateEndpoint(heat, state.settings), locale: "ko", canWrite: true, onRefresh: vi.fn(), onSavePlan: vi.fn(), onDecision, onSetHidden: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "비교 보기" }));
    const keep = screen.getByRole("button", { name: "저장된 내 계획 채택" });

    fireEvent.click(keep);

    await waitFor(() => expect(onDecision).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/저장된 내 계획을 채택한다고 기록/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "내 계획 채택 기록됨" }).disabled).toBe(true);
  });

  it("replaces an older manual draft after copying the coach proposal", async () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[0]);
    heat.additionCoach.proposals = [{ id: "P-COPY", status: "active" }];
    const onSavePlan = vi.fn(async () => true);
    render(createElement(AdditionCoachBar, { heat, settings: state.settings, endpoint: calculateEndpoint(heat, state.settings), locale: "ko", canWrite: true, onRefresh: vi.fn(), onSavePlan, onDecision: vi.fn(() => true), onSetHidden: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "비교 보기" }));
    const amount = screen.getByRole("spinbutton", { name: /^예상량/ });
    fireEvent.change(amount, { target: { value: "999" } });
    expect(screen.getByText(/계획 초안이 자동 보관/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "코치안을 계획으로 복사" }));

    await waitFor(() => expect(onSavePlan).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(amount.value).not.toBe("999"));
    expect(screen.getByText(/저장된 내 계획으로 복사했습니다/)).toBeTruthy();
    expect(screen.queryByText(/계획 초안이 자동 보관/)).toBeNull();
    const copied = screen.getByRole("button", { name: "코치안 복사 기록됨" });
    expect(copied.disabled).toBe(true);
    fireEvent.click(copied);
    expect(onSavePlan).toHaveBeenCalledTimes(1);
  });

  it("keeps the operator draft and records no decision when coach-plan saving fails", async () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[0]);
    heat.additionCoach.proposals = [{ id: "P-FAIL", status: "active" }];
    const onDecision = vi.fn();
    render(createElement(AdditionCoachBar, { heat, settings: state.settings, endpoint: calculateEndpoint(heat, state.settings), locale: "ko", canWrite: true, onRefresh: vi.fn(), onSavePlan: vi.fn(async () => false), onDecision, onSetHidden: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "비교 보기" }));
    const amount = screen.getByRole("spinbutton", { name: /^예상량/ });
    fireEvent.change(amount, { target: { value: "999" } });

    fireEvent.click(screen.getByRole("button", { name: "코치안을 계획으로 복사" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/계획을 저장하지 못했습니다/));
    expect(amount.value).toBe("999");
    expect(onDecision).not.toHaveBeenCalled();
    expect(screen.getByText(/계획 초안이 자동 보관/)).toBeTruthy();
  });

  it("keeps the comparison open and explains when deferring cannot be recorded", async () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[0]);
    heat.additionCoach.proposals = [{ id: "P-DEFER-FAIL", status: "active" }];
    render(createElement(AdditionCoachBar, { heat, settings: state.settings, endpoint: calculateEndpoint(heat, state.settings), locale: "ko", canWrite: true, onRefresh: vi.fn(), onSavePlan: vi.fn(), onDecision: vi.fn(async () => false), onSetHidden: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "비교 보기" }));

    fireEvent.click(screen.getByRole("button", { name: "샘플 후 다시 보기" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/계획 판단을 기록하지 못했습니다/));
    expect(screen.getByRole("dialog", { name: "투입 계획 비교" })).toBeTruthy();
  });

  it("keeps a copied plan and reports partial success when only its comparison decision fails", async () => {
    const state = createDemoState();
    const heat = structuredClone(state.heats[0]);
    heat.additionCoach.proposals = [{ id: "P-COPY-DECISION-FAIL", status: "active" }];
    const onSavePlan = vi.fn(async () => true);
    render(createElement(AdditionCoachBar, { heat, settings: state.settings, endpoint: calculateEndpoint(heat, state.settings), locale: "ko", canWrite: true, onRefresh: vi.fn(), onSavePlan, onDecision: vi.fn(async () => false), onSetHidden: vi.fn() }));
    fireEvent.click(screen.getByRole("button", { name: "비교 보기" }));
    const amount = screen.getByRole("spinbutton", { name: /^예상량/ });
    fireEvent.change(amount, { target: { value: "999" } });

    fireEvent.click(screen.getByRole("button", { name: "코치안을 계획으로 복사" }));

    await waitFor(() => expect(onSavePlan).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/내 계획은 저장했지만 비교 판단 이력은 기록하지 못했습니다/));
    expect(amount.value).not.toBe("999");
    expect(screen.queryByText(/계획 초안이 자동 보관/)).toBeNull();
  });

  it("restores a manual draft after closing and reopening even when viewing creates a new proposal", async () => {
    const state = createDemoState();
    const initialHeat = structuredClone(state.heats[0]);
    initialHeat.additionCoach.proposals = [{ id: "P-DRAFT-0", status: "active" }];
    let proposalIndex = 0;
    function Harness() {
      const [heat, setHeat] = useState(initialHeat);
      const refresh = () => setHeat((previous) => ({
        ...previous,
        additionCoach: {
          ...previous.additionCoach,
          proposals: [...previous.additionCoach.proposals, { id: `P-DRAFT-${++proposalIndex}`, status: "active" }],
        },
      }));
      return createElement(AdditionCoachBar, { heat, settings: state.settings, endpoint: calculateEndpoint(heat, state.settings), locale: "ko", canWrite: true, onRefresh: refresh, onSavePlan: vi.fn(), onDecision: vi.fn(), onSetHidden: vi.fn() });
    }
    render(createElement(Harness));
    fireEvent.click(screen.getByRole("button", { name: "비교 보기" }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /^예상량/ }), { target: { value: "999" } });
    await waitFor(() => expect(screen.getByText(/계획 초안이 자동 보관/)).toBeTruthy());
    fireEvent.click(screen.getAllByRole("button", { name: "닫기" }).at(-1));

    fireEvent.click(screen.getByRole("button", { name: "비교 보기" }));

    expect(screen.getByRole("spinbutton", { name: /^예상량/ }).value).toBe("999");
    expect(screen.getByText(/미저장 계획 초안을 복구했습니다/)).toBeTruthy();
  });
});
