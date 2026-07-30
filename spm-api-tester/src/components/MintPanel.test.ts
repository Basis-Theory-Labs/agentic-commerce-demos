import { describe, expect, it } from "vitest";
import type { Allowance } from "@/lib/types";
import { errorDemosFor, mintsFor } from "./MintPanel";

const expires = "2030-01-01T00:00:00.000Z";

function allowance(provider: "vic" | "agentpay" = "vic"): Allowance {
  return {
    id: "alw_test",
    amount: { value: "50.00", currency: "USD" },
    amount_available: { value: "50.00", currency: "USD" },
    rails: [
      {
        rail: "agentic-token",
        provider,
        status: "active",
        credential_formats: ["card", "network-token", "mpp"],
      },
      {
        rail: "spt",
        provider: "stripe",
        status: "active",
        credential_formats: ["identifier", "mpp"],
      },
    ],
  };
}

describe("credential mint presets", () => {
  it.each(["vic", "agentpay"] as const)(
    "offers every format advertised for %s and includes valid MPP billing fields",
    (provider) => {
      const definitions = mintsFor(allowance(provider), expires);
      expect(definitions.map((definition) => definition.key)).toEqual([
        "agentic-card",
        "agentic-network-token",
        "agentic-mpp",
        "spt-identifier",
        "spt-mpp",
      ]);
      const agenticMpp = definitions.find((definition) => definition.key === "agentic-mpp");
      expect(agenticMpp?.body).toMatchObject({
        rail: "agentic-token",
        provider,
        credential: {
          format: "mpp",
          payload: {
            billing_address: { country_code: "US" },
            cardholder_full_name: "Example Shopper",
          },
        },
      });
    },
  );

  it("gates panels from the rail's advertised credential_formats", () => {
    const resource = allowance();
    resource.rails![0].credential_formats = ["network-token"];
    resource.rails![1].credential_formats = ["identifier"];
    expect(mintsFor(resource, expires).map((definition) => definition.key)).toEqual([
      "agentic-network-token",
      "spt-identifier",
    ]);
    expect(errorDemosFor(resource, expires).some((definition) => definition.key.includes("mpp"))).toBe(
      false,
    );
  });
});
