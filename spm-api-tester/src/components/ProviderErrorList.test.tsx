import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProviderErrorList } from "./ProviderErrorList";

describe("ProviderErrorList", () => {
  it("surfaces support identifiers and incomplete pagination", () => {
    const markup = renderToStaticMarkup(
      <ProviderErrorList
        emptyLabel="none"
        page={{
          data: [
            {
              id: "perr_1",
              code: "PROVIDER_CREDENTIALS_FAILED",
              title: "Provider credential mint failed",
              provider: "stripe",
              operation: "credentials",
              rail: "spt",
              detail: "Provider rejected the mint.",
              provider_correlation_id: "corr_safe_1",
              payment_credential_id: "cred_attempt_1",
              occurred_at: "2030-01-01T00:00:00.000Z",
            },
          ],
          pagination: { has_more: true, next_cursor: "cursor_2" },
        }}
      />,
    );

    expect(markup).toContain("credentials");
    expect(markup).toContain("Provider credential mint failed");
    expect(markup).toContain("Provider rejected the mint.");
    expect(markup).toContain("corr_safe_1");
    expect(markup).toContain("cred_attempt_1");
    expect(markup).toContain("More provider errors exist");
    expect(markup).toContain("cursor_2");
  });
});
