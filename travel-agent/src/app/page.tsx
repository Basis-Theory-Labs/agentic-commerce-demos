"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAgentic } from "@basis-theory/react-agentic";
import Header from "@/components/Header";
import ChatMessage from "@/components/ChatMessage";
import FlightResults from "@/components/FlightResults";
import PaymentChoice from "@/components/PaymentChoice";
import TokenizeCard, { type TokenizedCard } from "@/components/TokenizeCard";
import EnrollmentPicker from "@/components/EnrollmentPicker";
import AirlineCheckout from "@/components/AirlineCheckout";
import BookingReceipt from "@/components/BookingReceipt";
import BehindTheCallsPanel from "@/components/BehindTheCallsPanel";
import BrandLogo from "@/components/BrandLogo";
import { useAgent } from "@/components/AgentProvider";
import {
  parseFlightQuery,
  generateFlightOptions,
  formatDate,
  formatTime,
  type FlightOption,
  type FlightSearch,
} from "@/lib/flights";
import { useApiLog, useLoggedFetch } from "@/lib/apiLog";
import type { Credentials, Enrollment } from "@/lib/types";

const PRESET_QUERY = "Find me a flight from São Paulo to Lisbon next month";
const WALLET_NAME = "SkyAgent";
const SDK_TIMEOUT_MS = 90_000;
const SDK_INIT_TIMEOUT_MS = 8_000;

interface BookingData {
  search: FlightSearch;
  flight?: FlightOption;
  paymentChoice?: "new" | "saved";
  agentId?: string;
  enrollment?: Enrollment;
  enrollmentVerified?: boolean;
  paymentAuthorized?: boolean;
  instructionId?: string;
  credentials?: Credentials;
  confirmationCode?: string;
}

type Stage =
  | "results"
  | "payment_choice"
  | "tokenize"
  | "saving_card"
  | "card_saved"
  | "verifying_enrollment"
  | "pick_saved"
  | "card_ready"
  | "instructing"
  | "airline_checkout"
  | "booked";

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 text-sm text-ink-900">
      <span className="w-4 h-4 rounded-full border-2 border-ink-900 border-t-transparent animate-spin" />
      <span>{label}</span>
    </div>
  );
}

function CardChip({ enrollment }: { enrollment: Enrollment }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-ink-200 p-3">
      <BrandLogo brand={enrollment.card.brand} height={22} />
      <div className="flex-1">
        <div className="font-mono text-sm text-ink-900">
          •••• {enrollment.card.last4}
        </div>
        <div className="text-xs text-ink-500">
          Exp {String(enrollment.card.expiration_month).padStart(2, "0")}/
          {enrollment.card.expiration_year}
        </div>
      </div>
    </div>
  );
}

