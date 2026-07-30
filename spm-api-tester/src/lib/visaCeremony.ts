// Visa hosted browser authentication — typed port of the battle-tested
// public/tester/visa-auth.js protocol.
//
// Visa's hidden iframe initializes the auth session. The visible REGISTER or
// AUTHENTICATE ceremony runs in a popup the USER opens (window.open must be
// called synchronously inside a click handler — after any `await`, user
// activation is lost, the popup is blocked, and WebAuthn will not run).
// Both surfaces are Visa's hosted page speaking postMessage:
//
//   iframe loads          → AUTH_READY
//   CREATE_AUTH_SESSION   → AUTH_SESSION_CREATED (session + secure token)
//   user-opened popup     → AUTH_READY
//   AUTHENTICATE(context) → AUTH_COMPLETE (assurance data) | terminal error
//
// The embed block (iframe URL, publishable Visa API key, client app id) is
// served by the API on each passkey next_action so the values can rotate.
// Nothing is hard-coded here; the optional sandbox override comes from env.

import type { PasskeyContext, VisaEmbed } from "@/lib/types";

export interface AssuranceData {
  identifier: string;
  /** From the POPUP result's `rpID` — not the session iframe's dfpSessionID. */
  dfp_session_id: string;
  fido_assertion_data: { code: string };
}

const READY_TIMEOUT_MS = 15_000;
const POPUP_CHECK_MS = 500;

const HIDDEN_STYLE =
  "position:absolute;top:-9999px;left:-9999px;width:1px;height:1px;border:0;visibility:hidden;";

interface VisaMessage {
  type?: string;
  requestID?: string;
  sessionContext?: { secureToken?: string };
  dfpSessionID?: string;
  assuranceData?: { identifier?: string; rpID?: string; fidoBlob?: string };
  error?: { message?: string };
}

const TERMINAL_FAILURES = [
  "AUTH_CANCELLED",
  "AUTH_FAILED",
  "AUTH_NOT_PERFORMED",
  "AUTH_NOT_SUPPORTED",
];

/**
 * Pure message dispatcher — extracted from the ceremony class so the
 * protocol handling is unit-testable with fake events.
 */
export function handleVisaMessage(
  event: { origin: string; source: unknown; data: unknown },
  ctx: {
    expectedOrigin: string;
    iframeWindow: unknown;
    popupWindow: unknown;
    onIframeReady: (requestID: string) => void;
    onSessionCreated: (secureToken: string | undefined, dfpSessionID: string | undefined) => void;
    onPopupReady: (requestID: string) => void;
    onAuthComplete: (assurance: AssuranceData) => void;
    onAuthFailed: (message: string) => void;
  },
): void {
  if (event.origin !== ctx.expectedOrigin) return;
  const data = (event.data || {}) as VisaMessage;

  if (ctx.popupWindow && event.source === ctx.popupWindow) {
    if (data.type === "AUTH_READY") {
      ctx.onPopupReady(data.requestID ?? "");
    } else if (data.type === "AUTH_COMPLETE") {
      const a = data.assuranceData || {};
      ctx.onAuthComplete({
        identifier: a.identifier ?? "",
        dfp_session_id: a.rpID ?? "",
        fido_assertion_data: { code: a.fidoBlob ?? "" },
      });
    } else if (data.type && TERMINAL_FAILURES.includes(data.type)) {
      ctx.onAuthFailed(data.error?.message || `Visa passkey ceremony ended with ${data.type}.`);
    }
    return;
  }

  if (event.source !== ctx.iframeWindow || !ctx.iframeWindow) return;
  if (data.type === "AUTH_READY") {
    ctx.onIframeReady(data.requestID ?? "");
  } else if (data.type === "AUTH_SESSION_CREATED") {
    ctx.onSessionCreated(data.sessionContext?.secureToken, data.dfpSessionID);
  }
}

/** Maps a passkey_context into Visa's popup AUTHENTICATE payload. */
export function toAuthenticationContext(passkeyContext: PasskeyContext) {
  return {
    endpoint: passkeyContext.endpoint,
    identifier: passkeyContext.identifier,
    payload: passkeyContext.payload,
    action: passkeyContext.action,
    platformType: passkeyContext.platform_type,
    // Forward the backend-requested preferences verbatim — overriding them
    // makes Visa reject the ceremony.
    authenticationPreferencesEnabled: {
      responseMode: passkeyContext.auth_preferences?.response_mode,
      responseType: passkeyContext.auth_preferences?.response_type,
    },
  };
}

export class VisaCeremony {
  private iframe: HTMLIFrameElement | null = null;
  private popup: Window | null = null;
  private config: VisaEmbed | null = null;
  private expectedOrigin = "";
  private secureTokenValue: string | null = null;
  private isReady = false;
  private clientName: string;

  private readyResolvers: { resolve: () => void; reject: (e: Error) => void } | null = null;
  private readyTimer: ReturnType<typeof setTimeout> | null = null;
  private authResolvers: {
    resolve: (a: AssuranceData) => void;
    reject: (e: Error) => void;
  } | null = null;
  private pendingAuthContext: ReturnType<typeof toAuthenticationContext> | null = null;
  private popupCheck: ReturnType<typeof setInterval> | null = null;
  private boundOnMessage: ((event: MessageEvent) => void) | null = null;

  constructor(clientName: string) {
    this.clientName = clientName;
  }

  get ready(): boolean {
    return this.isReady;
  }

