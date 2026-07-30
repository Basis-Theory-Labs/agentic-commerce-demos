// Mastercard hosted verification. The redirect URI opens TOP-LEVEL in a popup
// (Mastercard sends X-Frame-Options: DENY — iframing is impossible). When the
// cardholder finishes, a Basis Theory bridge page posts
// { type: 'mastercard_verification_complete' } to window.opener and closes.
//
// Two rules the old implementation skipped, fixed here:
//  1. The bridge posts with targetOrigin '*' — we validate BOTH
//     event.source === popup AND event.origin against the agentic API origin.
//  2. The browser message is a cue, not a result. Only `complete` is
//     authoritative — and real Mastercard can leave it pending
//     (verification_required with no next_action), so `complete` is polled,
//     bounded. The mock resolves immediately; the poll ships anyway.

import type { VerifyResponse } from "@/lib/types";

export const BRIDGE_MESSAGE_TYPE = "mastercard_verification_complete";

/**
 * Ceremony surfaces only ever open web URLs. The API is trusted, but
 * rejecting javascript:/data: schemes here is cheap insurance against a
 * compromised or misconfigured upstream.
 */
export function isSafeCeremonyUrl(uri: string): boolean {
  return /^https?:\/\//i.test(uri);
}

export const DEFAULT_POLL_ATTEMPTS = 10;
export const DEFAULT_POLL_DELAY_MS = 2000;

/**
 * Origin allowlist for the bridge message: the agentic API origin plus the
 * known Basis Theory API hosts.
 */
export function bridgeOrigins(agenticApiUrl: string): string[] {
  const origins = new Set<string>([
    "https://api.basistheory.com",
    "https://api.test.basistheory.com",
  ]);
  try {
    origins.add(new URL(agenticApiUrl, "http://localhost").origin);
  } catch {
    // Relative /api proxy path etc. — the two defaults remain.
  }
  return [...origins];
}

/**
 * Pure bridge-message predicate — unit-testable with fake events. Accepts
 * only a message from the popup window itself, from an allowed origin, with
 * the expected type.
 */
export function isBridgeMessage(
  event: { origin: string; source: unknown; data: unknown },
  popup: unknown,
  allowedOrigins: string[],
): boolean {
  if (!popup || event.source !== popup) return false;
  if (!allowedOrigins.includes(event.origin)) return false;
  const data = event.data as { type?: string } | null;
  return data?.type === BRIDGE_MESSAGE_TYPE;
}

/**
 * Poll `complete` while the rail stays pending. `sendComplete` performs one
 * POST verify {action:'complete'}; a response of `verification_required`
 * with no `next_action` means Mastercard hasn't finalized yet — wait and
 * retry, bounded.
 */
export async function pollComplete(
  sendComplete: () => Promise<VerifyResponse>,
  options: { attempts?: number; delayMs?: number; onPending?: (attempt: number) => void } = {},
): Promise<VerifyResponse> {
  const attempts = options.attempts ?? DEFAULT_POLL_ATTEMPTS;
  const delayMs = options.delayMs ?? DEFAULT_POLL_DELAY_MS;

  let last: VerifyResponse | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    last = await sendComplete();
    if (last.status === "active" || last.next_action) return last;
    // Still pending: verification_required with nothing to do.
    options.onPending?.(attempt);
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(
    `Mastercard verification is still pending after ${attempts} completion checks. ` +
      "Wait a moment and retry `complete`, or restart verification.",
  );
}

export interface MastercardCeremonyHandle {
  /** Resolves when the bridge message arrives or the popup closes. */
  settled: Promise<"message" | "closed">;
  cancel: () => void;
}

/**
 * Open the Mastercard hosted ceremony and watch for the bridge callback.
 * MUST be invoked synchronously from a click handler (popup activation).
 *
 * Resolves "message" when the origin-validated bridge cue arrives, or
 * "closed" when the popup closes without one — in BOTH cases the caller
 * should proceed to `complete` (via {@link pollComplete}), because the
 * message is only a cue and `complete` is idempotent and authoritative.
 */
export function openMastercardCeremony(
  uri: string,
  allowedOrigins: string[],
): MastercardCeremonyHandle | null {
  if (!isSafeCeremonyUrl(uri)) return null;
  const popup = window.open(uri, "mc-auth", "width=480,height=720");
  if (!popup) return null;

  let cleanup = () => {};
  const settled = new Promise<"message" | "closed">((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (isBridgeMessage(event, popup, allowedOrigins)) {
        cleanup();
        if (!popup.closed) popup.close();
        resolve("message");
      }
    };
    const watcher = setInterval(() => {
      if (popup.closed) {
        cleanup();
        resolve("closed");
      }
    }, 500);
    cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(watcher);
    };
    window.addEventListener("message", onMessage);
  });

  return {
    settled,
    cancel: () => {
      cleanup();
      if (!popup.closed) popup.close();
    },
  };
}
