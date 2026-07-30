import { afterEach, describe, expect, it, vi } from "vitest";
import { collectDeviceContext } from "./deviceContext";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("collectDeviceContext", () => {
  it("omits empty strict optional locale fields", () => {
    vi.spyOn(window.navigator, "language", "get").mockReturnValue("");
    vi.spyOn(Intl, "DateTimeFormat").mockReturnValue({
      resolvedOptions: () => ({ timeZone: "" }),
    } as Intl.DateTimeFormat);

    const context = collectDeviceContext();
    expect(context).not.toHaveProperty("language_code");
    expect(context).not.toHaveProperty("time_zone");
  });
});
