"use client";

// Credential minting for one allowance: every format the active rails
// support, plus the on-purpose failure demos (idempotency replay, overdraw,
// currency mismatch, MPP validation errors). Mint success renders the
// credential reveal card — values are returned exactly once.

import { useCallback, useMemo, useState } from "react";
import type { Allowance, Credential } from "@/lib/types";
import { callAgentic } from "@/lib/agenticClient";
import { useApiLog } from "@/lib/apiLog";
import { useSession, type AllowanceEntry } from "@/lib/session";
import { base64UrlJson, EXAMPLE_MPP_CARD_ENCRYPTION_JWK } from "@/lib/mpp";
import { RequestPanel } from "@/components/RequestPanel";
import { ScenarioChip } from "@/components/ScenarioChip";
import { CredentialRevealCard } from "@/components/CredentialRevealCard";
import { Callout } from "@/components/ui/Callout";
import { Button } from "@/components/ui/Button";
import { CopyChip } from "@/components/ui/CopyChip";
import { RailChips } from "@/components/ui/StatusPill";

interface MintDef {
  key: string;
  title: string;
  /** What this credential format is for — one line. */
  blurb: string;
  body: unknown;
}

function mintsFor(allowance: Allowance): MintDef[] {
  const currency = allowance.amount?.currency ?? "USD";
  const agentic = allowance.rails?.find((r) => r.rail === "agentic-token");
  const spt = allowance.rails?.find((r) => r.rail === "spt");
  const mints: MintDef[] = [];

  if (agentic?.provider && agentic.status === "active") {
    const provider = agentic.provider;
    const network = provider === "vic" ? "visa" : "mastercard";
    mints.push(
      {
        key: "agentic-card",
        title: "Agentic Token — Card",
        blurb: "A single-use virtual card (PAN, expiry, CVC) for typing into any checkout.",
        body: {
          rail: "agentic-token",
          provider,
          amount: { value: "5.00", currency },
          credential: { format: "card" },
        },
      },
      {
        key: "agentic-network-token",
        title:
          provider === "vic"
            ? "Visa Network Token — Short-Form Cryptogram"
            : "Mastercard Network Token — DSRP",
        blurb:
          "A device PAN plus one-time cryptogram, for gateways that accept network tokens directly.",
        body: {
          rail: "agentic-token",
          provider,
          amount: { value: "5.00", currency },
          credential: { format: "network-token" },
        },
      },
      {
        key: "agentic-mpp",
        title: `${provider === "vic" ? "Visa" : "Mastercard"} MPP Card Credential`,
        blurb:
          "A complete Machine Payments Protocol credential (method card) for an HTTP `Authorization: Payment` header.",
        body: {
          rail: "agentic-token",
          provider,
          credential: {
            format: "mpp",
            payload: {
              challenge: {
                id: "ch_card_example1",
                realm: "merchant.example",
                method: "card",
                intent: "charge",
                request: base64UrlJson({
                  amount: "500",
                  currency: currency.toLowerCase(),
                  description: "Acme checkout",
                  methodDetails: {
                    acceptedNetworks: [network],
                    merchantName: "Acme Store",
                    billingRequired: true,
                    encryptionJwk: EXAMPLE_MPP_CARD_ENCRYPTION_JWK,
                  },
                }),
                description: "Acme checkout",
                expires: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              },
              billing_address: {
                line1: "123 Main St",
                city: "New York",
                state: "NY",
                zip: "10001",
                country_code: "US",
              },
              cardholder_full_name: "Example Shopper",
            },
          },
        },
      },
    );
  }

  if (spt?.status === "enabled" || spt?.status === "active") {
    mints.push(
      {
        key: "spt-identifier",
        title: "Stripe SPT (Raw Identifier)",
        blurb:
          "The raw Stripe Shared PaymentToken id, charged through the recipient's Stripe network profile.",
        body: {
          rail: "spt",
          provider: "stripe",
          amount: { value: "5.00", currency },
          credential: {
            format: "identifier",
            payload: { network_business_profile: "np_example" },
          },
        },
      },
      {
        key: "spt-mpp",
        title: "Stripe MPP Authorization Credential",
        blurb:
          "An MPP credential wrapping the SPT (method stripe) for `Authorization: Payment` headers.",
        body: {
          rail: "spt",
          provider: "stripe",
          credential: {
            format: "mpp",
            payload: {
              challenge: {
                id: "ch_example1",
                realm: "merchant.example",
                method: "stripe",
                intent: "charge",
                request: base64UrlJson({
                  amount: "500",
                  currency: currency.toLowerCase(),
                  description: "Acme checkout",
                  methodDetails: {
                    networkId: "np_example",
                    paymentMethodTypes: ["card", "link"],
                  },
                }),
                description: "Acme checkout",
                expires: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
              },
            },
          },
        },
      },
    );
  }

  return mints;
}

