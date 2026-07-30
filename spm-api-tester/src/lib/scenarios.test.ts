import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CARD_SCENARIOS,
  findScenario,
  NOT_SIMULATABLE,
  notSimulatableMarkdownList,
  scenarioMarkdownTable,
  scenariosAt,
} from "./scenarios";

describe("scenario catalog integrity", () => {
  it("contains the full verified 9-PAN matrix", () => {
    expect(CARD_SCENARIOS.map((s) => s.pan).sort()).toEqual(
      [
        "4242424242424242",
        "4929980395567582",
        "5555555555554444",
        "5186160000000001",
        "5186160000000003",
        "4000000000000002",
        "4000000000000119",
        "4000000000000341",
        "4000000000009995",
      ].sort(),
    );
  });

  it("has unique PANs", () => {
    const pans = CARD_SCENARIOS.map((s) => s.pan);
    expect(new Set(pans).size).toBe(pans.length);
  });

  it("every entry is complete", () => {
    for (const scenario of CARD_SCENARIOS) {
      expect(scenario.pan).toMatch(/^\d{16}$/);
      expect(["visa", "mastercard"]).toContain(scenario.brand);
      expect(scenario.badge.length).toBeGreaterThan(0);
      expect(scenario.description.length).toBeGreaterThan(10);
      expect(scenario.reminder.length).toBeGreaterThan(10);
      expect(["payment-method", "verify", "credentials"]).toContain(scenario.manifestsAt);
      expect(["success", "warning", "error"]).toContain(scenario.tone);
    }
  });

  it("brand matches the PAN's issuer prefix", () => {
    for (const scenario of CARD_SCENARIOS) {
      if (scenario.brand === "visa") expect(scenario.pan).toMatch(/^4/);
      if (scenario.brand === "mastercard") expect(scenario.pan).toMatch(/^5/);
    }
  });

  it("maps the error types verified against agentic-commerce mocks", () => {
    expect(findScenario("4929980395567582")?.expectedErrorCode).toBe("INVALID_OTP");
    expect(findScenario("5186160000000003")?.expectedErrorCode).toBe(
      "PROVIDER_VERIFICATION_FAILED",
    );
    expect(findScenario("5186160000000001")?.expectedErrorCode).toBe("CARD_REJECTED");
    expect(findScenario("4000000000000002")?.expectedErrorCode).toBe("CARD_REJECTED");
    expect(findScenario("4000000000000119")?.expectedErrorCode).toBe(
      "PROVIDER_ENROLLMENT_FAILED",
    );
    expect(findScenario("4000000000000341")?.expectedErrorCode).toBe(
      "PROVIDER_CREDENTIALS_FAILED",
    );
    // No reconcile flow exists in the API — unknown outcome burns the
    // reservation and 409s with CREDENTIAL_OUTCOME_UNKNOWN.
    expect(findScenario("4000000000009995")?.expectedErrorCode).toBe("CREDENTIAL_OUTCOME_UNKNOWN");
  });

  it("stages partition the catalog", () => {
    const total =
      scenariosAt("payment-method").length +
      scenariosAt("verify").length +
      scenariosAt("credentials").length;
    expect(total).toBe(CARD_SCENARIOS.length);
  });

  it("README's generated scenario blocks stay byte-for-byte in sync", () => {
    const readme = readFileSync(join(__dirname, "..", "..", "README.md"), "utf-8");
    const catalog = readme.match(
      /<!-- scenario-catalog:start -->\n([\s\S]*?)\n<!-- scenario-catalog:end -->/,
    )?.[1];
    const honesty = readme.match(
      /<!-- not-simulatable:start -->\n([\s\S]*?)\n<!-- not-simulatable:end -->/,
    )?.[1];
    expect(catalog).toBe(scenarioMarkdownTable());
    expect(honesty).toBe(notSimulatableMarkdownList());
  });

  it("keeps the honesty list non-empty and covering the known gaps", () => {
    const joined = NOT_SIMULATABLE.join(" ");
    expect(joined).toContain("MAX_ATTEMPTS_EXCEEDED");
    expect(joined).toContain("PASSKEY_FAILED");
    expect(joined).toContain("PENDING");
    expect(joined).toContain("NO_ACTIVE_RAILS");
  });
});
