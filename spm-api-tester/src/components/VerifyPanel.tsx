"use client";

// Allowance verification, both variants:
//
//   Manual — every verify action is an editable JSON request panel, including
//            the submit_session / submit_passkey / complete bodies pre-filled
//            from real ceremony results. The Visa iframe/popup protocol and
//            the Mastercard popup + origin-checked bridge + bounded complete
//            poll run exactly as a production integration would.
//   SDK    — the same allowance verified with one
//            @basis-theory/agentic-verification call.
//
// Verify calls are serialized per allowance (concurrent actions 409 with
// ALLOWANCE_VERIFICATION_IN_PROGRESS — they don't queue).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KNOWN_NEXT_ACTION_TYPES,
  type Allowance,
  type PasskeyContext,
  type VerifyResponse,
  type VisaEmbed,
} from "@/lib/types";
import { callAgentic } from "@/lib/agenticClient";
import { useApiLog } from "@/lib/apiLog";
import { useToast } from "@/lib/toast";
import { useSession, type AllowanceEntry } from "@/lib/session";
import { useAppConfig } from "@/lib/config";
import { useFlowVariant, VariantToggle } from "@/lib/variant";
import { collectDeviceContext } from "@/lib/deviceContext";
import { VisaCeremony, type AssuranceData } from "@/lib/visaCeremony";
import {
  bridgeOrigins,
  openMastercardCeremony,
  pollComplete,
  type MastercardCeremonyHandle,
} from "@/lib/mastercardCeremony";
import { createVerifier, SDK_INTEGRATION_SNIPPET } from "@/lib/sdkVerify";
import { SNIPPET_LOOP, SNIPPET_PASSKEY, SNIPPET_REDIRECT } from "@/lib/snippets";
import { AGENTIC_API_URL, VISA_ENVIRONMENT, VISA_SANDBOX_EMBED } from "@/lib/env";
import { NOT_SIMULATABLE } from "@/lib/scenarios";
import { RequestPanel } from "@/components/RequestPanel";
import { ScenarioChip } from "@/components/ScenarioChip";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { OtpInput } from "@/components/ui/OtpInput";
import { RailChips } from "@/components/ui/StatusPill";