function errorDemosFor(allowance: Allowance): MintDef[] {
  const currency = allowance.amount?.currency ?? "USD";
  const agentic = allowance.rails?.find((r) => r.rail === "agentic-token");
  const spt = allowance.rails?.find((r) => r.rail === "spt");
  const railForAmountDemos =
    spt?.status === "enabled" || spt?.status === "active"
      ? { rail: "spt", provider: "stripe", format: { format: "identifier", payload: { network_business_profile: "np_example" } } }
      : agentic?.status === "active" && agentic.provider
        ? { rail: "agentic-token", provider: agentic.provider, format: { format: "card" } }
        : null;

  const overdrawValue = (Number(allowance.amount_available?.value ?? allowance.amount?.value ?? "0") + 10).toFixed(2);
  const demos: MintDef[] = [];

  if (railForAmountDemos) {
    demos.push(
      {
        key: "demo-overdraw",
        title: "Amount overdraw → 400 ALLOWANCE_AMOUNT_EXCEEDED",
        blurb: `This amount (${overdrawValue}) exceeds amount_available — spend is burn-on-mint and the API refuses to overdraw.`,
        body: {
          rail: railForAmountDemos.rail,
          provider: railForAmountDemos.provider,
          amount: { value: overdrawValue, currency },
          credential: railForAmountDemos.format,
        },
      },
      {
        key: "demo-currency",
        title: "Currency mismatch → 400 VALIDATION_ERROR",
        blurb: `The allowance is in ${currency}; minting in ${currency === "EUR" ? "USD" : "EUR"} fails validation with a field-level error.`,
        body: {
          rail: railForAmountDemos.rail,
          provider: railForAmountDemos.provider,
          amount: { value: "5.00", currency: currency === "EUR" ? "USD" : "EUR" },
          credential: railForAmountDemos.format,
        },
      },
    );
  }

  if (agentic?.provider && agentic.status === "active") {
    const provider = agentic.provider;
    const wrongNetwork = provider === "vic" ? "mastercard" : "visa";
    const cardChallenge = (methodDetails: Record<string, unknown>) => ({
      id: "ch_card_demo",
      realm: "merchant.example",
      method: "card",
      intent: "charge",
      request: base64UrlJson({
        amount: "500",
        currency: currency.toLowerCase(),
        description: "Acme checkout",
        methodDetails,
      }),
      description: "Acme checkout",
      expires: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    });
    demos.push(
      {
        key: "demo-mpp-billing",
        title: "MPP: billingRequired without billing_address → 400",
        blurb:
          "The card challenge demands a billing address, but the payload omits it — watch the per-field errors{} in the toast.",
        body: {
          rail: "agentic-token",
          provider,
          credential: {
            format: "mpp",
            payload: {
              challenge: cardChallenge({
                acceptedNetworks: [provider === "vic" ? "visa" : "mastercard"],
                merchantName: "Acme Store",
                billingRequired: true,
                encryptionJwk: EXAMPLE_MPP_CARD_ENCRYPTION_JWK,
              }),
              cardholder_full_name: "Example Shopper",
            },
          },
        },
      },
      {
        key: "demo-mpp-network",
        title: "MPP: acceptedNetworks excludes this rail's network → 400",
        blurb: `The challenge only accepts ${wrongNetwork}, but this rail mints ${provider === "vic" ? "visa" : "mastercard"} — field-level validation error.`,
        body: {
          rail: "agentic-token",
          provider,
          credential: {
            format: "mpp",
            payload: {
              challenge: cardChallenge({
                acceptedNetworks: [wrongNetwork],
                merchantName: "Acme Store",
                billingRequired: false,
                encryptionJwk: EXAMPLE_MPP_CARD_ENCRYPTION_JWK,
              }),
            },
          },
        },
      },
    );
  }

  return demos;
}

