import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildVisaAuthUrl,
  handleVisaMessage,
  toAuthenticationContext,
  VisaCeremony,
} from "./visaCeremony";
import type { PasskeyContext, VisaEmbed } from "./types";

const ORIGIN = "https://sbx.vts.auth.visa.com";
const EMBED: VisaEmbed = {
  iframe_url: `${ORIGIN}/auth`,
  api_key: "visa_publishable",
  client_app_id: "client_app",
};

afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll("iframe").forEach((iframe) => iframe.remove());
});

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

describe("VisaCeremony runtime protocol", () => {
  function dispatch(source: MessageEventSource, data: unknown) {
    window.dispatchEvent(new MessageEvent("message", { origin: ORIGIN, source, data }));
  }

  async function initialize(ceremony: VisaCeremony) {
    const initialized = ceremony.init(EMBED);
    const iframe = document.querySelector("iframe");
    if (!iframe?.contentWindow) throw new Error("test iframe was not mounted");
    dispatch(iframe.contentWindow, {
      type: "AUTH_SESSION_CREATED",
      sessionContext: { secureToken: "secure_123" },
    });
    await initialized;
    return iframe;
  }

  it("constructs the exact iframe URL and query contract", () => {
    const url = new URL(buildVisaAuthUrl(EMBED, "https://merchant.example"));
    expect(url.origin + url.pathname).toBe(`${ORIGIN}/auth`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      apiKey: "visa_publishable",
      clientAppId: "client_app",
      topOrigin: "https://merchant.example",
      integrator_origin: "https://merchant.example",
    });
  });

  it("posts CREATE_AUTH_SESSION with the configured client", async () => {
    const ceremony = new VisaCeremony("Test Agent");
    const initialized = ceremony.init(EMBED);
    const iframe = document.querySelector("iframe");
    if (!iframe?.contentWindow) throw new Error("test iframe was not mounted");
    const postMessage = vi.spyOn(iframe.contentWindow, "postMessage");

    dispatch(iframe.contentWindow, { type: "AUTH_READY", requestID: "req_1" });
    expect(postMessage).toHaveBeenCalledWith(
      {
        requestID: "req_1",
        type: "CREATE_AUTH_SESSION",
        version: "1",
        contentType: "application/json",
        client: { id: "client_app", name: "Test Agent" },
      },
      ORIGIN,
    );
    dispatch(iframe.contentWindow, {
      type: "AUTH_SESSION_CREATED",
      sessionContext: { secureToken: "secure_123" },
    });
    await initialized;
    expect(ceremony.secureToken).toBe("secure_123");
    ceremony.dispose();
  });

  it("rejects a session response that omits the secure token", async () => {
    const ceremony = new VisaCeremony("Test Agent");
    const initialized = ceremony.init(EMBED);
    const iframe = document.querySelector("iframe");
    if (!iframe?.contentWindow) throw new Error("test iframe was not mounted");
    dispatch(iframe.contentWindow, { type: "AUTH_SESSION_CREATED", sessionContext: {} });
    await expect(initialized).rejects.toThrow(/without a secure token/i);
    expect(ceremony.ready).toBe(false);
    ceremony.dispose();
  });

  it("opens synchronously, posts AUTHENTICATE, and returns mapped assurance data", async () => {
    const ceremony = new VisaCeremony("Test Agent");
    await initialize(ceremony);
    const popup = {
      closed: false,
      postMessage: vi.fn(),
      close: vi.fn(() => {
        popup.closed = true;
      }),
    };
    const open = vi.spyOn(window, "open").mockReturnValue(popup as unknown as Window);
    const context: PasskeyContext = {
      endpoint: "https://visa.example/authenticate",
      identifier: "identifier_1",
      payload: "opaque",
      action: "AUTHENTICATE",
      platform_type: "WEB",
    };

    const authenticated = ceremony.authenticate(context);
    expect(open).toHaveBeenCalledTimes(1);
    dispatch(popup as unknown as Window, { type: "AUTH_READY", requestID: "popup_req" });
    expect(popup.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "AUTHENTICATE",
        requestID: "popup_req",
        authenticationContext: expect.objectContaining({ identifier: "identifier_1" }),
      }),
      ORIGIN,
    );
    dispatch(popup as unknown as Window, {
      type: "AUTH_COMPLETE",
      assuranceData: { identifier: "id_1", rpID: "rp_1", fidoBlob: "blob_1" },
    });
    await expect(authenticated).resolves.toEqual({
      identifier: "id_1",
      dfp_session_id: "rp_1",
      fido_assertion_data: { code: "blob_1" },
    });
    ceremony.dispose();
  });

  it("reports a synchronously blocked popup", async () => {
    const ceremony = new VisaCeremony("Test Agent");
    await initialize(ceremony);
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const result = ceremony.authenticate({
      endpoint: "https://visa.example/authenticate",
      identifier: "identifier_1",
      payload: "opaque",
      action: "AUTHENTICATE",
    });
    expect(open).toHaveBeenCalledTimes(1);
    await expect(result).rejects.toThrow(/popup was blocked/i);
    ceremony.dispose();
  });
});