export function VerifyPanel({
  entry,
  scenarioPan,
  onActive,
}: {
  entry: AllowanceEntry;
  scenarioPan?: string;
  onActive?: () => void;
}) {
  const { variant } = useFlowVariant();
  const allowance = entry.resource;
  const rail = allowance.rails?.find((r) => r.rail === "agentic-token");

  if (!rail) {
    return (
      <Callout tone="warning">
        This allowance has no agentic-token rail, so there is nothing to verify — spt credentials
        can be minted right away.
      </Callout>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <RailChips rails={allowance.rails} />
        <VariantToggle />
      </div>
      <ScenarioChip scenarioPan={scenarioPan} stage="verify" />
      {variant === "manual" ? (
        <ManualVerify key={allowance.id} allowance={allowance} onActive={onActive} />
      ) : (
        <SdkVerify key={allowance.id} allowance={allowance} onActive={onActive} />
      )}
      <details className="border border-ink-200 bg-white px-3 py-2 text-xs text-ink-600">
        <summary className="cursor-pointer font-medium text-ink-900">
          Not simulatable with test cards
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {NOT_SIMULATABLE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}

/* ── manual variant ───────────────────────────────────────────────────── */

function ManualVerify({ allowance, onActive }: { allowance: Allowance; onActive?: () => void }) {
  const { config } = useAppConfig();
  const { dispatch } = useSession();
  const logger = useApiLog();
  const toast = useToast();

  const rail = allowance.rails?.find((r) => r.rail === "agentic-token");
  const provider = rail?.provider ?? "vic";
  const isTest = config?.tenantType === "test";
  const displayName = config?.displayName || "Example Agent";

  const [verifyState, setVerifyState] = useState<VerifyResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [secureToken, setSecureToken] = useState<string | null>(null);
  const [assurance, setAssurance] = useState<AssuranceData | null>(null);
  const [registerDone, setRegisterDone] = useState(false);
  const [mcCue, setMcCue] = useState<"message" | "closed" | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [ceremonyError, setCeremonyError] = useState<string | null>(null);
  const [pollNote, setPollNote] = useState<string | null>(null);
  // Mirrors ceremonyRef.current?.ready — refs must not be read during render.
  const [visaReady, setVisaReady] = useState(false);

  const ceremonyRef = useRef<VisaCeremony | null>(null);
  const mcHandleRef = useRef<MastercardCeremonyHandle | null>(null);

  useEffect(() => {
    return () => {
      ceremonyRef.current?.dispose();
      mcHandleRef.current?.cancel();
    };
  }, []);

  const base = useMemo(() => ({ rail: "agentic-token", provider }), [provider]);
  const verifyPath = `/allowances/${allowance.id}/verify`;

  const active = verifyState?.status === "active" || rail?.status === "active";

  const refreshAllowance = useCallback(async () => {
    try {
      const fresh = await callAgentic<Allowance>(
        { method: "GET", path: `/allowances/${allowance.id}`, auth: "public" },
        logger,
      );
      dispatch({ type: "upsertAllowance", entry: { resource: fresh } });
    } catch {
      // Refresh is best-effort; the verify response already told us the state.
    }
  }, [allowance.id, dispatch, logger]);

  const applyResult = useCallback(
    async (result: VerifyResponse) => {
      setVerifyState(result);
      setOtpError(null);
      setCeremonyError(null);
      // Step-scoped artifacts don't survive a state transition.
      setSecureToken(null);
      setAssurance(null);
      setMcCue(null);
      setOtpCode("");
      setMethodId(null);
      if (result.status === "active") {
        toast.success("Rail active — verification complete");
        await refreshAllowance();
        onActive?.();
      }
    },
    [refreshAllowance, toast, onActive],
  );

  /** Direct (button-driven) verify send, serialized with everything else. */
  const sendVerify = useCallback(
    async (body: Record<string, unknown>, { silent = false } = {}) => {
      if (busy) return null;
      setBusy(true);
      try {
        const result = await callAgentic<VerifyResponse>(
          { method: "POST", path: verifyPath, body: { ...base, ...body }, auth: "public", tag: String(body.action ?? "start") },
          logger,
        );
        await applyResult(result);
        return result;
      } catch (error) {
        if (!silent) toast.error(error);
        throw error;
      } finally {
        setBusy(false);
      }
    },
    [busy, base, verifyPath, logger, applyResult, toast],
  );

  /** `complete` result handling with the bounded pending poll. */
  const handleCompleteResult = useCallback(
    async (result: VerifyResponse) => {
      if (result.status === "verification_required" && !result.next_action) {
        setPollNote(
          "Still pending — polling complete every 2s (up to 10 tries). The mock never returns pending, but real Mastercard does.",
        );
        try {
          const final = await pollComplete(
            () =>
              callAgentic<VerifyResponse>(
                { method: "POST", path: verifyPath, body: { ...base, action: "complete" }, auth: "public", tag: "complete" },
                logger,
              ),
            { onPending: (attempt) => setPollNote(`Still pending after attempt ${attempt} — retrying…`) },
          );
          await applyResult(final);
        } catch (error) {
          toast.error(error);
        } finally {
          setPollNote(null);
        }
      } else {
        await applyResult(result);
      }
    },
    [base, verifyPath, logger, applyResult, toast],
  );

  const visaEmbedFor = (embed: VisaEmbed): VisaEmbed => {
    if (
      VISA_ENVIRONMENT === "sandbox" &&
      !isTest &&
      VISA_SANDBOX_EMBED.iframe_url &&
      VISA_SANDBOX_EMBED.api_key &&
      VISA_SANDBOX_EMBED.client_app_id
    ) {
      return VISA_SANDBOX_EMBED;
    }
    return embed;
  };

  const initVisaSession = async (embed: VisaEmbed) => {
    setCeremonyError(null);
    setBusy(true);
    setVisaReady(false);
    try {
      ceremonyRef.current?.dispose();
      const ceremony = new VisaCeremony(displayName);
      ceremonyRef.current = ceremony;
      await ceremony.init(visaEmbedFor(embed));
      setSecureToken(ceremony.secureToken);
      setVisaReady(true);
    } catch (error) {
      setCeremonyError(error instanceof Error ? error.message : "Visa session failed");
    } finally {
      setBusy(false);
    }
  };

  /** MUST stay synchronous up to ceremony.authenticate() — popup activation. */
  const runVisaCeremony = (passkeyContext: PasskeyContext) => {
    const ceremony = ceremonyRef.current;
    if (!ceremony?.ready) {
      setCeremonyError("The Visa session is not initialized — reinitialize it below.");
      return;
    }
    setCeremonyError(null);
    const promise = ceremony.authenticate(passkeyContext);
    setBusy(true);
    promise
      .then((result) => {
        if (passkeyContext.action === "REGISTER") {
          setRegisterDone(true);
        } else {
          setAssurance(result);
        }
      })
      .catch((error) => {
        setCeremonyError(error instanceof Error ? error.message : "Ceremony failed");
      })
      .finally(() => setBusy(false));
  };

  /** MUST stay synchronous up to window.open — popup activation. */
  const openMastercard = (uri: string) => {
    setCeremonyError(null);
    const handle = openMastercardCeremony(uri, bridgeOrigins(AGENTIC_API_URL));
    if (!handle) {
      setCeremonyError("The browser blocked the Mastercard popup. Allow popups and try again.");
      return;
    }
    mcHandleRef.current = handle;
    handle.settled.then((outcome) => {
      mcHandleRef.current = null;
      setMcCue(outcome);
    });
  };

  const nextAction = verifyState?.next_action;

  if (active) {
    return (
      <div className="space-y-3">
        <Callout tone="success" title="Rail active">
          The network confirmed the ceremony server-to-server. Credentials can now be minted on
          this rail. Verifying an already-active rail is harmless — <code>start</code> just
          returns <code>{`{ status: 'active' }`}</code>.
        </Callout>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!verifyState && (
        <>
          <p className="text-xs text-ink-600">
            Card networks require cardholder verification before an agentic-token rail releases
            credentials. You drive the browser ceremony; Basis Theory validates every step with
            the network server-to-server — nothing the browser sends can activate the rail by
            itself.
          </p>
          <StartRequestPanel
            verifyPath={verifyPath}
            base={base}
            displayName={displayName}
            sendLabel="Start Verification"
            disabled={busy}
            onSendStateChange={setBusy}
            onSuccess={(result) => applyResult(result)}
          />
          <CodeBlock title="The verification loop" code={SNIPPET_LOOP} />
        </>
      )}

      {verifyState && nextAction && (
        <div className="border border-ink-200 bg-white p-3">
          <h3 className="mb-2 font-mono text-xs font-semibold text-ink-950">
            next_action: {String(nextAction.type)}
          </h3>

          {nextAction.type === "passkey_session" && (
            <div className="space-y-2.5">
              <Callout title="Initialize Visa verification">
                Mount Visa’s hosted iframe (hidden) and create an authentication session. The
                iframe returns a secure token; <code>submit_session</code> hands it to Basis
                Theory, which asks Visa what the cardholder must do next. The iframe URL and
                publishable identifiers come from <code>next_action.embed</code> — served by the
                API so nothing is hard-coded.
              </Callout>
              {!secureToken ? (
                <Button
                  onClick={() => initVisaSession(nextAction.embed as VisaEmbed)}
                  loading={busy}
                  loadingLabel="Initializing iframe…"
                >
                  Initialize Visa Session
                </Button>
              ) : (
                <RequestPanel
                  method="POST"
                  path={verifyPath}
                  auth="public"
                  tag="submit_session"
                  defaultBody={{ ...base, action: "submit_session", session_context: { secure_token: secureToken } }}
                  sendLabel="Submit Session"
                  disabled={busy}
                  onSendStateChange={setBusy}
                  onSuccess={(result) => applyResult(result as VerifyResponse)}
                />
              )}
            </div>
          )}

          {nextAction.type === "select_otp_method" && (
            <div className="space-y-2.5">
              <Callout>
                Visa offers these one-time-code destinations. The <code>value</code> labels are
                opaque, issuer-masked strings — display them verbatim.
              </Callout>
              <div role="radiogroup" aria-label="Verification method" className="space-y-1.5">
                {nextAction.methods.map((method, index) => {
                  const checked = methodId ? methodId === method.id : index === 0;
                  return (
                    <label
                      key={method.id}
                      className={`flex cursor-pointer items-center gap-2 border p-2 text-xs ${
                        checked ? "border-ink-900 bg-ink-50" : "border-ink-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="otp-method"
                        checked={checked}
                        onChange={() => setMethodId(method.id)}
                      />
                      <span className="font-medium text-ink-900">{method.type}</span>
                      <span className="font-mono text-ink-600">{method.value}</span>
                    </label>
                  );
                })}
              </div>
              <RequestPanel
                method="POST"
                path={verifyPath}
                auth="public"
                tag="select_otp_method"
                defaultBody={{ ...base, action: "select_otp_method", method_id: methodId ?? nextAction.methods[0]?.id ?? "" }}
                sendLabel="Send Code"
                disabled={busy}
                onSendStateChange={setBusy}
                onSuccess={(result) => applyResult(result as VerifyResponse)}
              />
            </div>
          )}

          {nextAction.type === "otp" && (
            <div className="space-y-2.5">
              <Callout>
                Code sent via {nextAction.method.type} ({nextAction.method.value}) — expires in{" "}
                {nextAction.code_expiration_minutes ?? 5} min,{" "}
                {nextAction.max_attempts ?? 3} attempts (display hints; Visa enforces the real
                limits).{isTest && " Mock behavior: any code works on test tenants."}
              </Callout>
              <OtpInput onComplete={setOtpCode} error={otpError} disabled={busy} />
              <RequestPanel
                method="POST"
                path={verifyPath}
                auth="public"
                tag="submit_otp"
                defaultBody={{ ...base, action: "submit_otp", otp_code: otpCode }}
                sendLabel="Submit Code"
                disabled={busy}
                onSendStateChange={setBusy}
                onSuccess={(result) => applyResult(result as VerifyResponse)}
                onError={(error) => {
                  if (error.problem.type?.includes("INVALID_OTP")) {
                    setOtpError(error.problem.detail || "The code is invalid or expired — try again.");
                  }
                }}
              />
            </div>
          )}

          {nextAction.type === "passkey" && (
            <div className="space-y-2.5">
              <Callout title={`Why ${nextAction.passkey_context.action}`}>
                {nextAction.passkey_context.action === "REGISTER"
                  ? "Visa found no payment passkey for this card on this device, so the popup will create one. REGISTER never activates the rail — after it succeeds, verification restarts and comes back as AUTHENTICATE."
                  : "A payment passkey already exists for this card on this device, so the popup verifies with it."}{" "}
                Visa decides from device attestation — your code passes{" "}
                <code>passkey_context</code> through unchanged. The popup must open synchronously
                from your click; the resulting assurance data goes back through{" "}
                <code>submit_passkey</code> for server-side validation with Visa.
              </Callout>
              {isTest && (
                <Callout>
                  Test tenant: the popup that opens is a Basis Theory-hosted mock of Visa’s
                  ceremony — same embed block, same postMessage protocol, no real network.
                </Callout>
              )}
              <CodeBlock title="Visa popup ceremony (no SDK)" code={SNIPPET_PASSKEY} />
              {!visaReady && (
                <Button
                  variant="ghost"
                  onClick={() => initVisaSession(nextAction.embed as VisaEmbed)}
                  loading={busy}
                  loadingLabel="Initializing…"
                >
                  Reinitialize Visa Session
                </Button>
              )}
              {!assurance && !registerDone && (
                <Button
                  onClick={() => runVisaCeremony(nextAction.passkey_context)}
                  disabled={busy || !visaReady}
                >
                  Run Visa Ceremony ({nextAction.passkey_context.action})
                </Button>
              )}
              {assurance && (
                <>
                  <Callout tone="success">
                    Ceremony complete. The body below is pre-filled from the real popup result —
                    note <code>dfp_session_id</code> maps from the popup’s <code>rpID</code> and{" "}
                    <code>fido_assertion_data.code</code> from <code>fidoBlob</code>. Review, edit
                    if you like, then send.
                  </Callout>
                  <RequestPanel
                    method="POST"
                    path={verifyPath}
                    auth="public"
                    tag="submit_passkey"
                    defaultBody={{ ...base, action: "submit_passkey", assurance_data: assurance }}
                    sendLabel="Submit Passkey"
                    disabled={busy}
                    onSuccess={(result) => applyResult(result as VerifyResponse)}
                  />
                </>
              )}
              {registerDone && (
                <>
                  <Callout tone="success" title="Passkey created — now restart">
                    REGISTER never activates the rail. Send <code>start</code> again (fresh{" "}
                    <code>device_context</code>): the device is now bound, so verification jumps
                    straight to an AUTHENTICATE ceremony — no OTP this time.
                  </Callout>
                  <StartRequestPanel
                    verifyPath={verifyPath}
                    base={base}
                    displayName={displayName}
                    sendLabel="Restart Verification (start)"
                    disabled={busy}
                    onSendStateChange={setBusy}
                    onSuccess={(result) => {
                      setRegisterDone(false);
                      return applyResult(result);
                    }}
                  />
                </>
              )}
            </div>
          )}

          {nextAction.type === "redirect" && (
            <div className="space-y-2.5">
              <Callout title="Why a redirect">
                Mastercard’s authentication pages send <code>X-Frame-Options: DENY</code> —
                embedding is impossible by design. The cardholder completes the hosted ceremony in
                a popup (Mastercard creates a passkey there when the device needs one). The
                cardholder approves “Add Allowance to {displayName}”, then sees “Returning to{" "}
                {displayName}…”. A bridge message signals completion, and <code>complete</code>{" "}
                retrieves and validates the result with Mastercard server-to-server — only that
                response can activate the rail.
              </Callout>
              {isTest && (
                <Callout>
                  Test tenant: the page that opens is a Basis Theory-hosted mock of Mastercard’s
                  ceremony — same redirect and callback bridge, no real network.
                </Callout>
              )}
              <CodeBlock title="Mastercard hosted redirect" code={SNIPPET_REDIRECT} />
              {!mcCue && (
                <Button onClick={() => openMastercard(nextAction.uri as string)} disabled={busy}>
                  Authenticate with Mastercard
                </Button>
              )}
              {mcCue && (
                <Callout tone={mcCue === "message" ? "success" : "warning"}>
                  {mcCue === "message"
                    ? "The origin-checked bridge message arrived. It is a cue, not a result — send complete to finish."
                    : "The popup closed without a bridge message. That is fine: the message is only a cue. Send complete — it is authoritative and idempotent."}
                </Callout>
              )}
              <RequestPanel
                method="POST"
                path={verifyPath}
                auth="public"
                tag="complete"
                defaultBody={{ ...base, action: "complete" }}
                sendLabel="Complete Verification"
                disabled={busy}
                onSendStateChange={setBusy}
                onSuccess={(result) => handleCompleteResult(result as VerifyResponse)}
              />
              {pollNote && <p className="text-xs text-warning">{pollNote}</p>}
            </div>
          )}

          {!(KNOWN_NEXT_ACTION_TYPES as readonly string[]).includes(nextAction.type) && (
            <div className="space-y-2">
              <Callout tone="warning" title="Unknown next_action type">
                The API returned a next_action this tester does not know how to drive —
                next_action types are an open set. Raw payload:
              </Callout>
              <pre className="overflow-x-auto border border-ink-200 bg-ink-50 p-2 font-mono text-[11px]">
                {JSON.stringify(nextAction, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {verifyState && !nextAction && verifyState.status !== "active" && (
        <div className="space-y-2.5 border border-ink-200 bg-white p-3">
          <Callout tone="warning" title="Verification still pending">
            The rail is <code>verification_required</code> with nothing for the browser to do —
            the provider hasn’t finalized yet. Send <code>complete</code> again (it is
            authoritative and idempotent), or restart verification below.
          </Callout>
          {provider === "agentpay" && (
            <RequestPanel
              method="POST"
              path={verifyPath}
              auth="public"
              tag="complete"
              defaultBody={{ ...base, action: "complete" }}
              sendLabel="Complete Verification"
              disabled={busy}
              onSendStateChange={setBusy}
              onSuccess={(result) => handleCompleteResult(result as VerifyResponse)}
            />
          )}
          {pollNote && <p className="text-xs text-warning">{pollNote}</p>}
        </div>
      )}

      {ceremonyError && (
        <div role="alert" className="border border-error-border bg-error-soft p-2 text-xs text-error">
          {ceremonyError}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-ink-200 pt-3">
        {verifyState && (
          <Button
            variant="ghost"
            small
            disabled={busy}
            onClick={() => sendVerify({ action: "start", display_name: displayName, device_context: collectDeviceContext() }).catch(() => {})}
          >
            Restart verification
          </Button>
        )}
        {isTest && provider === "vic" && (
          <Button
            variant="ghost"
            small
            disabled={busy}
            onClick={() =>
              sendVerify({ action: "submit_passkey", assurance_data: { result: "approved" } }).catch(() => {})
            }
          >
            Skip ceremony (test tenant only)
          </Button>
        )}
        {isTest && provider === "agentpay" && verifyState && (
          <Button
            variant="ghost"
            small
            disabled={busy}
            onClick={() => sendVerify({ action: "complete" }).catch(() => {})}
          >
            Complete without callback (test tenant only)
          </Button>
        )}
      </div>
      {verifyState && provider === "vic" && (
        <p className="text-[11px] text-ink-500">
          Device-binding memory: after a REGISTER ceremony, the device is bound (the mock records
          it after <code>submit_otp</code>). “Restart verification” then jumps straight to an
          AUTHENTICATE ceremony — no OTP.{" "}
          {isTest &&
            "“Skip ceremony” calls submit_passkey with a stub body — the mock ignores state and content; real Visa would reject it."}
        </p>
      )}
    </div>
  );
}

/**
 * The `start` request panel. The body (with a freshly collected
 * device_context) is lazy-initialized once per mount, so each start surface
 * gets a fresh client_reference_id without churning the editable body on
 * every render.
 */
function StartRequestPanel({
  verifyPath,
  base,
  displayName,
  sendLabel,
  disabled,
  onSendStateChange,
  onSuccess,
}: {
  verifyPath: string;
  base: { rail: string; provider: string };
  displayName: string;
  sendLabel: string;
  disabled: boolean;
  onSendStateChange: (sending: boolean) => void;
  onSuccess: (result: VerifyResponse) => void | Promise<void>;
}) {
  const [body] = useState(() => ({
    ...base,
    action: "start",
    display_name: displayName,
    device_context: collectDeviceContext(),
  }));
  return (
    <RequestPanel
      method="POST"
      path={verifyPath}
      auth="public"
      tag="start"
      defaultBody={body}
      sendLabel={sendLabel}
      disabled={disabled}
      onSendStateChange={onSendStateChange}
      onSuccess={(result) => onSuccess(result as VerifyResponse)}
    />
  );
}

/* ── SDK variant ──────────────────────────────────────────────────────── */

function SdkVerify({ allowance, onActive }: { allowance: Allowance; onActive?: () => void }) {
  const { config } = useAppConfig();
  const { dispatch } = useSession();
  const logger = useApiLog();
  const toast = useToast();

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const verifierRef = useRef<ReturnType<typeof createVerifier> | null>(null);

  useEffect(() => {
    return () => verifierRef.current?.dispose();
  }, []);

  const rail = allowance.rails?.find((r) => r.rail === "agentic-token");
  const active = done || rail?.status === "active";

  const run = async () => {
    setError(null);
    setRunning(true);
    try {
      verifierRef.current?.dispose();
      const av = createVerifier({
        displayName: config?.displayName || "Example Agent",
        onEvent: (event) =>
          logger.log({
            source: "sdk",
            label: `event: ${String(event.type ?? "unknown")}`,
            response: event,
            ok: event.type !== "error",
          }),
      });
      verifierRef.current = av;
      await av.verifyAllowance(allowance.id);
      setDone(true);
      toast.success("Rail active — verification complete (SDK)");
      try {
        const fresh = await callAgentic<Allowance>(
          { method: "GET", path: `/allowances/${allowance.id}`, auth: "public" },
          logger,
        );
        dispatch({ type: "upsertAllowance", entry: { resource: fresh } });
      } catch {
        // best-effort refresh
      }
      onActive?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-600">
        This is the whole integration a customer ships: one factory call, one{" "}
        <code>verifyAllowance</code>. The SDK collects device context, drives the Visa
        iframe/popup or Mastercard redirect, renders its own OTP and interstitial UI, and resolves
        when the rail is active. Its activity streams into the inspector with the{" "}
        <span className="font-mono">sdk</span> pill.
      </p>
      <CodeBlock title="The entire SDK integration" language="js" code={SDK_INTEGRATION_SNIPPET} defaultOpen />
      {active ? (
        <Callout tone="success" title="Rail active">
          Verification complete. Re-running is harmless — the SDK resolves immediately on an
          already-active rail.
        </Callout>
      ) : (
        <Button onClick={run} loading={running} loadingLabel="SDK verifying — follow its prompts…">
          Verify with SDK
        </Button>
      )}
      {error && (
        <div role="alert" className="border border-error-border bg-error-soft p-2 text-xs text-error">
          {error}
        </div>
      )}
    </div>
  );
}