  get secureToken(): string | null {
    return this.secureTokenValue;
  }

  /**
   * Mount the hidden session iframe and create an auth session. Resolves once
   * AUTH_SESSION_CREATED delivers the secure token; rejects after 15s if the
   * iframe never says AUTH_READY (most common cause: the page origin is not
   * registered with Visa).
   */
  init(embed: VisaEmbed): Promise<void> {
    if (!/^https?:\/\//i.test(embed.iframe_url)) {
      return Promise.reject(new Error("The Visa iframe URL must be an http(s) URL."));
    }
    this.config = embed;
    this.secureTokenValue = null;
    this.isReady = false;
    this.iframe?.remove();
    // A stale ready timer from a previous init must not null out the new
    // attempt's resolvers.
    if (this.readyTimer) clearTimeout(this.readyTimer);

    if (!this.boundOnMessage) {
      this.boundOnMessage = (event) => this.onMessage(event);
      window.addEventListener("message", this.boundOnMessage);
    }

    const params = new URLSearchParams({
      apiKey: embed.api_key,
      clientAppId: embed.client_app_id,
      topOrigin: window.location.origin,
      integrator_origin: window.location.origin,
    });
    const iframe = document.createElement("iframe");
    iframe.src = `${embed.iframe_url}?${params}`;
    iframe.allow = "publickey-credentials-get; publickey-credentials-create";
    iframe.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox",
    );
    iframe.style.cssText = HIDDEN_STYLE;
    this.expectedOrigin = new URL(iframe.src, window.location.href).origin;
    document.body.appendChild(iframe);
    this.iframe = iframe;

    return new Promise<void>((resolve, reject) => {
      this.readyResolvers = { resolve, reject };
      this.readyTimer = setTimeout(() => {
        this.readyResolvers = null;
        reject(
          new Error(
            "Visa auth session timed out after 15s — the iframe never reported ready. " +
              "If this is a real Visa environment, the most likely cause is that this " +
              "origin is not registered with Visa.",
          ),
        );
      }, READY_TIMEOUT_MS);
    });
  }

  /**
   * Run one REGISTER/AUTHENTICATE ceremony. MUST be invoked synchronously
   * from a click handler: window.open happens before any await so browser
   * popup + WebAuthn activation requirements hold.
   */
  authenticate(passkeyContext: PasskeyContext): Promise<AssuranceData> {
    if (!this.isReady || !this.iframe || !this.config) {
      return Promise.reject(new Error("Visa auth session not ready — initialize it first."));
    }
    const width = 560;
    const height = 600;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    this.popup = window.open(
      this.iframe.src,
      "VPP_POPUP",
      `width=${width},height=${height},left=${left},top=${top},` +
        "toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes",
    );
    if (!this.popup) {
      return Promise.reject(
        new Error("Visa passkey popup was blocked. Allow popups for this site and try again."),
      );
    }

    this.pendingAuthContext = toAuthenticationContext(passkeyContext);

    return new Promise<AssuranceData>((resolve, reject) => {
      this.authResolvers = { resolve, reject };
      this.popupCheck = setInterval(() => {
        if (this.popup?.closed) {
          this.finishAuth(new Error("Visa passkey popup was closed before completion."));
        }
      }, POPUP_CHECK_MS);
    });
  }

  dispose(): void {
    if (this.boundOnMessage) {
      window.removeEventListener("message", this.boundOnMessage);
      this.boundOnMessage = null;
    }
    if (this.readyTimer) clearTimeout(this.readyTimer);
    if (this.popupCheck) clearInterval(this.popupCheck);
    if (this.popup && !this.popup.closed) this.popup.close();
    this.iframe?.remove();
    this.iframe = null;
    this.popup = null;
    this.isReady = false;
  }

  private onMessage(event: MessageEvent): void {
    handleVisaMessage(event, {
      expectedOrigin: this.expectedOrigin,
      iframeWindow: this.iframe?.contentWindow ?? null,
      popupWindow: this.popup,
      onIframeReady: (requestID) => {
        this.iframe?.contentWindow?.postMessage(
          {
            requestID,
            type: "CREATE_AUTH_SESSION",
            version: "1",
            contentType: "application/json",
            client: { id: this.config?.client_app_id, name: this.clientName },
          },
          this.expectedOrigin,
        );
      },
      onSessionCreated: (secureToken) => {
        this.secureTokenValue = secureToken ?? null;
        this.isReady = true;
        if (this.readyTimer) clearTimeout(this.readyTimer);
        this.readyResolvers?.resolve();
        this.readyResolvers = null;
      },
      onPopupReady: (requestID) => {
        this.popup?.postMessage(
          {
            requestID,
            type: "AUTHENTICATE",
            version: "1",
            authenticationContext: this.pendingAuthContext,
          },
          this.expectedOrigin,
        );
      },
      onAuthComplete: (assurance) => this.finishAuth(null, assurance),
      onAuthFailed: (message) => this.finishAuth(new Error(message)),
    });
  }

  private finishAuth(error: Error | null, assurance?: AssuranceData): void {
    if (!this.authResolvers) return;
    if (this.popupCheck) clearInterval(this.popupCheck);
    this.popupCheck = null;
    if (this.popup && !this.popup.closed) this.popup.close();
    this.popup = null;
    this.pendingAuthContext = null;

    const resolvers = this.authResolvers;
    this.authResolvers = null;
    if (error) resolvers.reject(error);
    else resolvers.resolve(assurance as AssuranceData);
  }
}
