import { describe, expect, it } from "vitest";
import { createDissolvedOxygenRecord, dissolvedOxygenValidationReason, isDissolvedOxygenRecorded, normalizeDissolvedOxygenRecord } from "../src/domain/measurements/dissolvedOxygen.js";

describe("optional dissolved-oxygen records", () => {
  it("stores a blank field as an explicit non-numeric not-recorded state", () => {
    expect(createDissolvedOxygenRecord()).toEqual({ recordStatus: "not_recorded", valuePpm: null, source: null, note: null });
    expect(isDissolvedOxygenRecorded(createDissolvedOxygenRecord())).toBe(false);
  });

  it("normalizes a recorded ppm value without converting it into chemistry percent", () => {
    const record = createDissolvedOxygenRecord({ valuePpm: "520.5", source: "oxygen_probe", note: "  Probe A  " });
    expect(record).toEqual({ recordStatus: "recorded", valuePpm: 520.5, source: "oxygen_probe", note: "Probe A" });
    expect(dissolvedOxygenValidationReason(record)).toBeNull();
    expect(isDissolvedOxygenRecorded(record)).toBe(true);
  });

  it("migrates a missing legacy field and rejects malformed values", () => {
    expect(normalizeDissolvedOxygenRecord(undefined).recordStatus).toBe("not_recorded");
    expect(dissolvedOxygenValidationReason({ recordStatus: "recorded", valuePpm: -1, source: null, note: null })).toBe("dissolved_oxygen_invalid");
    const invalidSource = normalizeDissolvedOxygenRecord({ recordStatus: "recorded", valuePpm: 10, source: "unknown-device", note: null });
    expect(invalidSource.source).toBe("unknown-device");
    expect(dissolvedOxygenValidationReason(invalidSource)).toBe("dissolved_oxygen_source_invalid");
    expect(dissolvedOxygenValidationReason({ recordStatus: "not_recorded", valuePpm: 0, source: null, note: null })).toBe("dissolved_oxygen_status_invalid");
  });
});
