import { describe, expect, it, vi } from "vitest";
import { handleVisaMessage, toAuthenticationContext } from "./visaCeremony";
import type { PasskeyContext } from "./types";

const ORIGIN = "https://sbx.vts.auth.visa.com";

function makeCtx(overrides: Partial<Parameters<typeof handleVisaMessage>[1]> = {}) {
  return {
    expectedOrigin: ORIGIN,
    iframeWindow: { tag: "iframe" },
    popupWindow: { tag: "popup" },
    onIframeReady: vi.fn(),
    onSessionCreated: vi.fn(),
    onPopupReady: vi.fn(),
    onAuthComplete: vi.fn(),
    onAuthFailed: vi.fn(),
    ...overrides,
  };
}

describe("handleVisaMessage — origin pinning", () => {
  it("drops messages from any other origin", () => {
    const ctx = makeCtx();
    handleVisaMessage(
      { origin: "https://evil.example", source: ctx.iframeWindow, data: { type: "AUTH_READY" } },
      ctx,
    );
    expect(ctx.onIframeReady).not.toHaveBeenCalled();
  });

  it("drops messages from unknown windows even on the right origin", () => {
    const ctx = makeCtx();
    handleVisaMessage({ origin: ORIGIN, source: { tag: "stranger" }, data: { type: "AUTH_READY" } }, ctx);
    expect(ctx.onIframeReady).not.toHaveBeenCalled();
    expect(ctx.onPopupReady).not.toHaveBeenCalled();
  });
});

describe("handleVisaMessage — session iframe protocol", () => {
  it("AUTH_READY from the iframe triggers session creation", () => {
    const ctx = makeCtx();
    handleVisaMessage(
      { origin: ORIGIN, source: ctx.iframeWindow, data: { type: "AUTH_READY", requestID: "r1" } },
      ctx,
    );
    expect(ctx.onIframeReady).toHaveBeenCalledWith("r1");
  });

  it("AUTH_SESSION_CREATED delivers the secure token", () => {
    const ctx = makeCtx();
    handleVisaMessage(
      {
        origin: ORIGIN,
        source: ctx.iframeWindow,
        data: {
          type: "AUTH_SESSION_CREATED",
          sessionContext: { secureToken: "tok_secure" },
          dfpSessionID: "iframe_dfp",
        },
      },
      ctx,
    );
    expect(ctx.onSessionCreated).toHaveBeenCalledWith("tok_secure", "iframe_dfp");
  });
});

describe("handleVisaMessage — popup ceremony protocol", () => {
  it("AUTH_COMPLETE remaps rpID → dfp_session_id and fidoBlob → fido_assertion_data.code", () => {
    const ctx = makeCtx();
    handleVisaMessage(
      {
        origin: ORIGIN,
        source: ctx.popupWindow,
        data: {
          type: "AUTH_COMPLETE",
          assuranceData: { identifier: "id_1", rpID: "dfp_from_popup", fidoBlob: "blob_1" },
        },
      },
      ctx,
    );
    expect(ctx.onAuthComplete).toHaveBeenCalledWith({
      identifier: "id_1",
      dfp_session_id: "dfp_from_popup",
      fido_assertion_data: { code: "blob_1" },
    });
  });

  it("terminal failure events reject with the event's message", () => {
    const ctx = makeCtx();
    handleVisaMessage(
      {
        origin: ORIGIN,
        source: ctx.popupWindow,
        data: { type: "AUTH_CANCELLED", error: { message: "user cancelled" } },
      },
      ctx,
    );
    expect(ctx.onAuthFailed).toHaveBeenCalledWith("user cancelled");
  });

  it.each(["AUTH_FAILED", "AUTH_NOT_PERFORMED", "AUTH_NOT_SUPPORTED"])(
    "%s without a message gets a readable fallback",
    (type) => {
      const ctx = makeCtx();
      handleVisaMessage({ origin: ORIGIN, source: ctx.popupWindow, data: { type } }, ctx);
      expect(ctx.onAuthFailed).toHaveBeenCalledWith(expect.stringContaining(type));
    },
  );

  it("popup AUTH_READY is routed to the popup handler, not the iframe one", () => {
    const ctx = makeCtx();
    handleVisaMessage(
      { origin: ORIGIN, source: ctx.popupWindow, data: { type: "AUTH_READY", requestID: "p1" } },
      ctx,
    );
    expect(ctx.onPopupReady).toHaveBeenCalledWith("p1");
    expect(ctx.onIframeReady).not.toHaveBeenCalled();
  });
});

describe("toAuthenticationContext", () => {
  it("forwards auth_preferences verbatim and keeps the payload opaque", () => {
    const passkeyContext: PasskeyContext = {
      endpoint: "https://visa.example/auth",
      identifier: "ident",
      payload: "OPAQUE_BYTES==",
      action: "AUTHENTICATE",
      platform_type: "WEB",
      auth_preferences: { response_mode: "web_message", response_type: "code" },
    };
    expect(toAuthenticationContext(passkeyContext)).toEqual({
      endpoint: "https://visa.example/auth",
      identifier: "ident",
      payload: "OPAQUE_BYTES==",
      action: "AUTHENTICATE",
      platformType: "WEB",
      authenticationPreferencesEnabled: { responseMode: "web_message", responseType: "code" },
    });
  });
});
