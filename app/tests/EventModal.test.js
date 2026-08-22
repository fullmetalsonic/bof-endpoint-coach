// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventModal } from "../src/components/EventModal.jsx";
import { createDemoState } from "../src/data/demoState.js";

afterEach(cleanup);

function renderModal(action) {
  const state = createDemoState();
  const heat = { ...state.heats[0], stage: "G6" };
  const onSave = vi.fn();
  render(React.createElement(EventModal, { action, heat, settings: state.settings, locale: "ko", t: (key) => key, onClose: () => {}, onSave }));
  return onSave;
}

describe("EventModal submissions", () => {
  it.each([
    ["sample", null],
    ["analysis", null],
    ["checkpoint", null],
    ["tap", null],
  ])("submits %s without evaluating material-only data", (action) => {
    const onSave = renderModal(action);
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toBe(action);
  });

  it("submits a material amount after unit normalization", () => {
    const onSave = renderModal("material");
    fireEvent.change(screen.getByRole("spinbutton", { name: /amount/ }), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(onSave).toHaveBeenCalledWith("material", expect.objectContaining({ amountKg: 1 }));
  });

  it("submits reblow only after an actual oxygen amount is entered", () => {
    const onSave = renderModal("reblow");
    fireEvent.change(screen.getByRole("spinbutton", { name: /추가 산소/ }), { target: { value: "300" } });
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(onSave).toHaveBeenCalledWith("reblow", expect.objectContaining({ additionalOxygenNm3: "300" }));
  });

  it("blocks a duplicate sample id", () => {
    const onSave = renderModal("sample");
    fireEvent.change(screen.getByRole("textbox", { name: "sampleId" }), { target: { value: "S-DEMO-03" } });
    expect(screen.getByRole("button", { name: "save" }).disabled).toBe(true);
    expect(onSave).not.toHaveBeenCalled();
  });
});
