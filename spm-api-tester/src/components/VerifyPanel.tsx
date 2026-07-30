"use client";

// Allowance verification, both variants:
//
//   Manual — every verify action is an editable JSON request panel, including
//            the submit_session / submit_passkey / complete bodies pre-filled
//            from real ceremony results. The Visa iframe/popup protocol and
//            the Mastercard popup + origin-checked bridge + bounded complete
//            poll run exactly as a production integration would.
//   SDK    — the same allowance verified with one
//            @basis-theory/web-agentic call.
//
// Verify calls are serialized per allowance (concurrent actions 409 with
// ALLOWANCE_VERIFICATION_IN_PROGRESS — they don't queue).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  KNOWN_NEXT_ACTION_TYPES,
  type Allowance,
  type PasskeyContext,
  type ProviderName,
  type VerifyResponse,
  type VisaEmbed,
} from "@/lib/types";
import { AgenticApiError, callAgentic } from "@/lib/agenticClient";
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
import {
  createVerifier,
  normalizeSdkError,
  SDK_INTEGRATION_SNIPPET,
  serializeSdkEvent,
} from "@/lib/sdkVerify";
import { SNIPPET_LOOP, SNIPPET_PASSKEY, SNIPPET_REDIRECT } from "@/lib/snippets";
import { AGENTIC_API_URL, VISA_ENVIRONMENT, VISA_SANDBOX_EMBED } from "@/lib/env";
import { NOT_SIMULATABLE } from "@/lib/scenarios";
import { RequestPanel } from "@/components/RequestPanel";
import { ScenarioChip } from "@/components/ScenarioChip";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { CopyChip } from "@/components/ui/CopyChip";
import { HighlightedCode } from "@/components/ui/HighlightedCode";
import { OtpInput } from "@/components/ui/OtpInput";
import { RailChips } from "@/components/ui/StatusPill";

function isVerificationProvider(
  provider: ProviderName | undefined,
): provider is "vic" | "agentpay" {
  return provider === "vic" || provider === "agentpay";
}

function withActiveVerificationRail(allowance: Allowance, provider: "vic" | "agentpay"): Allowance {
  return {
    ...allowance,
    rails: allowance.rails?.map((rail) =>
      rail.rail === "agentic-token" && rail.provider === provider
        ? { ...rail, status: "active" }
        : rail,
    ),
  };
}

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
        This allowance has no agentic-token rail, so there is nothing to verify. Minting is
        available only from an active rail that advertises a supported credential format.
      </Callout>
    );
  }
  if (rail.status === "error") {
    return (
      <Callout tone="warning" title="Agentic-token rail setup failed">
        This rail cannot be verified while it is in <code>error</code>
        {rail.error?.code ? (
          <>
            {" "}
            (<code>{rail.error.code}</code>)
          </>
        ) : null}
        . Open the Workbench and retry the failed rail first.
      </Callout>
    );
  }
  if (!["pending_verification", "active"].includes(rail.status)) {
    return (
      <Callout tone="warning">
        This agentic-token rail is <code>{rail.status}</code>, not ready for verification. Refresh
        the allowance or resolve its setup state in the Workbench.
      </Callout>
    );
  }
  if (!isVerificationProvider(rail.provider)) {
    return (
      <Callout tone="warning" title="Unsupported verification provider">
        The agentic-token rail did not advertise <code>vic</code> or <code>agentpay</code>.
        Verification cannot safely infer a provider from the card brand.
      </Callout>
    );
  }
  const provider = rail.provider;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-surface p-2.5">
        <span className="text-[10px] font-medium tracking-wide text-ink-500 uppercase">
          Allowance
        </span>
        <CopyChip value={allowance.id} />
        <RailChips rails={allowance.rails} />
        <div className="ml-auto">
          <VariantToggle />
        </div>
      </div>
      <ScenarioChip scenarioPan={scenarioPan} stage="verify" />
      {variant === "manual" ? (
        <ManualVerify
          key={allowance.id}
          allowance={allowance}
          provider={provider}
          onActive={onActive}
        />
      ) : (
        <SdkVerify
          key={allowance.id}
          allowance={allowance}
          provider={provider}
          onActive={onActive}
        />
      )}
      <details className="rounded-lg border border-ink-200 bg-surface px-3 py-2 text-xs text-ink-600">
        <summary className="cursor-pointer font-semibold text-ink-900">
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

