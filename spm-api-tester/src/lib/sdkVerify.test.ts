import { describe, expect, it } from "vitest";
import { ApiError as WebAgenticApiError } from "@basis-theory/web-agentic";
import {
  createVerifier,
  normalizeSdkError,
  SDK_INTEGRATION_SNIPPET,
  serializeSdkEvent,
} from "./sdkVerify";
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
    expect(SDK_INTEGRATION_SNIPPET).toContain("verifyAllowance(allowanceId, { provider })");
    expect(SDK_INTEGRATION_SNIPPET).not.toContain("allowance:verify + :get");
    expect(SDK_INTEGRATION_SNIPPET).toContain(AGENTIC_API_URL);
    expect(SDK_INTEGRATION_SNIPPET).toContain("@basis-theory/web-agentic");
  });

  it("preserves typed SDK API diagnostics for the inspector and toast", () => {
    const error = new WebAgenticApiError("provider failed", {
      status: 422,
      problem: {
        type: "PROVIDER_VERIFICATION_FAILED",
        title: "Verification failed",
        detail: "The provider rejected the result.",
        debug: { provider_correlation: "corr_123" },
      },
      traceId: "trace_123",
    });
    const normalized = normalizeSdkError(error);
    expect(normalized).toMatchObject({
      name: "ApiError",
      status: 422,
      traceId: "trace_123",
      problem: {
        type: "PROVIDER_VERIFICATION_FAILED",
        debug: { provider_correlation: "corr_123" },
      },
    });
    expect(serializeSdkEvent({ type: "error", error })).toEqual({
      type: "error",
      error: normalized,
    });
  });
});
