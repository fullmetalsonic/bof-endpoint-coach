// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QualityBar } from "../src/components/QualityBar.jsx";
import { HeatSummaryBar } from "../src/components/HeatSummaryBar.jsx";
import { AnalysisTable } from "../src/components/AnalysisTable.jsx";
import { createDemoState } from "../src/data/demoState.js";

afterEach(cleanup);

describe("display safety", () => {
  it("shows missing target bounds as unavailable instead of zero", () => {
    render(<QualityBar row={{ key: "C", target: { min: null, max: null, unit: "%", decimals: 3 }, actual: null, actualState: "unknown", prediction: { available: false }, predictionState: "unknown" }} locale="ko" t={(key) => key} />);
    expect(screen.queryByText("0.000")).toBeNull();
    expect(screen.getAllByText("–").length).toBeGreaterThan(0);
  });

  it("renders a heat whose selected grade has blank carbon targets", () => {
    const state = createDemoState();
    state.settings.gradeProfiles.push({ code: "BLANK", nameKo: "빈 기준", nameEn: "Blank", targets: { C: { min: null, max: null, unit: "%", decimals: 3 } } });
    const heat = { ...state.heats[0], gradeCode: "BLANK" };
    render(<HeatSummaryBar heat={heat} heats={[heat]} settings={state.settings} locale="ko" t={(key) => key} selectHeat={() => {}} calculation={{ calculatedAt: new Date().toISOString(), demo: false, basis: { status: "literature_reference", labelKo: "문헌 기본" } }} onNewHeat={() => {}} />);
    expect(screen.getByText("빈 기준")).toBeTruthy();
    expect(screen.getByText("–")).toBeTruthy();
  });

  it("keeps non-adopted historical analysis values visible in the recent-results table", () => {
    const state = createDemoState();
    render(<AnalysisTable heat={state.heats[0]} locale="ko" t={(key) => key} onCorrection={() => {}} onOpenTimeline={() => {}} />);
    expect(screen.getByText("0.096")).toBeTruthy();
    expect(screen.getByText("0.128")).toBeTruthy();
    expect(screen.getAllByText("OES")).toHaveLength(3);
  });
});