function ManualVerify({
  allowance,
  provider,
  onActive,
}: {
  allowance: Allowance;
  provider: "vic" | "agentpay";
  onActive?: () => void;
}) {
  const { config } = useAppConfig();
  const { dispatch } = useSession();
  const logger = useApiLog();
  const toast = useToast();

  const rail = allowance.rails?.find((r) => r.rail === "agentic-token");
  const isTest = config?.tenantType === "test";
  const displayName = config?.displayName || "Example Agent";

  const [verifyState, setVerifyState] = useState<VerifyResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [secureToken, setSecureToken] = useState<string | null>(null);
  const [assurance, setAssurance] = useState<AssuranceData | null>(null);
  const [registerDone, setRegisterDone] = useState(false);
  const [mcCue, setMcCue] = useState<"message" | "closed" | null>(null);
  const [mcOpen, setMcOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  // Monotonic per-failure nonce: identical error text on consecutive wrong
  // codes must still clear the boxes.
  const [otpFailures, setOtpFailures] = useState(0);
  const [methodId, setMethodId] = useState<string | null>(null);
  const [ceremonyError, setCeremonyError] = useState<string | null>(null);
  const [pollNote, setPollNote] = useState<string | null>(null);
  // Mirrors ceremonyRef.current?.ready — refs must not be read during render.
  const [visaReady, setVisaReady] = useState(false);

  const ceremonyRef = useRef<VisaCeremony | null>(null);
  const mcHandleRef = useRef<MastercardCeremonyHandle | null>(null);
  const visaInFlightRef = useRef(false);
  const verifyInFlightRef = useRef(false);
  const pollAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      ceremonyRef.current?.dispose();
      mcHandleRef.current?.cancel();
      mcHandleRef.current = null;
      pollAbortRef.current?.abort();
    };
  }, []);

  const cancelMastercard = useCallback(() => {
    const handle = mcHandleRef.current;
    mcHandleRef.current = null;
    handle?.cancel();
    setMcOpen(false);
  }, []);

  const base = useMemo(() => ({ rail: "agentic-token", provider }), [provider]);
  const verifyPath = `/allowances/${allowance.id}/verify`;

  const active = verifyState?.status === "active" || rail?.status === "active";

  const refreshAllowance = useCallback(async () => {
    try {
      const fresh = await callAgentic<Allowance>(
        { method: "GET", path: `/allowances/${allowance.id}`, auth: "proxy" },
        logger,
      );
      dispatch({ type: "upsertAllowance", entry: { resource: fresh } });
    } catch {
      // Refresh is best-effort; the verify response already told us the state.
    }
  }, [allowance.id, dispatch, logger]);

  const applyResult = useCallback(
    async (result: VerifyResponse) => {
      cancelMastercard();
      pollAbortRef.current?.abort();
      pollAbortRef.current = null;
      setVerifyState(result);
      setOtpError(null);
      setCeremonyError(null);
      // Step-scoped artifacts don't survive a state transition.
      setSecureToken(null);
      setAssurance(null);
      setMcCue(null);
      setOtpCode("");
      setMethodId(null);
      setRegisterDone(false);
      setPollNote(null);
      if (result.status === "active") {
        dispatch({
          type: "upsertAllowance",
          entry: { resource: withActiveVerificationRail(allowance, provider) },
        });
        toast.success("Rail active — verification complete");
        await refreshAllowance();
        onActive?.();
      }
    },
    [allowance, cancelMastercard, dispatch, provider, refreshAllowance, toast, onActive],
  );

  /** Direct (button-driven) verify send, serialized with everything else. */
  const sendVerify = useCallback(
    async (body: Record<string, unknown>, { silent = false } = {}) => {
      if (busy || verifyInFlightRef.current) return null;
      verifyInFlightRef.current = true;
      cancelMastercard();
      setBusy(true);
      try {
        const result = await callAgentic<VerifyResponse>(
          {
            method: "POST",
            path: verifyPath,
            body: { ...base, ...body },
            auth: "public",
            tag: String(body.action ?? "start"),
          },
          logger,
        );
        await applyResult(result);
        return result;
      } catch (error) {
        if (!silent) toast.error(error);
        throw error;
      } finally {
        verifyInFlightRef.current = false;
        setBusy(false);
      }
    },
    [busy, base, verifyPath, logger, applyResult, toast, cancelMastercard],
  );

  /** `complete` result handling with the bounded pending poll. */
  const handleCompleteResult = useCallback(
    async (result: VerifyResponse) => {
      if (result.status === "verification_required" && !result.next_action) {
        pollAbortRef.current?.abort();
        const controller = new AbortController();
        pollAbortRef.current = controller;
        setPollNote(
          "Still pending — polling complete every 2s (up to 10 tries). The mock never returns pending, but real Mastercard does.",
        );
        try {
          const final = await pollComplete(
            () =>
              callAgentic<VerifyResponse>(
                {
                  method: "POST",
                  path: verifyPath,
                  body: { ...base, action: "complete" },
                  auth: "public",
                  tag: "complete",
                  signal: controller.signal,
                },
                logger,
              ),
            {
              initialDelayMs: 2_000,
              signal: controller.signal,
              onPending: (attempt) =>
                setPollNote(`Still pending after attempt ${attempt} — retrying…`),
            },
          );
          await applyResult(final);
        } catch (error) {
          if (!(error instanceof Error && error.name === "AbortError")) toast.error(error);
        } finally {
          if (pollAbortRef.current === controller) pollAbortRef.current = null;
          if (!controller.signal.aborted) setPollNote(null);
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
    if (visaInFlightRef.current) return;
    const ceremony = ceremonyRef.current;
    if (!ceremony?.ready) {
      setCeremonyError("The Visa session is not initialized — reinitialize it below.");
      return;
    }
    setCeremonyError(null);
    visaInFlightRef.current = true;
    setBusy(true);
    let promise: ReturnType<VisaCeremony["authenticate"]>;
    try {
      // This call remains in the original click stack; the ref latch above is
      // synchronous and prevents a second click from replacing its popup.
      promise = ceremony.authenticate(passkeyContext);
    } catch (error) {
      visaInFlightRef.current = false;
      setBusy(false);
      setCeremonyError(error instanceof Error ? error.message : "Ceremony failed");
      return;
    }
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
      .finally(() => {
        visaInFlightRef.current = false;
        setBusy(false);
      });
  };

  /** MUST stay synchronous up to window.open — popup activation. */
  const openMastercard = (uri: string) => {
    if (mcHandleRef.current) return;
    setCeremonyError(null);
    const handle = openMastercardCeremony(uri, bridgeOrigins(AGENTIC_API_URL));
    if (!handle) {
      setCeremonyError("The browser blocked the Mastercard popup. Allow popups and try again.");
      return;
    }
    mcHandleRef.current = handle;
    setMcOpen(true);
    handle.settled.then((outcome) => {
      if (mcHandleRef.current !== handle) return;
      mcHandleRef.current = null;
      setMcOpen(false);
      setMcCue(outcome);
    });
  };

  const onCompleteSendStateChange = useCallback(
    (sending: boolean) => {
      if (sending) cancelMastercard();
      setBusy(sending);
    },
    [cancelMastercard],
  );

  const nextAction = verifyState?.next_action;

  if (active) {
    return null;
  }

  return (
    <div className="space-y-3">
      {!verifyState && (
        <>
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
        <div className="rounded-xl border border-ink-200 bg-surface p-3">
          <h3 className="mb-2.5 font-mono text-xs font-semibold text-accent">
            next_action: {String(nextAction.type)}
          </h3>

          {nextAction.type === "passkey_session" && (
            <div className="space-y-2.5">
              <Callout title="Initialize Visa verification">
                Create the hosted iframe session from <code>next_action.embed</code>, then submit
                its secure token. Do not hard-code embed fields.
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
                  defaultBody={{
                    ...base,
                    action: "submit_session",
                    session_context: { secure_token: secureToken },
                  }}
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
              <div role="radiogroup" aria-label="Verification method" className="space-y-2">
                {nextAction.methods.map((method, index) => {
                  const checked = methodId ? methodId === method.id : index === 0;
                  return (
                    <label
                      key={method.id}
                      className={`flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm ${
                        checked ? "border-accent/60 bg-accent-soft" : "border-ink-200 bg-ink-50/40"
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
                defaultBody={{
                  ...base,
                  action: "select_otp_method",
                  method_id: methodId ?? nextAction.methods[0]?.id ?? "",
                }}
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
                {nextAction.code_expiration_minutes ?? 5} min, {nextAction.max_attempts ?? 3}{" "}
                attempts (display hints; Visa enforces the real limits).
                {isTest &&
                  " Mock behavior: any code works unless you selected the invalid-OTP test card."}
              </Callout>
              <OtpInput
                onComplete={setOtpCode}
                error={otpError}
                errorKey={otpFailures}
                disabled={busy}
              />
              {otpCode ? (
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
                      setOtpError(
                        error.problem.detail || "The code is invalid or expired — try again.",
                      );
                      setOtpFailures((n) => n + 1);
                      setOtpCode("");
                    }
                  }}
                />
              ) : (
                <p className="text-xs text-ink-500">
                  Enter the complete code to populate the strict-schema request body.
                </p>
              )}
            </div>
          )}

          {nextAction.type === "passkey" && (
            <div className="space-y-2.5">
              <Callout title={`Why ${nextAction.passkey_context.action}`}>
                {nextAction.passkey_context.action === "REGISTER"
                  ? "REGISTER creates a device passkey, then verification restarts as AUTHENTICATE."
                  : "AUTHENTICATE verifies the existing device passkey."}{" "}
                Open the popup synchronously and return its assurance data through{" "}
                <code>submit_passkey</code>.
              </Callout>
              {isTest && (
                <Callout>
                  Test tenant: the popup that opens is a Basis Theory-hosted mock of Visa’s ceremony
                  — same embed block, same postMessage protocol, no real network.
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
                    Ceremony complete. <code>rpID</code> maps to <code>dfp_session_id</code>;{" "}
                    <code>fidoBlob</code> maps to <code>fido_assertion_data.code</code>.
                  </Callout>
                  <RequestPanel
                    method="POST"
                    path={verifyPath}
                    auth="public"
                    tag="submit_passkey"
                    defaultBody={{ ...base, action: "submit_passkey", assurance_data: assurance }}
                    sendLabel="Submit Passkey"
                    disabled={busy}
                    onSendStateChange={setBusy}
                    onSuccess={(result) => applyResult(result as VerifyResponse)}
                  />
                </>
              )}
              {registerDone && (
                <>
                  <Callout tone="success" title="Passkey created — now restart">
                    REGISTER does not activate the rail. Start again with fresh device context to
                    run AUTHENTICATE.
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
                Mastercard forbids iframe embedding. Open its popup synchronously, validate the
                bridge message’s origin and source, then send <code>complete</code>; only that API
                response is authoritative.
              </Callout>
              {isTest && (
                <Callout>
                  Test tenant: the page that opens is a Basis Theory-hosted mock of Mastercard’s
                  ceremony — same redirect and callback bridge, no real network.
                </Callout>
              )}
              <CodeBlock title="Mastercard hosted redirect" code={SNIPPET_REDIRECT} />
              {!mcCue && (
                <Button
                  onClick={() => openMastercard(nextAction.uri as string)}
                  disabled={busy || mcOpen}
                >
                  {mcOpen ? "Mastercard ceremony open…" : "Authenticate with Mastercard"}
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
                onSendStateChange={onCompleteSendStateChange}
                onSuccess={(result) => handleCompleteResult(result as VerifyResponse)}
              />
              {pollNote && <p className="text-xs text-warning">{pollNote}</p>}
            </div>
          )}

          {!(KNOWN_NEXT_ACTION_TYPES as readonly string[]).includes(nextAction.type) && (
            <div className="space-y-2">
              <Callout tone="warning" title="Unknown next_action type">
                The API returned a next_action this tester does not know how to drive — next_action
                types are an open set. Raw payload:
              </Callout>
              <pre className="overflow-x-auto rounded-lg border border-ink-200 bg-ink-50 p-3 font-mono text-xs">
                <HighlightedCode code={JSON.stringify(nextAction, null, 2)} language="json" />
              </pre>
            </div>
          )}
        </div>
      )}

      {verifyState && !nextAction && verifyState.status !== "active" && (
        <div className="space-y-2.5 rounded-xl border border-ink-200 bg-surface p-3">
          <Callout tone="warning" title="Verification still pending">
            The provider has not finalized. Send idempotent <code>complete</code> again or restart.
          </Callout>
          {provider === "agentpay" && (
            <RequestPanel
              method="POST"
              path={verifyPath}
              auth="public"
              tag="complete"
              defaultBody={{ ...base, action: "complete" }}
              sendLabel="Complete Verification"
              disabled={busy || mcOpen}
              onSendStateChange={setBusy}
              onSuccess={(result) => handleCompleteResult(result as VerifyResponse)}
            />
          )}
          {pollNote && <p className="text-xs text-warning">{pollNote}</p>}
        </div>
      )}

      {ceremonyError && (
        <div
          role="alert"
          className="rounded-lg border border-error-border bg-error-soft p-3 text-xs text-error"
        >
          {ceremonyError}
        </div>
      )}

      {(verifyState || (isTest && provider === "vic")) && (
        <div className="flex flex-wrap items-center gap-2 border-t border-ink-200 pt-3">
          {verifyState && (
            <Button
              variant="ghost"
              small
              disabled={busy || mcOpen}
              onClick={() =>
                sendVerify({
                  action: "start",
                  display_name: displayName,
                  device_context: collectDeviceContext(),
                }).catch(() => {})
              }
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
                sendVerify({
                  action: "submit_passkey",
                  assurance_data: { result: "approved" },
                }).catch(() => {})
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
      )}
      {isTest && provider === "vic" && (
        <details className="rounded-lg border border-ink-200 bg-surface px-3 py-2 text-xs text-ink-600">
          <summary className="cursor-pointer font-medium text-ink-800">Visa mock behavior</summary>
          <p className="mt-2">
            Skip ceremony submits a mock-only assurance body. After OTP, restart skips back to
            AUTHENTICATE because device binding is remembered per allowance.
          </p>
        </details>
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

function SdkVerify({
  allowance,
  provider,
  onActive,
}: {
  allowance: Allowance;
  provider: "vic" | "agentpay";
  onActive?: () => void;
}) {
  const { config } = useAppConfig();
  const { dispatch } = useSession();
  const logger = useApiLog();
  const toast = useToast();

  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const verifierRef = useRef<ReturnType<typeof createVerifier> | null>(null);
  const runningRef = useRef(false);

  useEffect(() => {
    return () => verifierRef.current?.dispose();
  }, []);

  const rail = allowance.rails?.find((r) => r.rail === "agentic-token");
  const active = done || rail?.status === "active";

  const run = async () => {
    if (runningRef.current) return;
    runningRef.current = true;
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
            response: serializeSdkEvent(event),
            ok: event.type !== "error",
          }),
      });
      verifierRef.current = av;
      await av.verifyAllowance(allowance.id, { provider });
      dispatch({
        type: "upsertAllowance",
        entry: { resource: withActiveVerificationRail(allowance, provider) },
      });
      setDone(true);
      toast.success("Rail active — verification complete (SDK)");
      try {
        const fresh = await callAgentic<Allowance>(
          { method: "GET", path: `/allowances/${allowance.id}`, auth: "proxy" },
          logger,
        );
        dispatch({ type: "upsertAllowance", entry: { resource: fresh } });
      } catch {
        // best-effort refresh
      }
      onActive?.();
    } catch (err) {
      const normalized = normalizeSdkError(err);
      setError(normalized.message || "Verification failed");
      if (normalized.problem && normalized.status !== undefined) {
        toast.error(
          new AgenticApiError(normalized.problem, normalized.status, normalized.traceId),
          "SDK verification failed",
        );
      } else {
        toast.error(err, "SDK verification failed");
      }
    } finally {
      runningRef.current = false;
      setRunning(false);
    }
  };

  return (
    <div className="space-y-3">
      {!active && (
        <Button onClick={run} loading={running} loadingLabel="SDK verifying — follow its prompts…">
          Verify with SDK
        </Button>
      )}
      <CodeBlock title="The entire SDK integration" language="js" code={SDK_INTEGRATION_SNIPPET} />
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-error-border bg-error-soft p-3 text-xs text-error"
        >
          {error}
        </div>
      )}
    </div>
  );
}
