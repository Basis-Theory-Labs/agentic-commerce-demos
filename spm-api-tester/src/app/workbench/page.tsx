"use client";

// The freeform mode: one section per resource, no ordering imposed. Create as
// many payment methods and allowances as you want (fresh idempotency key per
// create), PATCH and cancel allowances, retry rails, mint every format, and
// import external ids into the session registry.

import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CardTokenizePanel } from "@/components/CardTokenizePanel";
import { ImportPanel } from "@/components/ImportPanel";
import { MintPanel, AllowanceSummary } from "@/components/MintPanel";
import { PaymentMethodCard } from "@/components/PaymentMethodCard";
import { ProviderErrorList } from "@/components/ProviderErrorList";
import { RequestPanel } from "@/components/RequestPanel";
import { VerifyPanel } from "@/components/VerifyPanel";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { CopyChip } from "@/components/ui/CopyChip";
import { callAgentic } from "@/lib/agenticClient";
import { useApiLog } from "@/lib/apiLog";
import { scenarioForAllowance, useSession, type AllowanceEntry } from "@/lib/session";
import { existingOrFirst } from "@/lib/selection";
import { useToast } from "@/lib/toast";
import type { Allowance, PaymentMethod, ProviderErrorPage } from "@/lib/types";

export default function WorkbenchPage() {
  return (
    <AppShell>
      <Workbench />
    </AppShell>
  );
}

