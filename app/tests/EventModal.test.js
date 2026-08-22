// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventModal } from "../src/components/EventModal.jsx";
import { createDemoState } from "../src/data/demoState.js";

afterEach(cleanup);

function renderModal(action) {
  const state = createDemoState();
  const atTapReview = action === "tap";
  const heat = {
    ...state.heats[0],
    stage: atTapReview ? "G6" : "G5",
    status: "in_progress",
    stageHistory: atTapReview ? state.heats[0].stageHistory : state.heats[0].stageHistory.slice(0, 6),
  };
  const onSave = vi.fn();
  render(React.createElement(EventModal, { action, heat, settings: state.settings, locale: "ko", t: (key) => key, onClose: () => {}, onSave }));
  return onSave;
}

describe("EventModal submissions", () => {
  it.each(["sample", "checkpoint", "tap"])("submits %s without evaluating material-only data", (action) => {
    const onSave = renderModal(action);
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toBe(action);
  });

  it("requires at least one analysis value", () => {
    const onSave = renderModal("analysis");
    expect(screen.getByRole("button", { name: "save" }).disabled).toBe(true);
    fireEvent.change(screen.getByRole("spinbutton", { name: "T (°C)" }), { target: { value: "1670" } });
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(onSave).toHaveBeenCalledWith("analysis", expect.objectContaining({ values: expect.objectContaining({ temperature: "1670" }) }));
  });

  it("submits a material amount after unit normalization", () => {
    const onSave = renderModal("material");
    fireEvent.change(screen.getByRole("spinbutton", { name: /amount/ }), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(onSave).toHaveBeenCalledWith("material", expect.objectContaining({ amountKg: 1 }));
  });

  it("normalizes ppm analysis input to percent and keeps its source unit", () => {
    const onSave = renderModal("analysis");
    fireEvent.change(screen.getByRole("spinbutton", { name: /^P / }), { target: { value: "200" } });
    fireEvent.change(screen.getByRole("combobox", { name: "P unit" }), { target: { value: "ppm" } });
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    expect(onSave).toHaveBeenCalledWith("analysis", expect.objectContaining({ values: expect.objectContaining({ P: 0.02 }), originalValues: expect.objectContaining({ P: { value: "200", unit: "ppm" } }) }));
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
