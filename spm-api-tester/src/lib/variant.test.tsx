import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MANUAL_VERIFICATION_ENABLED } from "@/lib/env";
import { VariantToggle } from "@/lib/variant";

describe("verification variant defaults", () => {
  it("defaults to the SDK-only product path when Manual verification is not configured", () => {
    expect(MANUAL_VERIFICATION_ENABLED).toBe(false);

    const html = renderToStaticMarkup(<VariantToggle />);
    expect(html).toContain("SDK");
    expect(html).not.toContain("Manual");
  });
});
