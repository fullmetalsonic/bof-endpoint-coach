// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { AppErrorBoundary } from "../src/components/AppErrorBoundary.jsx";

afterEach(cleanup);

function BrokenScreen() {
  throw new Error("test_ui_failure");
}

describe("app error boundary", () => {
  it("leaves a recovery action instead of a blank page", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    render(createElement(AppErrorBoundary, null, createElement(BrokenScreen)));
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: "화면 새로고침" })).toBeTruthy();
    expect(screen.getByText("test_ui_failure")).toBeTruthy();
    consoleError.mockRestore();
  });
});
