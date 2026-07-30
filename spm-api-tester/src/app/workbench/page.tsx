"use client";

// The freeform mode: one section per resource, no ordering imposed. Create as
// many payment methods and allowances as you want (fresh idempotency key per
// create), PATCH and cancel allowances, retry rails, mint every format, and
// import external ids into the session registry.

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CardTokenizePanel } from "@/components/CardTokenizePanel";
import { ImportPanel } from "@/components/ImportPanel";
import { MintPanel, AllowanceSummary } from "@/components/MintPanel";
import { PaymentMethodCard } from "@/components/PaymentMethodCard";
import { RequestPanel } from "@/components/RequestPanel";
import { VerifyPanel } from "@/components/VerifyPanel";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { CopyChip } from "@/components/ui/CopyChip";
import { callAgentic } from "@/lib/agenticClient";
import { useApiLog } from "@/lib/apiLog";
import { scenarioForAllowance, useSession, type AllowanceEntry } from "@/lib/session";
import { useToast } from "@/lib/toast";
import type { Allowance, PaymentMethod } from "@/lib/types";

export default function WorkbenchPage() {
  return (
    <AppShell>
      <Workbench />
    </AppShell>
  );
}

function Workbench() {
  return (
    <main className="mx-auto max-w-3xl space-y-10 px-4 py-8 pb-24">
      <header>
        <h1 className="text-xl font-semibold">Workbench</h1>
        <p className="mt-1 text-xs text-ink-600">
          Every resource type, freeform. Panels accept resources created here, in the Guided Flow,
          or pasted from anywhere else.
        </p>
      </header>

      <TokensSection />
      <PaymentMethodsSection />
      <AllowancesSection />
      <VerificationSection />
      <CredentialsSection />
    </main>
  );
}

function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-0.5 text-xs text-ink-600">{lead}</p>
      </div>
      {children}
    </section>
  );
}

/* ── tokens ───────────────────────────────────────────────────────────── */

