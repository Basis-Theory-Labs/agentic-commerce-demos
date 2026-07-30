import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CredentialRevealCard } from "@/components/CredentialRevealCard";

describe("CredentialRevealCard", () => {
  it("presents card values as a copyable card plus a collapsible field list", () => {
    const html = renderToStaticMarkup(
      <CredentialRevealCard
        credential={{
          id: "cred_test",
          rail: "agentic-token",
          provider: "agentpay",
          amount: { value: "5.00", currency: "USD" },
          expires_at: "2026-07-31T17:10:00.000Z",
          credential: {
            format: "card",
            value: {
              number: "5595356383852890",
              expiration_month: "08",
              expiration_year: "2029",
              cvc: "664",
            },
          },
        }}
      />,
    );

    expect(html).toContain("Credential ID");
    expect(html).toContain("Created credential");
    expect(html).toContain("Single-use card");
    expect(html).toContain("5595 3563 8385 2890");
    expect(html).toContain("Credential fields");
    expect(html).toContain("4 values");
    expect(html).toContain("agentic-token · agentpay");
  });

  it("can render a previous credential collapsed", () => {
    const html = renderToStaticMarkup(
      <CredentialRevealCard
        defaultOpen={false}
        credential={{
          id: "cred_previous",
          rail: "spt",
          provider: "stripe",
          amount: { value: "5.00", currency: "USD" },
          expires_at: "2026-07-31T17:10:00.000Z",
          credential: {
            format: "card",
            value: {
              number: "4242424242424242",
              expiration_month: "08",
              expiration_year: "2029",
              cvc: "664",
            },
          },
        }}
      />,
    );

    expect(html).toContain("<details");
    expect(html).not.toContain('open=""');
    expect(html).toContain("cred_previous");
  });

  it("keeps nested network-token cryptogram fields visible and copyable", () => {
    const html = renderToStaticMarkup(
      <CredentialRevealCard
        credential={{
          id: "cred_network_test",
          rail: "agentic-token",
          provider: "vic",
          amount: { value: "5.00", currency: "USD" },
          expires_at: "2026-07-31T17:10:00.000Z",
          credential: {
            format: "network-token",
            value: {
              payment_token: "4900000000000001",
              cryptogram: {
                type: "CARD_APPLICATION_CRYPTOGRAM_SHORT_FORM",
                value: "AAABBBCCC",
                expires_at: "2026-07-30T18:00:00.000Z",
              },
            },
          },
        }}
      />,
    );

    expect(html).toContain("cryptogram type");
    expect(html).toContain("CARD_APPLICATION_CRYPTOGRAM_SHORT_FORM");
    expect(html).toContain("AAABBBCCC");
    expect(html).toContain("<details");
    expect(html).toContain('open=""');
  });
});
