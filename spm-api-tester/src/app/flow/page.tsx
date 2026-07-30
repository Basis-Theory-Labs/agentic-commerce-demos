"use client";

// The guided wizard: Card → Payment Method → Allowance → Verify →
// Credentials. Step and resource ids live in the URL (?step=&tok=&pm=&alw=)
// so any state is deep-linkable and browser back/forward works. Every step
// renders safely with missing state — import an id instead of crashing.

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { CardTokenizePanel } from "@/components/CardTokenizePanel";
import { ImportPanel } from "@/components/ImportPanel";
import { MintPanel } from "@/components/MintPanel";
import { PaymentMethodCard } from "@/components/PaymentMethodCard";
import { RequestPanel } from "@/components/RequestPanel";
import { VerifyPanel } from "@/components/VerifyPanel";
import { AllowanceSummary } from "@/components/MintPanel";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Stepper, type StepDef } from "@/components/ui/Stepper";
import { findAllowance, findPaymentMethod, scenarioForAllowance, useSession } from "@/lib/session";
import type { Allowance, PaymentMethod } from "@/lib/types";

const STEPS: StepDef[] = [
  { id: "card", title: "Card" },
  { id: "payment-method", title: "Payment Method" },
  { id: "allowance", title: "Allowance" },
  { id: "verify", title: "Verify" },
  { id: "credentials", title: "Credentials" },
];

export default function FlowPage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <Flow />
      </Suspense>
    </AppShell>
  );
}

function Flow() {
  const router = useRouter();
  const params = useSearchParams();
  const { state } = useSession();

  const step = STEPS.some((s) => s.id === params.get("step")) ? params.get("step")! : "card";
  const tokenId = params.get("tok");
  const pmId = params.get("pm");
  const alwId = params.get("alw");

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) next.delete(key);
        else next.set(key, value);
      }
      router.push(`/flow?${next.toString()}`);
    },
    [params, router],
  );

  const pmEntry = findPaymentMethod(state, pmId);
  const alwEntry = findAllowance(state, alwId);
  const tokenEntry = state.tokens.find((t) => t.id === tokenId);
  const agenticRail = alwEntry?.resource.rails?.find((r) => r.rail === "agentic-token");

  // Step changes move focus to the step heading so keyboard and screen-reader
  // users land where the content changed. Skip the very first paint.
  const focusArmed = useRef(false);
  useEffect(() => {
    if (!focusArmed.current) {
      focusArmed.current = true;
      return;
    }
    document.getElementById("step-heading")?.focus();
  }, [step]);

  const doneIds = new Set<string>();
  if (tokenEntry) doneIds.add("card");
  if (pmEntry) doneIds.add("payment-method");
  if (alwEntry) doneIds.add("allowance");
  if (alwEntry && (!agenticRail || agenticRail.status === "active")) doneIds.add("verify");
  if (alwEntry && state.credentials.some((c) => c.allowanceId === alwId)) {
    doneIds.add("credentials");
  }

  // Forward jumps are allowed when the step's prerequisite exists in the
  // registry; every step is also reachable to IMPORT missing state.
  const reachableIds = new Set<string>(STEPS.map((s) => s.id));

  return (
    <main className="min-w-0 pb-24">
      <div className="sticky top-0 z-30 border-b border-ink-200 bg-screen/95 backdrop-blur-xl md:top-18">
        <Stepper
          steps={STEPS}
          currentId={step}
          doneIds={doneIds}
          reachableIds={reachableIds}
          onSelect={(id) => setParams({ step: id })}
        />
      </div>

      <div className="mx-auto max-w-[1040px] px-5 py-9 sm:px-8 sm:py-12 lg:px-10">
        {step === "card" && (
          <StepShell
            eyebrow="Step 1 · Card"
            title="Start with a Card"
            lead="Everything begins with a vaulted card token. Pick a mock card (each drives a different scenario) or tokenize a real one with Elements."
            onRestart={() => setParams({ step: "card", tok: null, pm: null, alw: null })}
          >
            <CardTokenizePanel
              onTokenized={(id) =>
                setParams({ step: "payment-method", tok: id, pm: null, alw: null })
              }
            />
          </StepShell>
        )}

        {step === "payment-method" && (
          <StepShell
            eyebrow="Step 2 · Payment Method"
            title="Create the Payment Method"
            lead="Registering the token for agentic use provisions rails in parallel — the ways this card can pay. Each rail reports enabled, pending, or error independently."
            onRestart={() => setParams({ step: "card", tok: null, pm: null, alw: null })}
          >
            <PaymentMethodStep
              tokenId={tokenId}
              pmId={pmId}
              onTokenImported={(id) => setParams({ tok: id, pm: null, alw: null })}
              onPaymentMethodImported={(id) => setParams({ pm: id, alw: null })}
              onCreated={(pm) => setParams({ pm: pm.id, alw: null })}
              onContinue={() => setParams({ step: "allowance" })}
            />
          </StepShell>
        )}

        {step === "allowance" && (
          <StepShell
            eyebrow="Step 3 · Allowance"
            title="Grant an Allowance"
            lead="The allowance is the mandate: how much, at which merchant, until when. Issued credentials and unknown mint outcomes draw from it; conclusive mint failures release their reservation."
            onRestart={() => setParams({ step: "card", tok: null, pm: null, alw: null })}
          >
            <AllowanceStep
              pmId={pmId}
              alwId={alwId}
              onPmImported={(id) => setParams({ pm: id, alw: null })}
              onAllowanceImported={(id) => setParams({ alw: id })}
              onCreated={(alw) => setParams({ alw: alw.id })}
              onContinue={(needsVerify) =>
                setParams({ step: needsVerify ? "verify" : "credentials" })
              }
            />
          </StepShell>
        )}

        {step === "verify" && (
          <StepShell
            eyebrow="Step 4 · Verification"
            title="Verify the Agentic Token Rail"
            lead="Card networks require cardholder verification before this rail releases credentials. Run it step by step against the raw API, or with the SDK."
            onRestart={() => setParams({ step: "card", tok: null, pm: null, alw: null })}
          >
            {alwEntry ? (
              <VerifyPanel
                entry={alwEntry}
                scenarioPan={scenarioForAllowance(state, alwId)}
                onActive={() => undefined}
              />
            ) : (
              <MissingResource
                label="No allowance selected — create one in the Allowance step or import an id:"
                kind="allowance"
                initialValue={alwId ?? ""}
                onImported={(id) => setParams({ alw: id })}
              />
            )}
            {alwEntry && (!agenticRail || agenticRail.status === "active") && (
              <div className="mt-5">
                <Button onClick={() => setParams({ step: "credentials" })}>
                  Continue → Credentials
                </Button>
              </div>
            )}
          </StepShell>
        )}

        {step === "credentials" && (
          <StepShell
            eyebrow="Step 5 · Credentials"
            title="Mint Credentials"
            lead="Each issued credential—and any unknown provider outcome—draws from the allowance; conclusive failures release their reservation. This tester sends a fresh BT-IDEMPOTENCY-KEY, and credential values are returned exactly once."
            onRestart={() => setParams({ step: "card", tok: null, pm: null, alw: null })}
          >
            {alwEntry ? (
              <MintPanel entry={alwEntry} scenarioPan={scenarioForAllowance(state, alwId)} />
            ) : (
              <MissingResource
                label="No allowance selected — create one first or import an id:"
                kind="allowance"
                initialValue={alwId ?? ""}
                onImported={(id) => setParams({ alw: id })}
              />
            )}
          </StepShell>
        )}
      </div>
    </main>
  );
}