function TokensSection() {
  const { state } = useSession();
  return (
    <Section
      title="Cards & Tokens"
      lead="Tokenize as many cards as you like — mock scenarios or your own via Elements — or import an existing token id."
    >
      <CardTokenizePanel />
      <ImportPanel kind="token" />
      {state.tokens.length > 0 && (
        <ul className="space-y-1.5 border border-ink-200 bg-white p-3 text-xs">
          {state.tokens.map((token) => (
            <li key={token.id} className="flex flex-wrap items-center gap-2">
              <CopyChip value={token.id} />
              <span className="text-ink-500">
                {token.scenarioPan
                  ? `mock ${token.scenarioPan.replace(/(\d{4})/g, "$1 ").trim()}`
                  : token.via}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ── payment methods ──────────────────────────────────────────────────── */

function PaymentMethodsSection() {
  const { state, dispatch } = useSession();
  const [tokenId, setTokenId] = useState<string>("");
  const effectiveTokenId = tokenId || state.tokens[0]?.id || "";
  const tokenEntry = state.tokens.find((t) => t.id === effectiveTokenId);

  return (
    <Section
      title="Payment Methods"
      lead="Create from any session token or a pasted token id. Each create gets a fresh idempotency key; rails provision in parallel."
    >
      {state.tokens.length > 0 ? (
        <>
          <label className="block text-[11px] tracking-wide text-ink-500 uppercase">
            Source token
            <select
              value={effectiveTokenId}
              onChange={(e) => setTokenId(e.target.value)}
              className="mt-1 block w-full max-w-md border border-ink-300 bg-white px-2 py-1.5 font-mono text-xs"
            >
              {state.tokens.map((token) => (
                <option key={token.id} value={token.id}>
                  {token.id}
                  {token.scenarioPan ? ` (mock ${token.scenarioPan.slice(-4)})` : ""}
                </option>
              ))}
            </select>
          </label>
          <RequestPanel
            key={effectiveTokenId}
            method="POST"
            path="/payment-methods"
            auth="public"
            idempotency
            defaultBody={{
              source: { type: "basis_theory_card_token", token_id: effectiveTokenId },
              consumer: { email: "shopper@example.com" },
            }}
            sendLabel="Create Payment Method"
            loadingLabel="Provisioning rails…"
            successToast={(result) => ({
              title: "Payment method created",
              id: (result as PaymentMethod).id,
            })}
            onSuccess={(result) =>
              dispatch({
                type: "upsertPaymentMethod",
                entry: {
                  resource: result as PaymentMethod,
                  tokenId: effectiveTokenId,
                  scenarioPan: tokenEntry?.scenarioPan,
                },
              })
            }
          />
        </>
      ) : (
        <Callout>Tokenize a card above first — or import an existing payment method:</Callout>
      )}
      <ImportPanel kind="payment-method" />
      {state.paymentMethods.map((entry) => (
        <PaymentMethodCard key={entry.resource.id} entry={entry} allowDelete />
      ))}
    </Section>
  );
}

/* ── allowances ───────────────────────────────────────────────────────── */

function AllowancesSection() {
  const { state, dispatch } = useSession();
  const [pmId, setPmId] = useState<string>("");
  // Lazy-initialized so the impure clock read happens once, not per render.
  const [expiresAt] = useState(() => new Date(Date.now() + 24 * 3600e3).toISOString());
  const usablePms = state.paymentMethods.filter((p) =>
    p.resource.rails?.some((r) => r.status === "enabled"),
  );
  const effectivePmId = pmId || usablePms[0]?.resource.id || "";
  const pmEntry = state.paymentMethods.find((p) => p.resource.id === effectivePmId);

  return (
    <Section
      title="Allowances"
      lead="Create several on one payment method, PATCH the mandate (amount, description, expiry), cancel, retry failed rails, and inspect provider errors."
    >
      {usablePms.length > 0 ? (
        <>
          <label className="block text-[11px] tracking-wide text-ink-500 uppercase">
            Payment method
            <select
              value={effectivePmId}
              onChange={(e) => setPmId(e.target.value)}
              className="mt-1 block w-full max-w-md border border-ink-300 bg-white px-2 py-1.5 font-mono text-xs"
            >
              {usablePms.map((pm) => (
                <option key={pm.resource.id} value={pm.resource.id}>
                  {pm.resource.id} ({pm.resource.card?.brand} •••• {pm.resource.card?.last4})
                </option>
              ))}
            </select>
          </label>
          <RequestPanel
            key={effectivePmId}
            method="POST"
            path="/allowances"
            auth="proxy"
            idempotency
            idempotencyNote="A fresh key per create — resend with the key untouched and the API replays the same allowance instead of creating a second one."
            defaultBody={{
              payment_method_id: effectivePmId,
              amount: { value: "20.00", currency: "USD" },
              merchant: { name: "Acme Store", url: "https://acme.example.com", country_code: "US" },
              description: "Buy approved office supplies from Acme Store",
              metadata: { order_ref: "example-1138" },
              expires_at: expiresAt,
            }}
            sendLabel="Create Allowance"
            successToast={(result) => ({ title: "Allowance created", id: (result as Allowance).id })}
            onSuccess={(result) =>
              dispatch({
                type: "upsertAllowance",
                entry: { resource: result as Allowance, scenarioPan: pmEntry?.scenarioPan },
              })
            }
          />
        </>
      ) : (
        <Callout>
          No payment method with an enabled rail in this session — create one above or import an
          allowance directly:
        </Callout>
      )}
      <ImportPanel kind="allowance" />
      {state.allowances.map((entry) => (
        <AllowanceCard key={entry.resource.id} entry={entry} />
      ))}
    </Section>
  );
}

function AllowanceCard({ entry }: { entry: AllowanceEntry }) {
  const allowance = entry.resource;
  const { dispatch } = useSession();
  const logger = useApiLog();
  const toast = useToast();
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [errors, setErrors] = useState<Record<string, unknown>[] | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const errorRails = (allowance.rails ?? []).filter((rail) => rail.status === "error");

  const cancel = async () => {
    setCancelling(true);
    try {
      await callAgentic(
        { method: "DELETE", path: `/allowances/${allowance.id}`, auth: "proxy" },
        logger,
      );
      dispatch({ type: "upsertAllowance", entry: { ...entry, resource: { ...allowance, status: "cancelled" } } });
      toast.success("Allowance cancelled — no new credentials can be minted from it");
    } catch (error) {
      toast.error(error);
    } finally {
      setCancelling(false);
      setConfirmingCancel(false);
    }
  };

  return (
    <div className="space-y-2 border border-ink-200 bg-white p-3">
      <AllowanceSummary allowance={allowance} />

      <details>
        <summary className="cursor-pointer text-xs font-medium text-ink-900">
          PATCH — update the mandate
        </summary>
        <div className="mt-2 space-y-2">
          <Callout>
            Updates are provider-first: the network-side mandate changes before the same values
            commit locally, and mints are blocked while the update is in flight. Send any subset
            of <code>amount</code>, <code>description</code>, <code>expires_at</code> — unknown
            keys are rejected.
          </Callout>
          <RequestPanel
            method="PATCH"
            path={`/allowances/${allowance.id}`}
            auth="proxy"
            defaultBody={{
              amount: {
                value: (Number(allowance.amount?.value ?? "20") + 10).toFixed(2),
                currency: allowance.amount?.currency ?? "USD",
              },
              description: allowance.description ?? "Updated mandate",
            }}
            sendLabel="PATCH Allowance"
            successToast={() => ({ title: "Allowance updated" })}
            onSuccess={(result) =>
              dispatch({ type: "upsertAllowance", entry: { ...entry, resource: result as Allowance } })
            }
          />
        </div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        {errorRails.map((rail) => (
          <Button
            key={`${rail.rail}:${rail.provider}`}
            variant="ghost"
            small
            loading={retrying === `${rail.rail}:${rail.provider}`}
            onClick={async () => {
              setRetrying(`${rail.rail}:${rail.provider}`);
              try {
                const updated = await callAgentic<Allowance>(
                  {
                    method: "POST",
                    path: `/allowances/${allowance.id}/rails/retry`,
                    body: { rail: rail.rail, provider: rail.provider },
                    auth: "proxy",
                    tag: "rails/retry",
                  },
                  logger,
                );
                dispatch({ type: "upsertAllowance", entry: { ...entry, resource: updated } });
              } catch (error) {
                toast.error(error);
              } finally {
                setRetrying(null);
              }
            }}
          >
            Retry {rail.rail} · {rail.provider}
          </Button>
        ))}
        <Button
          variant="ghost"
          small
          onClick={async () => {
            try {
              const result = await callAgentic<{ data: Record<string, unknown>[] }>(
                { method: "GET", path: `/allowances/${allowance.id}/errors`, auth: "proxy" },
                logger,
              );
              setErrors(result.data ?? []);
            } catch (error) {
              toast.error(error);
            }
          }}
        >
          View provider errors
        </Button>
        {allowance.status !== "cancelled" &&
          (confirmingCancel ? (
            <>
              <span className="text-[11px] text-error">
                Network-side purchase instructions are cancelled with it.
              </span>
              <Button variant="destructive" small loading={cancelling} onClick={cancel}>
                Confirm cancel
              </Button>
              <Button variant="ghost" small onClick={() => setConfirmingCancel(false)}>
                Keep it
              </Button>
            </>
          ) : (
            <Button variant="destructive" small onClick={() => setConfirmingCancel(true)}>
              Cancel allowance
            </Button>
          ))}
      </div>

      {errors && (
        <div className="border border-ink-200 bg-ink-50 p-2 text-xs">
          {errors.length === 0 ? (
            <p className="text-ink-500">No provider errors recorded for this allowance.</p>
          ) : (
            <ul className="space-y-1.5">
              {errors.map((error, index) => (
                <li key={index} className="font-mono text-[11px] text-ink-700">
                  {String(error.code ?? "?")} ({String(error.provider ?? "")}) ·{" "}
                  {String(error.detail ?? error.title ?? "")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/* ── verification & credentials ───────────────────────────────────────── */

function AllowancePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { state } = useSession();
  if (state.allowances.length === 0) return null;
  return (
    <label className="block text-[11px] tracking-wide text-ink-500 uppercase">
      Allowance
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full max-w-md border border-ink-300 bg-white px-2 py-1.5 font-mono text-xs"
      >
        {state.allowances.map((entry) => (
          <option key={entry.resource.id} value={entry.resource.id}>
            {entry.resource.id} ({entry.resource.amount?.value} {entry.resource.amount?.currency},{" "}
            {entry.resource.status})
          </option>
        ))}
      </select>
    </label>
  );
}

function VerificationSection() {
  const { state } = useSession();
  const [alwId, setAlwId] = useState("");
  const effectiveId = alwId || state.allowances[0]?.resource.id || "";
  const entry = state.allowances.find((a) => a.resource.id === effectiveId);

  return (
    <Section
      title="Verification"
      lead="Pick any allowance and run either flow variant. Verify one manually and the next via SDK, then compare the transcripts in the inspector."
    >
      {entry ? (
        <>
          <AllowancePicker value={effectiveId} onChange={setAlwId} />
          <VerifyPanel
            key={effectiveId}
            entry={entry}
            scenarioPan={scenarioForAllowance(state, effectiveId)}
          />
        </>
      ) : (
        <Callout>No allowances in this session yet — create or import one above.</Callout>
      )}
    </Section>
  );
}

function CredentialsSection() {
  const { state } = useSession();
  const [alwId, setAlwId] = useState("");
  const effectiveId = alwId || state.allowances[0]?.resource.id || "";
  const entry = state.allowances.find((a) => a.resource.id === effectiveId);

  return (
    <Section
      title="Credentials"
      lead="Mint every format the rails support, replay idempotency keys on purpose, and inspect metadata. Values appear once, in the reveal card."
    >
      {entry ? (
        <>
          <AllowancePicker value={effectiveId} onChange={setAlwId} />
          <MintPanel
            key={effectiveId}
            entry={entry}
            scenarioPan={scenarioForAllowance(state, effectiveId)}
          />
        </>
      ) : (
        <Callout>No allowances in this session yet — create or import one above.</Callout>
      )}
    </Section>
  );
}
