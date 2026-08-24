import { describe, expect, it } from "vitest";
import { validateSourceContract } from "../scripts/e2e-preflight-lib.mjs";

const packageJson = { name: "bof-endpoint-coach", version: "0.7.3" };
const referenceSource = "createLiteratureAdditionProfile additionModelProfiles OptionalDissolvedOxygenSection not_recorded";

describe("E2E source preflight", () => {
  it("accepts the current workspace and version markers", () => {
    expect(
      validateSourceContract({ cwd: "C:/project/app", expectedRoot: "C:/project/app", packageJson, referenceSource }),
    ).toMatchObject({ version: "0.7.3" });
  });

  it("blocks a different workspace", () => {
    expect(() =>
      validateSourceContract({ cwd: "C:/old/app", expectedRoot: "C:/project/app", packageJson, referenceSource }),
    ).toThrow("E2E_WORKSPACE_MISMATCH");
  });

  it("blocks a version whose required source marker is missing", () => {
    expect(() =>
      validateSourceContract({ cwd: "C:/project/app", expectedRoot: "C:/project/app", packageJson, referenceSource: "" }),
    ).toThrow("E2E_SOURCE_MARKER_MISSING");
  });

  it("requires an explicit source contract for each app version", () => {
    expect(() =>
      validateSourceContract({
        cwd: "C:/project/app",
        expectedRoot: "C:/project/app",
        packageJson: { ...packageJson, version: "9.9.9" },
        referenceSource,
      }),
    ).toThrow("E2E_SOURCE_CONTRACT_MISSING");
  });
});
