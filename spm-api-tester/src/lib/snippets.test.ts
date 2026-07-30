import { describe, expect, it } from "vitest";
import { SNIPPET_LOOP, SNIPPET_PASSKEY, SNIPPET_REDIRECT } from "./snippets";

describe("manual ceremony teaching snippets", () => {
  it("uses the mapped assurance data returned by the tester's Visa helper", () => {
    expect(SNIPPET_PASSKEY).toContain("assurance_data: assuranceData");
    expect(SNIPPET_PASSKEY).not.toContain("a.rpID");
    expect(SNIPPET_PASSKEY).not.toContain("a.fidoBlob");
    expect(SNIPPET_PASSKEY).toContain("function runVisaFromClick(nextAction, advance)");
    expect(SNIPPET_PASSKEY).toContain("const ceremony = visaSession.authenticate");
    expect(SNIPPET_PASSKEY).toContain(".catch(renderCeremonyError)");
  });

  it("teaches both Mastercard message checks and callback-loss handling", () => {
    expect(SNIPPET_REDIRECT).toContain("event.source !== popup");
    expect(SNIPPET_REDIRECT).toContain("API_ORIGINS.has(event.origin)");
    expect(SNIPPET_REDIRECT).toContain("new URL(AGENTIC_API_URL).origin");
    expect(SNIPPET_REDIRECT).toContain("if (!popup)");
    expect(SNIPPET_REDIRECT).toContain("popup.closed");
    expect(SNIPPET_REDIRECT).toContain("attempt < 10");
    expect(SNIPPET_REDIRECT).toContain(
      "function runMastercardFromClick(nextAction, advance)",
    );
    expect(SNIPPET_REDIRECT).toContain("window.removeEventListener('message', onMessage)");
    expect(SNIPPET_REDIRECT.indexOf("renderCompleteButton")).toBeLessThan(
      SNIPPET_REDIRECT.indexOf("async function completeWithPolling"),
    );
  });

  it("returns popup actions to explicit click renderers instead of awaiting them in the loop", () => {
    expect(SNIPPET_LOOP).toContain("return renderVisaButton");
    expect(SNIPPET_LOOP).toContain("return renderMastercardButton");
    expect(SNIPPET_PASSKEY).toContain("function runVisaFromClick");
    expect(SNIPPET_REDIRECT).toContain("function runMastercardFromClick");
    expect(SNIPPET_LOOP).not.toContain("await runVisa");
    expect(SNIPPET_LOOP).not.toContain("await runMastercard");
  });
});