export function MintPanel({ entry, scenarioPan }: { entry: AllowanceEntry; scenarioPan?: string }) {
  const allowance = entry.resource;
  const { dispatch } = useSession();
  const logger = useApiLog();
  const [revealed, setRevealed] = useState<Credential[]>([]);
  const [listing, setListing] = useState(false);
  const [listed, setListed] = useState<Record<string, unknown>[] | null>(null);

  const refreshAllowance = useCallback(async () => {
    try {
      const fresh = await callAgentic<Allowance>(
        { method: "GET", path: `/allowances/${allowance.id}`, auth: "public" },
        logger,
      );
      dispatch({ type: "upsertAllowance", entry: { resource: fresh } });
    } catch {
      // best-effort
    }
  }, [allowance.id, dispatch, logger]);

  const onMinted = async (result: unknown) => {
    const credential = result as Credential;
    setRevealed((prev) => [credential, ...prev]);
    dispatch({
      type: "addCredential",
      entry: {
        allowanceId: allowance.id,
        resource: {
          ...credential,
          credential: { format: credential.credential?.format ?? "unknown" },
        },
      },
    });
    await refreshAllowance();
  };

  // Memoized so editable defaults (challenge expiries) don't churn per render.
  const mints = useMemo(() => mintsFor(allowance), [allowance]);
  const demos = useMemo(() => errorDemosFor(allowance), [allowance]);

  return (
    <div className="space-y-3">
      <AllowanceSummary allowance={allowance} />
      <ScenarioChip scenarioPan={scenarioPan} stage="credentials" />

      {mints.length === 0 && (
        <Callout tone="warning">
          No rail on this allowance can mint right now. The agentic-token rail must be{" "}
          <b>active</b> (verify it first) and the spt rail must be <b>enabled</b>.
        </Callout>
      )}

      {revealed.map((credential) => (
        <CredentialRevealCard key={credential.id} credential={credential} />
      ))}

      {mints.map((mint, index) => (
        <details key={mint.key} className="group border border-ink-200 bg-white" open={index === 0}>
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-900 hover:bg-ink-50">
            {mint.title}
            <span className="mt-0.5 block font-normal text-ink-500">{mint.blurb}</span>
          </summary>
          <div className="border-t border-ink-200 p-3">
            <RequestPanel
              method="POST"
              path={`/allowances/${allowance.id}/credentials`}
              auth="proxy"
              defaultBody={mint.body}
              idempotency
              idempotencyNote="Payloads are returned exactly once. Resend with the SAME key and body → 409 CREDENTIAL_PAYLOAD_UNAVAILABLE (no re-mint). Same key, EDITED body → 409 IDEMPOTENCY_CONFLICT. Leave the key untouched and resend to see it — that replay is the teachable moment, not a bug."
              sendLabel="Mint"
              loadingLabel="Minting…"
              successToast={(result) => ({
                title: "Credential minted",
                id: (result as Credential).id,
              })}
              onSuccess={onMinted}
            />
          </div>
        </details>
      ))}

      {demos.length > 0 && (
        <details className="border border-ink-200 bg-white">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-ink-900 hover:bg-ink-50">
            Error demos — fail on purpose
            <span className="mt-0.5 block font-normal text-ink-500">
              Pre-built bodies that exercise the mint error paths. Each failure renders the full
              RFC 7807 problem in a toast and inline.
            </span>
          </summary>
          <div className="space-y-3 border-t border-ink-200 p-3">
            {demos.map((demo) => (
              <div key={demo.key}>
                <h4 className="mb-1 text-xs font-medium text-ink-900">{demo.title}</h4>
                <p className="mb-1.5 text-[11px] text-ink-500">{demo.blurb}</p>
                <RequestPanel
                  method="POST"
                  path={`/allowances/${allowance.id}/credentials`}
                  auth="proxy"
                  defaultBody={demo.body}
                  idempotency
                  sendLabel="Send (expected to fail)"
                />
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          small
          loading={listing}
          onClick={async () => {
            setListing(true);
            try {
              const result = await callAgentic<{ data: Record<string, unknown>[] }>(
                { method: "GET", path: `/allowances/${allowance.id}/credentials`, auth: "proxy" },
                logger,
              );
              setListed(result.data ?? []);
            } catch {
              // toast handled by inspector visibility; keep quiet here
            } finally {
              setListing(false);
            }
          }}
        >
          List credentials (metadata only)
        </Button>
      </div>
      {listed && (
        <div className="border border-ink-200 bg-white p-3 text-xs">
          {listed.length === 0 ? (
            <p className="text-ink-500">No credentials minted on this allowance yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {listed.map((item) => (
                <li key={String(item.id)} className="flex flex-wrap items-center gap-2">
                  <CopyChip value={String(item.id)} />
                  <span className="font-mono text-[11px] text-ink-600">
                    {String(item.format)} · {String((item.amount as { value?: string })?.value)}{" "}
                    {String((item.amount as { currency?: string })?.currency)} ·{" "}
                    {String(item.status)}
                  </span>
                  <Button
                    variant="ghost"
                    small
                    onClick={() =>
                      callAgentic(
                        {
                          method: "GET",
                          path: `/allowances/${allowance.id}/credentials/${String(item.id)}`,
                          auth: "proxy",
                        },
                        logger,
                      ).catch(() => {})
                    }
                  >
                    GET
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[11px] text-ink-500">
            Metadata only — the spendable values were returned once, at mint time, and never
            again.
          </p>
        </div>
      )}
    </div>
  );
}

export function AllowanceSummary({ allowance }: { allowance: Allowance }) {
  return (
    <div className="border border-ink-200 bg-white p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <CopyChip value={allowance.id} />
        <span className="text-[11px] text-ink-500">{allowance.status}</span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        {(
          [
            ["amount", allowance.amount],
            ["spent", allowance.amount_spent],
            ["reserved", allowance.amount_reserved],
            ["available", allowance.amount_available],
          ] as const
        ).map(([label, money]) => (
          <div key={label}>
            <dt className="text-[10px] tracking-wide text-ink-500 uppercase">{label}</dt>
            <dd className="font-mono text-ink-950">
              {money?.value ?? "—"} {money?.currency ?? ""}
            </dd>
          </div>
        ))}
      </dl>
      <div className="mt-2">
        <RailChips rails={allowance.rails} />
      </div>
    </div>
  );
}