function Workbench() {
  const resources = [
    ["cards", "Cards & Tokens"],
    ["payment-methods", "Payment Methods"],
    ["allowances", "Allowances"],
    ["verification", "Verification"],
    ["credentials", "Credentials"],
  ] as const;

  return (
    <main className="mx-auto max-w-[1120px] px-5 py-10 pb-24 sm:px-8 lg:px-10 lg:py-12">
      <header className="max-w-3xl">
        <p className="mb-2 text-xs font-semibold tracking-[0.12em] text-accent uppercase">
          Resource workspace
        </p>
        <h1 className="text-3xl font-semibold sm:text-4xl">Workbench</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-600">
          Every resource type, freeform. Panels accept resources created here, in the Guided Flow,
          or pasted from anywhere else.
        </p>
      </header>

      <nav
        aria-label="Workbench resources"
        className="my-8 flex gap-1 overflow-x-auto rounded-xl border border-ink-200 bg-surface p-1.5"
      >
        {resources.map(([id, label], index) => (
          <a
            key={id}
            href={`#${id}`}
            className="flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
          >
            <span className="font-mono text-xs text-ink-400">
              {String(index + 1).padStart(2, "0")}
            </span>
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-8">
        <TokensSection />
        <PaymentMethodsSection />
        <AllowancesSection />
        <VerificationSection />
        <CredentialsSection />
      </div>
    </main>
  );
}

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className="surface-shadow scroll-mt-28 overflow-hidden rounded-2xl border border-ink-200 bg-surface"
    >
      <div className="border-b border-ink-200 px-5 py-5 sm:px-6">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-ink-600">{lead}</p>
      </div>
      <div className="space-y-5 p-5 sm:p-6">{children}</div>
    </section>
  );
}

/* ── tokens ───────────────────────────────────────────────────────────── */

function TokensSection() {
  const { state } = useSession();
  return (
    <Section
      id="cards"
      title="Cards & Tokens"
      lead="Tokenize as many cards as you like — mock scenarios or your own via Elements — or import an existing token id."
    >
      <CardTokenizePanel />
      <ImportPanel kind="token" />
      {state.tokens.length > 0 && (
        <ul className="space-y-2 rounded-xl border border-ink-200 bg-ink-50 p-4 text-xs">
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
  const effectiveTokenId = existingOrFirst(
    tokenId,
    state.tokens.map((token) => token.id),
  );
  const tokenEntry = state.tokens.find((t) => t.id === effectiveTokenId);

  return (
    <Section
      id="payment-methods"
      title="Payment Methods"
      lead="Create from any session token or a pasted token id. Each create gets a fresh idempotency key; rails provision in parallel."
    >
      {state.tokens.length > 0 ? (
        <>
          <label className="block text-xs font-medium tracking-wide text-ink-500 uppercase">
            Source token
            <select
              value={effectiveTokenId}
              onChange={(e) => setTokenId(e.target.value)}
              className="mt-1.5 block w-full max-w-lg rounded-lg border border-ink-300 bg-ink-50 px-3 py-2.5 font-mono text-xs"
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
  const effectivePmId = existingOrFirst(
    pmId,
    usablePms.map((pm) => pm.resource.id),
  );
  const pmEntry = state.paymentMethods.find((p) => p.resource.id === effectivePmId);

  return (
    <Section
      id="allowances"
      title="Allowances"
      lead="Create several on one payment method, PATCH the mandate (amount, description, expiry), cancel, retry failed rails, and inspect provider errors."
    >
      {usablePms.length > 0 ? (
        <>
          <label className="block text-xs font-medium tracking-wide text-ink-500 uppercase">
            Payment method
            <select
              value={effectivePmId}
              onChange={(e) => setPmId(e.target.value)}
              className="mt-1.5 block w-full max-w-lg rounded-lg border border-ink-300 bg-ink-50 px-3 py-2.5 font-mono text-xs"
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
  const [errors, setErrors] = useState<ProviderErrorPage | null>(null);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  // A late retry response must not revert a just-cancelled allowance.
  const cancelled = useRef(allowance.status === "cancelled");

  const errorRails = (allowance.rails ?? []).filter((rail) => rail.status === "error");

  const setRetryingFor = (key: string, active: boolean) => {
    setRetrying((prev) => {
      const next = new Set(prev);
      if (active) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const cancel = async () => {
    setCancelling(true);
    try {
      await callAgentic(
        { method: "DELETE", path: `/allowances/${allowance.id}`, auth: "proxy" },
        logger,
      );
      cancelled.current = true;
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
    <div className="space-y-4 rounded-xl border border-ink-200 bg-ink-50/40 p-4 sm:p-5">
      <AllowanceSummary allowance={allowance} />

      <details>
        <summary className="cursor-pointer text-sm font-semibold text-ink-900">
          PATCH — update the mandate
        </summary>
        <div className="mt-3 space-y-3">
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
        {errorRails.map((rail) => {
          const key = `${rail.rail}:${rail.provider}`;
          return (
            <Button
              key={key}
              variant="ghost"
              small
              loading={retrying.has(key)}
              disabled={cancelling}
              onClick={async () => {
                setRetryingFor(key, true);
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
                  if (!cancelled.current) {
                    dispatch({ type: "upsertAllowance", entry: { ...entry, resource: updated } });
                  }
                } catch (error) {
                  toast.error(error);
                } finally {
                  setRetryingFor(key, false);
                }
              }}
            >
              Retry {rail.rail} · {rail.provider}
            </Button>
          );
        })}
        <Button
          variant="ghost"
          small
          onClick={async () => {
            try {
              const result = await callAgentic<ProviderErrorPage>(
                { method: "GET", path: `/allowances/${allowance.id}/errors`, auth: "proxy" },
                logger,
              );
              setErrors({ ...result, data: result.data ?? [] });
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
              <span className="text-xs text-error">
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
            <Button
              variant="destructive"
              small
              disabled={retrying.size > 0}
              onClick={() => setConfirmingCancel(true)}
            >
              Cancel allowance
            </Button>
          ))}
      </div>

      {errors && (
        <div className="rounded-lg border border-ink-200 bg-ink-50 p-3 text-xs">
          <ProviderErrorList
            page={errors}
            emptyLabel="No provider errors recorded for this allowance."
          />
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
    <label className="block text-xs font-medium tracking-wide text-ink-500 uppercase">
      Allowance
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 block w-full max-w-lg rounded-lg border border-ink-300 bg-ink-50 px-3 py-2.5 font-mono text-xs"
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
  const effectiveId = existingOrFirst(
    alwId,
    state.allowances.map((allowance) => allowance.resource.id),
  );
  const entry = state.allowances.find((a) => a.resource.id === effectiveId);

  return (
    <Section
      id="verification"
      title="Verification"
      lead="Pick any allowance and run either flow variant. Compare the Manual wire timeline with the SDK's lifecycle events and typed failures in the inspector."
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
  const effectiveId = existingOrFirst(
    alwId,
    state.allowances.map((allowance) => allowance.resource.id),
  );
  const entry = state.allowances.find((a) => a.resource.id === effectiveId);

  return (
    <Section
      id="credentials"
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
          <CredentialLookup key={effectiveId} allowanceId={effectiveId} />
        </>
      ) : (
        <Callout>No allowances in this session yet — create or import one above.</Callout>
      )}
    </Section>
  );
}

function CredentialLookup({ allowanceId }: { allowanceId: string }) {
  const logger = useApiLog();
  const toast = useToast();
  const [credId, setCredId] = useState("");
  const [fetchedMeta, setFetchedMeta] = useState<Record<string, unknown> | null>(null);

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium tracking-wide text-ink-500 uppercase">
        Look up a credential id on this allowance (metadata only)
      </label>
      <div className="flex flex-wrap gap-2">
        <input
          value={credId}
          onChange={(e) => setCredId(e.target.value)}
          placeholder="cred_…"
          spellCheck={false}
          className="min-w-64 flex-1 rounded-lg border border-ink-300 bg-ink-50 px-3 py-2 font-mono text-xs text-ink-900 focus:border-accent focus:outline-none"
        />
        <Button
          variant="ghost"
          small
          onClick={async () => {
            const id = credId.trim();
            if (!id.startsWith("cred_")) {
              toast.error(new Error("That doesn't look like a credential id (cred_…)."));
              return;
            }
            try {
              const meta = await callAgentic<Record<string, unknown>>(
                {
                  method: "GET",
                  path: `/allowances/${allowanceId}/credentials/${id}`,
                  auth: "proxy",
                },
                logger,
              );
              setFetchedMeta(meta);
            } catch (error) {
              toast.error(error);
            }
          }}
        >
          GET
        </Button>
      </div>
      {fetchedMeta && (
        <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-ink-200 bg-ink-50 p-3 font-mono text-xs">
          {JSON.stringify(fetchedMeta, null, 2)}
        </pre>
      )}
    </div>
  );
}