function SdkErrorBanner() {
  return (
    <div className="text-xs text-error bg-red-50 border border-red-200 p-2">
      The verification SDK didn&rsquo;t load. Disable any ad-blocker and make
      sure you&rsquo;re on an <code className="font-mono">https://</code> URL,
      then refresh the page.
    </div>
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

const CHAT_BUBBLE =
  "bg-white border border-ink-200 px-4 py-3 text-sm space-y-3";

export default function Page() {
  const { ready, verifyEnrollment, verifyInstruction } = useAgentic();
  const { agentId: persistedAgentId, error: agentBootError } = useAgent();
  const { log } = useApiLog();
  const loggedFetch = useLoggedFetch();

  const [stage, setStage] = useState<Stage>("results");
  const [data, setData] = useState<BookingData>({
    search: parseFlightQuery(PRESET_QUERY),
  });
  const [error, setError] = useState<string | null>(null);

  const [sdkInitTimedOut, setSdkInitTimedOut] = useState(false);
  useEffect(() => {
    if (ready) return;
    const t = setTimeout(() => setSdkInitTimedOut(true), SDK_INIT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [ready]);
  const sdkTimedOut = !ready && sdkInitTimedOut;

  const inFlight = useRef(false);

  const reset = useCallback(() => {
    setStage("results");
    setData({ search: parseFlightQuery(PRESET_QUERY) });
    setError(null);
    inFlight.current = false;
  }, []);

  const handlePickFlight = useCallback((flight: FlightOption) => {
    setData((d) => ({ ...d, flight }));
    setStage("payment_choice");
  }, []);

  const handleNewCard = useCallback(() => {
    setData((d) => ({ ...d, paymentChoice: "new" }));
    setStage("tokenize");
  }, []);

  const handleSavedCard = useCallback(() => {
    setData((d) => ({ ...d, paymentChoice: "saved" }));
    setStage("pick_saved");
  }, []);

  const provisionNewCard = useCallback(
    async (card: TokenizedCard) => {
      if (inFlight.current) return;
      if (!persistedAgentId) {
        setError(
          agentBootError ??
            "Agent isn't ready yet. Please refresh in a moment."
        );
        return;
      }
      inFlight.current = true;
      setStage("saving_card");
      setError(null);

      try {
        const enrollRes = await loggedFetch("/api/enrollments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token_id: card.tokenId,
            agent_id: persistedAgentId,
            wallet_name: WALLET_NAME,
            consumer: { email: card.email },
          }),
          label: "POST /api/enrollments",
          step: "create-enrollment",
        });
        const enrollment = (await enrollRes.json()) as Enrollment & {
          error?: string;
        };
        if (!enrollRes.ok)
          throw new Error(enrollment.error || "Failed to save card");

        setData((d) => ({ ...d, agentId: persistedAgentId, enrollment }));
        setStage("card_saved");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save card");
        setStage("tokenize");
      } finally {
        inFlight.current = false;
      }
    },
    [loggedFetch, persistedAgentId, agentBootError]
  );

  const handleVerifyEnrollment = useCallback(async () => {
    const enrollment = data.enrollment;
    if (!enrollment || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setStage("verifying_enrollment");

    const start = Date.now();
    try {
      const result = await withTimeout(
        verifyEnrollment(enrollment.id),
        SDK_TIMEOUT_MS,
        "Verification timed out. Disable ad-block / check HTTPS and try again."
      );
      log({
        source: "sdk",
        label: `verifyEnrollment("${enrollment.id}")`,
        ok: true,
        request: { enrollmentId: enrollment.id },
        response: result,
        duration_ms: Date.now() - start,
        step: "verify-enrollment",
      });
      setData((d) => ({ ...d, enrollmentVerified: true }));
      setStage("card_ready");
    } catch (err) {
      log({
        source: "sdk",
        label: `verifyEnrollment("${enrollment.id}")`,
        ok: false,
        response: { error: err instanceof Error ? err.message : "failed" },
        duration_ms: Date.now() - start,
        step: "verify-enrollment",
      });
      setError(err instanceof Error ? err.message : "Verification failed");
      setStage("card_saved");
    } finally {
      inFlight.current = false;
    }
  }, [data.enrollment, verifyEnrollment, log]);

  const handlePickSaved = useCallback(
    (enrollment: Enrollment) => {
      if (!persistedAgentId) return;
      const isActive = enrollment.status === "active";
      setData((d) => ({
        ...d,
        agentId: persistedAgentId,
        enrollment,
        enrollmentVerified: isActive,
      }));
      setStage(isActive ? "card_ready" : "card_saved");
    },
    [persistedAgentId]
  );

  const handleAuthorize = useCallback(async () => {
    const { agentId, enrollment, flight } = data;
    if (!agentId || !enrollment || !flight || inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setData((d) => ({ ...d, paymentAuthorized: true }));
    setStage("instructing");

    try {
      const merchantHost = new URL(flight.bookingUrl).host;
      const merchant = {
        name: flight.airline,
        url: `https://${merchantHost}`,
        country_code: "US",
      };
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      const instrRes = await loggedFetch(
        `/api/instructions?agentId=${encodeURIComponent(agentId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            enrollment_id: enrollment.id,
            amount: { value: flight.price.toFixed(2), currency: "USD" },
            description: `Book Flight ${flight.flightNumber} · ${flight.airline}`,
            expires_at: expiresAt,
            merchant,
          }),
          label: "POST /api/instructions",
          step: "create-instruction",
        }
      );
      const instruction = await instrRes.json();
      if (!instrRes.ok)
        throw new Error(instruction.error || "Failed to create instruction");
      setData((d) => ({ ...d, instructionId: instruction.id }));

      const verifyStart = Date.now();
      try {
        const result = await withTimeout(
          verifyInstruction(agentId, instruction.id),
          SDK_TIMEOUT_MS,
          "Instruction verification timed out"
        );
        log({
          source: "sdk",
          label: `verifyInstruction("${agentId}", "${instruction.id}")`,
          ok: true,
          request: { agentId, instructionId: instruction.id },
          response: result,
          duration_ms: Date.now() - verifyStart,
          step: "verify-instruction",
        });
      } catch (err) {
        log({
          source: "sdk",
          label: `verifyInstruction("${agentId}", "${instruction.id}")`,
          ok: false,
          response: { error: err instanceof Error ? err.message : "failed" },
          duration_ms: Date.now() - verifyStart,
          step: "verify-instruction",
        });
        throw err;
      }

      const credRes = await loggedFetch(
        `/api/credentials?agentId=${encodeURIComponent(agentId)}&instructionId=${encodeURIComponent(instruction.id)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: { value: flight.price.toFixed(2), currency: "USD" },
            merchant,
            delivery_method: "electronic",
          }),
          label: "POST /api/credentials",
          step: "get-credentials",
        }
      );
      const credentials = (await credRes.json()) as Credentials & {
        error?: string;
      };
      if (!credRes.ok)
        throw new Error(credentials.error || "Failed to get credentials");

      setData((d) => ({ ...d, credentials }));
      setStage("airline_checkout");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
      setStage("card_ready");
    } finally {
      inFlight.current = false;
    }
  }, [data, loggedFetch, log, verifyInstruction]);

  const handleAirlineComplete = useCallback((transactionRef: string) => {
    setData((d) => ({ ...d, confirmationCode: transactionRef }));
    setStage("booked");
  }, []);

  const flightDateLabel = formatDate(`${data.search.date}T00:00:00Z`);

  return (
    <div className="min-h-screen flex flex-col bg-dots">
      <Header onReset={reset} />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-5">
        <ChatMessage role="user">
          Find me a flight from <strong>{data.search.origin.city}</strong> to{" "}
          <strong>{data.search.destination.city}</strong> on {flightDateLabel}.
        </ChatMessage>
        <ChatMessage role="assistant">
          <div className={CHAT_BUBBLE}>
            Here are five options for{" "}
            <strong>
              {data.search.origin.code} → {data.search.destination.code}
            </strong>{" "}
            on {flightDateLabel}.
          </div>
          <FlightResults
            flights={generateFlightOptions(data.search)}
            onSelect={handlePickFlight}
            selectedId={data.flight?.id}
          />
        </ChatMessage>

        {data.flight && (
          <>
            <ChatMessage role="user">
              I&rsquo;ll take the {data.flight.airline} flight at{" "}
              {formatTime(data.flight.departAt)} (${data.flight.price}).
            </ChatMessage>
            <ChatMessage role="assistant">
              <div className={CHAT_BUBBLE}>
                Great pick. How would you like to pay?
              </div>
              {stage === "payment_choice" && (
                <PaymentChoice
                  onNewCard={handleNewCard}
                  onSavedCard={handleSavedCard}
                />
              )}
            </ChatMessage>
          </>
        )}

        {data.paymentChoice && (
          <ChatMessage role="user">
            {data.paymentChoice === "new" ? "New Card" : "Saved Card"}
          </ChatMessage>
        )}

        {data.paymentChoice === "new" && (
          <ChatMessage role="assistant">
            <div className={CHAT_BUBBLE}>
              We&rsquo;ll save your card in SkyAgent&rsquo;s wallet.
            </div>
            {stage === "tokenize" && (
              <TokenizeCard onTokenized={provisionNewCard} />
            )}
            {stage === "saving_card" && (
              <div className={CHAT_BUBBLE}>
                <Spinner label="Saving card to wallet…" />
              </div>
            )}
          </ChatMessage>
        )}

        {data.paymentChoice === "saved" && !data.enrollment && (
          <ChatMessage role="assistant">
            <div className={CHAT_BUBBLE}>Pick a previously saved card.</div>
            {stage === "pick_saved" && (
              <EnrollmentPicker
                onPick={handlePickSaved}
                onUseNewCard={handleNewCard}
              />
            )}
          </ChatMessage>
        )}

        {data.paymentChoice === "new" && data.enrollment && (
          <ChatMessage role="user">
            Card details for{" "}
            <span className="font-mono">
              •••• {data.enrollment.card.last4}
            </span>
          </ChatMessage>
        )}

        {data.enrollment &&
          data.enrollment.status === "pending_verification" && (
            <ChatMessage role="assistant">
              <div className={CHAT_BUBBLE}>
                <p>
                  {data.paymentChoice === "new"
                    ? "Card saved. Before we can use it I need to verify that you own it."
                    : "This card still needs verification. Let's verify you own it."}
                </p>
                <CardChip enrollment={data.enrollment} />
                {stage === "card_saved" && (
                  <>
                    {sdkTimedOut && !ready && <SdkErrorBanner />}
                    {error && <p className="text-xs text-error">{error}</p>}
                    <button
                      onClick={handleVerifyEnrollment}
                      disabled={!ready}
                      className="w-full bg-ink-900 hover:bg-ink-700 disabled:opacity-50 text-white text-sm font-medium py-2 grid place-items-center"
                    >
                      {ready ? (
                        "Verify card"
                      ) : (
                        <span className="w-4 h-4 inline-block rounded-full border-2 border-white border-t-transparent animate-spin" />
                      )}
                    </button>
                  </>
                )}
                {stage === "verifying_enrollment" && (
                  <Spinner label="Verifying card ownership…" />
                )}
              </div>
            </ChatMessage>
          )}

        {data.enrollment &&
          data.enrollment.status === "pending_verification" &&
          data.enrollmentVerified && (
            <>
              <ChatMessage role="user">Verified card</ChatMessage>
              <ChatMessage role="assistant">
                <div className={CHAT_BUBBLE}>
                  Thanks for verifying. The card was added to your wallet.
                </div>
              </ChatMessage>
            </>
          )}

        {data.enrollment && data.enrollmentVerified && data.flight && (
          <ChatMessage role="assistant">
            <div className={CHAT_BUBBLE}>
              <p>
                Do you authorize the agent to use the card for a{" "}
                <strong>${data.flight.price}</strong> charge to{" "}
                {data.flight.airline}?
              </p>
              <CardChip enrollment={data.enrollment} />
              {stage === "card_ready" && (
                <>
                  {sdkTimedOut && !ready && <SdkErrorBanner />}
                  {error && <p className="text-xs text-error">{error}</p>}
                  <button
                    onClick={handleAuthorize}
                    disabled={!ready}
                    className="w-full bg-ink-900 hover:bg-ink-700 disabled:opacity-50 text-white text-sm font-medium py-2 grid place-items-center"
                  >
                    {ready ? (
                      "Authorize"
                    ) : (
                      <span className="w-4 h-4 inline-block rounded-full border-2 border-white border-t-transparent animate-spin" />
                    )}
                  </button>
                </>
              )}
            </div>
          </ChatMessage>
        )}

        {data.paymentAuthorized && (
          <ChatMessage role="assistant">
            <div className={CHAT_BUBBLE}>
              <p>Thanks for authorizing. Issuing virtual card for checkout.</p>
              {stage === "instructing" && (
                <Spinner label="Issuing one-time virtual card…" />
              )}
            </div>
          </ChatMessage>
        )}

        {data.credentials && data.flight && (
          <ChatMessage role="assistant">
            <div className={CHAT_BUBBLE}>
              Heading to{" "}
              <strong>{new URL(data.flight.bookingUrl).host}</strong> to
              complete your booking.
            </div>
            {stage === "airline_checkout" && (
              <AirlineCheckout
                flight={data.flight}
                credentials={data.credentials}
                onComplete={handleAirlineComplete}
              />
            )}
          </ChatMessage>
        )}

        {data.confirmationCode && data.flight && data.enrollment && (
          <ChatMessage role="assistant">
            <div className={CHAT_BUBBLE}>
              <strong>You&rsquo;re booked.</strong> Here are your trip details.
            </div>
            <BookingReceipt
              flight={data.flight}
              enrollment={data.enrollment}
              confirmationCode={data.confirmationCode}
              origin={data.search.origin}
              destination={data.search.destination}
            />
            <button
              onClick={reset}
              className="text-sm text-ink-900 hover:text-ink-700 font-medium underline underline-offset-2"
            >
              Book another →
            </button>
          </ChatMessage>
        )}
      </main>

      <BehindTheCallsPanel />
    </div>
  );
}