function StepShell({
  eyebrow,
  title,
  lead,
  onRestart,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  onRestart: () => void;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <div className="mb-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:gap-6">
        <div className="min-w-0 max-w-3xl">
          <p className="mb-2 text-xs font-semibold tracking-[0.12em] text-accent uppercase">
            {eyebrow}
          </p>
          <h1 id="step-heading" tabIndex={-1} className="text-3xl font-semibold outline-none sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-ink-600">{lead}</p>
        </div>
        <Button variant="ghost" small className="shrink-0" onClick={onRestart}>
          Start over
        </Button>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function MissingResource({
  label,
  kind,
  initialValue,
  onImported,
}: {
  label: string;
  kind: "token" | "payment-method" | "allowance";
  initialValue?: string;
  onImported: (id: string) => void;
}) {
  return (
    <div className="surface-shadow space-y-3 rounded-xl border border-ink-200 bg-surface p-5">
      <p className="text-sm text-ink-600">{label}</p>
      <ImportPanel
        key={`${kind}:${initialValue ?? ""}`}
        kind={kind}
        initialValue={initialValue}
        onImported={onImported}
      />
    </div>
  );
}

/* ── payment method step ──────────────────────────────────────────────── */

function PaymentMethodStep({
  tokenId,
  pmId,
  onTokenImported,
  onPaymentMethodImported,
  onCreated,
  onContinue,
}: {
  tokenId: string | null;
  pmId: string | null;
  onTokenImported: (id: string) => void;
  onPaymentMethodImported: (id: string) => void;
  onCreated: (pm: PaymentMethod) => void;
  onContinue: () => void;
}) {
  const { state, dispatch } = useSession();
  const [email, setEmail] = useState("shopper@example.com");
  const pmEntry = findPaymentMethod(state, pmId);
  const tokenEntry = state.tokens.find((t) => t.id === tokenId);

  if (pmId && !pmEntry) {
    return (
      <MissingResource
        label="This deep-linked payment method is not in this session yet — import it:"
        kind="payment-method"
        initialValue={pmId}
        onImported={onPaymentMethodImported}
      />
    );
  }

  if (!tokenEntry && !pmEntry) {
    return (
      <MissingResource
        label="No card token selected — tokenize one in the Card step, or paste a token id:"
        kind="token"
        initialValue={tokenId ?? ""}
        onImported={onTokenImported}
      />
    );
  }

  return (
    <>
      {tokenEntry && !pmEntry && (
        <>
          <div>
            <label
              htmlFor="consumer-email"
              className="mb-1.5 block text-xs font-medium tracking-wide text-ink-500 uppercase"
            >
              Consumer email
            </label>
            <input
              id="consumer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full max-w-lg rounded-lg border border-ink-300 bg-ink-50 px-3 py-2.5 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <RequestPanel
            method="POST"
            path="/payment-methods"
            auth="public"
            idempotency
            idempotencyNote="Creates replay safely: use Replay last key and resend — the API returns the same payment method instead of a duplicate."
            defaultBody={{
              source: { type: "basis_theory_card_token", token_id: tokenEntry.id },
              consumer: { email },
            }}
            sendLabel="Create Payment Method"
            loadingLabel="Provisioning rails…"
            successToast={(result) => ({
              title: "Payment method created",
              id: (result as PaymentMethod).id,
            })}
            onSuccess={(result) => {
              const pm = result as PaymentMethod;
              dispatch({
                type: "upsertPaymentMethod",
                entry: { resource: pm, tokenId: tokenEntry.id, scenarioPan: tokenEntry.scenarioPan },
              });
              onCreated(pm);
            }}
          />
        </>
      )}

      {pmEntry && (
        <>
          <PaymentMethodCard entry={pmEntry} />
          {pmEntry.resource.rails?.some((r) => r.status === "enabled") ? (
            <Button onClick={onContinue}>Continue → Allowance</Button>
          ) : (
            <Callout tone="warning">
              No rail is enabled yet — retry a failed or pending rail above, or start over with a different
              card. An allowance needs at least one enabled rail.
            </Callout>
          )}
        </>
      )}
    </>
  );
}

/* ── allowance step ───────────────────────────────────────────────────── */

function AllowanceStep({
  pmId,
  alwId,
  onPmImported,
  onAllowanceImported,
  onCreated,
  onContinue,
}: {
  pmId: string | null;
  alwId: string | null;
  onPmImported: (id: string) => void;
  onAllowanceImported: (id: string) => void;
  onCreated: (alw: Allowance) => void;
  onContinue: (needsVerify: boolean) => void;
}) {
  const { state, dispatch } = useSession();
  // Lazy-initialized so the impure clock read happens once, not per render.
  const [expiresAt] = useState(() => new Date(Date.now() + 24 * 3600e3).toISOString());
  const pmEntry = findPaymentMethod(state, pmId);
  const alwEntry = findAllowance(state, alwId);

  if (alwId && !alwEntry) {
    return (
      <MissingResource
        label="This deep-linked allowance is not in this session yet — import it:"
        kind="allowance"
        initialValue={alwId}
        onImported={onAllowanceImported}
      />
    );
  }

  if (!pmEntry && !alwEntry) {
    return (
      <MissingResource
        label="No payment method selected — create one in the previous step, or paste an id:"
        kind="payment-method"
        initialValue={pmId ?? ""}
        onImported={onPmImported}
      />
    );
  }

  const agenticRail = alwEntry?.resource.rails?.find((r) => r.rail === "agentic-token");
  const needsVerify = agenticRail?.status === "pending_verification";

  return (
    <>
      {pmEntry && !alwEntry && (
        <RequestPanel
          method="POST"
          path="/allowances"
          auth="proxy"
          idempotency
          idempotencyNote="Creates replay safely: use Replay last key and resend the same body — the API returns the same allowance instead of a duplicate."
          defaultBody={{
            payment_method_id: pmEntry.resource.id,
            amount: { value: "20.00", currency: "USD" },
            merchant: {
              name: "Acme Store",
              url: "https://acme.example.com",
              country_code: "US",
            },
            description: "Buy approved office supplies from Acme Store",
            metadata: { order_ref: "example-1138" },
            expires_at: expiresAt,
          }}
          sendLabel="Create Allowance"
          loadingLabel="Creating allowance…"
          successToast={(result) => ({
            title: "Allowance created",
            id: (result as Allowance).id,
          })}
          onSuccess={(result) => {
            const alw = result as Allowance;
            dispatch({
              type: "upsertAllowance",
              entry: { resource: alw, scenarioPan: pmEntry.scenarioPan },
            });
            onCreated(alw);
          }}
        />
      )}

      {alwEntry && (
        <>
          <AllowanceSummary allowance={alwEntry.resource} />
          {agenticRail?.status === "error" && (
            <Callout tone="warning">
              The agentic-token rail failed setup
              {agenticRail.error?.code ? (
                <>
                  {" "}
                  (<code>{agenticRail.error.code}</code>)
                </>
              ) : null}
              . Retry that rail from the Workbench before attempting verification.
            </Callout>
          )}
          <div className="flex flex-wrap gap-2">
            {needsVerify && (
              <Button onClick={() => onContinue(true)}>Continue → Verify Agentic Token</Button>
            )}
            {alwEntry.resource.rails?.some(
              (r) => r.rail === "spt" && ["enabled", "active"].includes(r.status),
            ) && (
              <Button variant={needsVerify ? "ghost" : "primary"} onClick={() => onContinue(false)}>
                Skip to Credentials (spt needs no verification)
              </Button>
            )}
          </div>
        </>
      )}
    </>
  );
}
