import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RailChips } from "./StatusPill";

describe("RailChips", () => {
  it("renders the current rails[].error.code wire field", () => {
    const html = renderToStaticMarkup(
      <RailChips
        rails={[
          {
            rail: "spt",
            provider: "stripe",
            status: "error",
            error: { code: "PROVIDER_ENROLLMENT_FAILED" },
          },
        ]}
      />,
    );
    expect(html).toContain("PROVIDER_ENROLLMENT_FAILED");
  });
});
