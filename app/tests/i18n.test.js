import { describe, expect, it } from "vitest";
import { translate, translations } from "../src/i18n/translations.js";

describe("translations", () => {
  it("has the same keys in Korean and English", () => {
    expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations.ko).sort());
    expect(translate("ko", "appName")).toBe("취련 코치");
    expect(translate("en", "appName")).toBe("BOF Endpoint Coach");
  });
});
