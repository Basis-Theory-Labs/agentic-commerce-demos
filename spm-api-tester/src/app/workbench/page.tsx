"use client";

// The freeform mode: one section per resource, no ordering imposed. Create as
// many payment methods and allowances as you want, opt into idempotent
// requests, PATCH and cancel allowances, retry rails, mint every format, and
// import external ids into the session registry.

import { useEffect, useRef, useState } from "react";
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
import { HighlightedCode } from "@/components/ui/HighlightedCode";
import { StatusPill } from "@/components/ui/StatusPill";
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

const WORKBENCH_RESOURCES = [
  ["cards", "Cards & Tokens"],
  ["payment-methods", "Payment Methods"],
  ["allowances", "Allowances"],
  ["verification", "Verification"],
  ["credentials", "Credentials"],
] as const;

type WorkbenchResource = (typeof WORKBENCH_RESOURCES)[number][0];

function Workbench() {
  const [activeResource, setActiveResource] = useState<WorkbenchResource>("cards");

  useEffect(() => {
    const syncHash = () => {
      const id = window.location.hash.slice(1);
      if (WORKBENCH_RESOURCES.some(([resource]) => resource === id)) {
        setActiveResource(id as WorkbenchResource);
      }
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const selectResource = (id: WorkbenchResource) => {
    setActiveResource(id);
    const url = new URL(window.location.href);
    url.hash = id;
    window.history.replaceState(null, "", url);
  };

  return (
    <main className="mx-auto max-w-[1240px] px-4 py-4 pb-12 sm:px-6">
      <h1 className="sr-only">Workbench</h1>

      <nav
        aria-label="Workbench resources"
        role="tablist"
        className="mb-3 flex gap-1 overflow-x-auto rounded-lg border border-ink-200 bg-surface p-0.5"
      >
        {WORKBENCH_RESOURCES.map(([id, label], index) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeResource === id}
            aria-controls={id}
            onClick={() => selectResource(id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
              activeResource === id
                ? "bg-accent-soft text-accent"
                : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
            }`}
          >
            <span className="font-mono text-[10px] text-ink-400">
              {String(index + 1).padStart(2, "0")}
            </span>
            {label}
          </button>
        ))}
      </nav>

      <div>
        <div role="tabpanel" hidden={activeResource !== "cards"}>
          <TokensSection />
        </div>
        <div role="tabpanel" hidden={activeResource !== "payment-methods"}>
          <PaymentMethodsSection />
        </div>
        <div role="tabpanel" hidden={activeResource !== "allowances"}>
          <AllowancesSection />
        </div>
        <div role="tabpanel" hidden={activeResource !== "verification"}>
          <VerificationSection />
        </div>
        <div role="tabpanel" hidden={activeResource !== "credentials"}>
          <CredentialsSection />
        </div>
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
      className="scroll-mt-24 overflow-hidden rounded-xl border border-ink-200 bg-surface"
    >
      <div className="border-b border-ink-200 px-3 py-2">
        <h2 className="text-base font-medium">{title}</h2>
        <p className="mt-0.5 max-w-3xl text-xs text-ink-500">{lead}</p>
      </div>
      <div className="space-y-2.5 p-3">{children}</div>
    </section>
  );
}

function ImportExisting({
  kind,
  label,
}: {
  kind: React.ComponentProps<typeof ImportPanel>["kind"];
  label: string;
}) {
  return (
    <details className="rounded-lg border border-ink-200 bg-ink-50/40">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-700">
        Import existing {label}
      </summary>
      <div className="border-t border-ink-200 p-2.5">
        <ImportPanel kind={kind} />
      </div>
    </details>
  );
}

function CreatedResources({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="space-y-2 border-t border-ink-200 pt-2.5">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-medium text-ink-700">Created {label}</h3>
        <span className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-[10px] text-ink-500">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

/* ── tokens ───────────────────────────────────────────────────────────── */

function TokensSection() {
  const { state } = useSession();
  return (
    <Section id="cards" title="Cards & Tokens" lead="Tokenize a mock or real card.">
      <CardTokenizePanel />
      <ImportExisting kind="token" label="token" />
      <CreatedResources label="tokens" count={state.tokens.length}>
        <ul className="divide-y divide-ink-200 rounded-lg border border-ink-200 bg-ink-50/40 text-xs">
          {state.tokens.map((token) => (
            <li key={token.id} className="flex flex-wrap items-center gap-2 px-2.5 py-2">
              <CopyChip value={token.id} />
              <span className="text-ink-500">
                {token.scenarioPan ? `mock •••• ${token.scenarioPan.slice(-4)}` : token.via}
              </span>
            </li>
          ))}
        </ul>
      </CreatedResources>
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
      lead="Create from a card token and inspect provisioned rails."
    >
      {state.tokens.length > 0 ? (
        <>
          <label className="block text-xs font-medium tracking-wide text-ink-500 uppercase">
            Source token
            <select
              value={effectiveTokenId}
              onChange={(e) => setTokenId(e.target.value)}
              className="mt-1 block w-full max-w-lg rounded-lg border border-ink-300 bg-ink-50 px-3 py-2 font-mono text-xs"
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
        <Callout>
          Create a token in Cards &amp; Tokens, or import an existing payment method.
        </Callout>
      )}
      <ImportExisting kind="payment-method" label="payment method" />
      <CreatedResources label="payment methods" count={state.paymentMethods.length}>
        <div className="space-y-2">
          {state.paymentMethods.map((entry) => (
            <details
              key={entry.resource.id}
              className="group overflow-hidden rounded-lg border border-ink-200 bg-surface"
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 flex-1 truncate font-mono text-ink-800">
                  {entry.resource.id}
                </span>
                <span className="text-ink-500">
                  {entry.resource.card?.brand ?? "card"} •••• {entry.resource.card?.last4}
                </span>
                <span className="text-[10px] text-ink-400">
                  {(entry.resource.rails ?? []).filter((rail) => rail.status === "enabled").length}/
                  {entry.resource.rails?.length ?? 0} rails
                </span>
                <span
                  aria-hidden
                  className="text-ink-400 transition-transform group-open:rotate-90"
                >
                  ›
                </span>
              </summary>
              <div className="border-t border-ink-200 bg-ink-50/30 p-2.5">
                <PaymentMethodCard entry={entry} allowDelete />
              </div>
            </details>
          ))}
        </div>
      </CreatedResources>
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
      lead="Create, update, retry, or cancel a spend mandate."
    >
      {usablePms.length > 0 ? (
        <>
          <label className="block text-xs font-medium tracking-wide text-ink-500 uppercase">
            Payment method
            <select
              value={effectivePmId}
              onChange={(e) => setPmId(e.target.value)}
              className="mt-1 block w-full max-w-lg rounded-lg border border-ink-300 bg-ink-50 px-3 py-2 font-mono text-xs"
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
            successToast={(result) => ({
              title: "Allowance created",
              id: (result as Allowance).id,
            })}
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
          Create an enabled payment method in Payment Methods, or import an allowance.
        </Callout>
      )}
      <ImportExisting kind="allowance" label="allowance" />
      <CreatedResources label="allowances" count={state.allowances.length}>
        <div className="space-y-2">
          {state.allowances.map((entry) => (
            <AllowanceCard key={entry.resource.id} entry={entry} />
          ))}
        </div>
      </CreatedResources>
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
      dispatch({
        type: "upsertAllowance",
        entry: { ...entry, resource: { ...allowance, status: "cancelled" } },
      });
      toast.success("Allowance cancelled — no new credentials can be minted from it");
    } catch (error) {
      toast.error(error);
    } finally {
      setCancelling(false);
      setConfirmingCancel(false);
    }
  };

  return (
    <details className="group overflow-hidden rounded-lg border border-ink-200 bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1 truncate font-mono text-ink-800">{allowance.id}</span>
        <span className="font-mono text-ink-500">
          {allowance.amount?.value ?? "—"} {allowance.amount?.currency ?? ""}
        </span>
        <StatusPill status={allowance.status ?? "unknown"} />
        <span aria-hidden className="text-ink-400 transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>

      <div className="space-y-2.5 border-t border-ink-200 bg-ink-50/30 p-3">
        <AllowanceSummary allowance={allowance} />

        <details className="rounded-lg border border-ink-200 bg-surface">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-700">
            Update allowance
          </summary>
          <div className="border-t border-ink-200 p-2.5">
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
              sendLabel="Update Allowance"
              successToast={() => ({ title: "Allowance updated" })}
              onSuccess={(result) =>
                dispatch({
                  type: "upsertAllowance",
                  entry: { ...entry, resource: result as Allowance },
                })
              }
            />
          </div>
        </details>

        <div className="flex flex-wrap items-center gap-1.5">
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
          {errorRails.length > 0 && (
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
          )}
          {allowance.status !== "cancelled" &&
            (confirmingCancel ? (
              <>
                <span className="text-xs text-error">This cancels its purchase instructions.</span>
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
                Cancel
              </Button>
            ))}
        </div>

        {errors && (
          <div className="rounded-lg border border-ink-200 bg-ink-50 p-2.5 text-xs">
            <ProviderErrorList
              page={errors}
              emptyLabel="No provider errors recorded for this allowance."
            />
          </div>
        )}
      </div>
    </details>
  );
}

/* ── verification & credentials ───────────────────────────────────────── */

function AllowancePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { state } = useSession();
  if (state.allowances.length === 0) return null;
  return (
    <label className="block text-xs font-medium tracking-wide text-ink-500 uppercase">
      Allowance
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full max-w-lg rounded-lg border border-ink-300 bg-ink-50 px-3 py-2 font-mono text-xs"
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
      lead="Verify an allowance with the raw API or SDK."
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
        <Callout>Create or import an allowance in Allowances.</Callout>
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
      lead="Mint credentials or inspect their metadata."
    >
      {entry ? (
        <>
          <AllowancePicker value={effectiveId} onChange={setAlwId} />
          <MintPanel
            key={`mint-${effectiveId}`}
            entry={entry}
            scenarioPan={scenarioForAllowance(state, effectiveId)}
          />
          <CredentialLookup key={`lookup-${effectiveId}`} allowanceId={effectiveId} />
        </>
      ) : (
        <Callout>Create or import an allowance in Allowances.</Callout>
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
    <details className="rounded-lg border border-ink-200 bg-surface">
      <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-700">
        Fetch credential metadata
      </summary>
      <div className="border-t border-ink-200 p-2.5">
        <div className="flex flex-wrap gap-2">
          <input
            value={credId}
            onChange={(e) => setCredId(e.target.value)}
            placeholder="cred_…"
            aria-label="Credential ID"
            spellCheck={false}
            className="min-w-64 flex-1 rounded-lg border border-ink-300 bg-ink-50 px-3 py-1.5 font-mono text-xs text-ink-900 focus:border-accent focus:outline-none"
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
          <pre className="mt-2.5 max-h-64 overflow-auto rounded-lg border border-ink-200 bg-ink-50 p-2.5 font-mono text-xs">
            <HighlightedCode code={JSON.stringify(fetchedMeta, null, 2)} language="json" />
          </pre>
        )}
      </div>
    </details>
  );
}
