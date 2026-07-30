import { describe, expect, it } from "vitest";
import { createVerifier, SDK_INTEGRATION_SNIPPET } from "./sdkVerify";
import { AGENTIC_API_URL } from "./env";

describe("SDK integration", () => {
  it("createVerifier returns a working instance surface", () => {
    const av = createVerifier({ displayName: "Test Agent" });
    expect(typeof av.verifyAllowance).toBe("function");
    expect(typeof av.collectDeviceContext).toBe("function");
    expect(typeof av.dispose).toBe("function");
    av.dispose();
  });

  it("the displayed snippet matches the real integration surface", () => {
    // The snippet is shown as "the code a customer ships" — keep it honest:
    // same factory, same method, same base URL the button actually uses.
    expect(SDK_INTEGRATION_SNIPPET).toContain("AgenticVerification({");
    expect(SDK_INTEGRATION_SNIPPET).toContain("verifyAllowance(allowanceId)");
    expect(SDK_INTEGRATION_SNIPPET).toContain(AGENTIC_API_URL);
    expect(SDK_INTEGRATION_SNIPPET).toContain("@basis-theory/web-agentic");
  });
});
