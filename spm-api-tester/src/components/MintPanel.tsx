"use client";

// Credential minting for one allowance: every format the active rails
// support, plus the on-purpose failure demos (idempotency replay, overdraw,
// currency mismatch, MPP validation errors). Mint success renders the
// credential reveal card — values are returned exactly once.

import { useCallback, useMemo, useState } from "react";
import type { Allowance, Credential, CredentialFormat, Rail } from "@/lib/types";
import { callAgentic } from "@/lib/agenticClient";
import { useApiLog } from "@/lib/apiLog";
import { useSession, type AllowanceEntry } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { base64UrlJson, EXAMPLE_MPP_CARD_ENCRYPTION_JWK } from "@/lib/mpp";
import { RequestPanel } from "@/components/RequestPanel";
import { ScenarioChip } from "@/components/ScenarioChip";
import { CredentialRevealCard } from "@/components/CredentialRevealCard";
import { Callout } from "@/components/ui/Callout";
import { Button } from "@/components/ui/Button";
import { CopyChip } from "@/components/ui/CopyChip";
import { RailChips, StatusPill } from "@/components/ui/StatusPill";

interface MintDef {
  key: string;
  title: string;
  /** What this credential format is for — one line. */
  blurb: string;
  body: unknown;
}

function supports(rail: Rail | undefined, format: CredentialFormat): boolean {
  return rail?.credential_formats?.includes(format) ?? false;
}

export function mintsFor(allowance: Allowance, challengeExpires: string): MintDef[] {
  const currency = allowance.amount?.currency ?? "USD";
  const agentic = allowance.rails?.find((r) => r.rail === "agentic-token");
  const spt = allowance.rails?.find((r) => r.rail === "spt");
  const mints: MintDef[] = [];

  if (agentic?.provider && agentic.status === "active") {
    const provider = agentic.provider;
    const network = provider === "vic" ? "visa" : "mastercard";
    const definitions: Array<[CredentialFormat, MintDef]> = [
      [
        "card",
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
      ],
      [
        "network-token",
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
      ],
      [
        "mpp",
        {
          key: "agentic-mpp",
          title: `${provider === "vic" ? "Visa" : "Mastercard"} MPP Card Credential`,
          blurb:
            "A complete Machine Payments Protocol credential (method card) for an HTTP Authorization: Payment header.",
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
                  expires: challengeExpires,
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
      ],
    ];
    mints.push(
      ...definitions
        .filter(([format]) => supports(agentic, format))
        .map(([, definition]) => definition),
    );
  }

  if (spt?.status === "active") {
    const definitions: Array<[CredentialFormat, MintDef]> = [
      [
        "identifier",
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
      ],
      [
        "mpp",
        {
          key: "spt-mpp",
          title: "Stripe MPP Authorization Credential",
          blurb:
            "An MPP credential wrapping the SPT (method stripe) for Authorization: Payment headers.",
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
                  expires: challengeExpires,
                },
              },
            },
          },
        },
      ],
    ];
    mints.push(
      ...definitions
        .filter(([format]) => supports(spt, format))
        .map(([, definition]) => definition),
    );
  }

  return mints;
}

export function errorDemosFor(allowance: Allowance, challengeExpires: string): MintDef[] {
  const currency = allowance.amount?.currency ?? "USD";
  const agentic = allowance.rails?.find((r) => r.rail === "agentic-token");
  const spt = allowance.rails?.find((r) => r.rail === "spt");
  const railForAmountDemos =
    spt?.status === "active" && supports(spt, "identifier")
      ? {
          rail: "spt",
          provider: "stripe",
          format: { format: "identifier", payload: { network_business_profile: "np_example" } },
        }
      : agentic?.status === "active" && agentic.provider && supports(agentic, "card")
        ? { rail: "agentic-token", provider: agentic.provider, format: { format: "card" } }
        : null;

  const overdrawValue = (
    Number(allowance.amount_available?.value ?? allowance.amount?.value ?? "0") + 10
  ).toFixed(2);
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

  if (agentic?.provider && agentic.status === "active" && supports(agentic, "mpp")) {
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
      expires: challengeExpires,
    });
    demos.push(
      {
        key: "demo-mpp-billing",
        title: "MPP: billingRequired without billing_address → 400",
        blurb:
          "The card challenge demands a billing address, but the payload omits it — watch the per-field errors in the toast.",
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
  const toast = useToast();
  const [revealed, setRevealed] = useState<Credential[]>([]);
  const [listing, setListing] = useState(false);
  const [listed, setListed] = useState<Record<string, unknown>[] | null>(null);
  const [selectedMintKey, setSelectedMintKey] = useState<string | null>(null);
  const [selectedDemoKey, setSelectedDemoKey] = useState<string | null>(null);

  const refreshAllowance = useCallback(async () => {
    try {
      const fresh = await callAgentic<Allowance>(
        { method: "GET", path: `/allowances/${allowance.id}`, auth: "proxy" },
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

  // The challenge expiry is fixed once per mount so mint bodies stay
  // byte-identical across re-renders — replaying a key with the SAME body is
  // the demo, and a drifting expires would turn it into IDEMPOTENCY_CONFLICT.
  const [challengeExpires] = useState(() => new Date(Date.now() + 30 * 60 * 1000).toISOString());
  const mints = useMemo(() => mintsFor(allowance, challengeExpires), [allowance, challengeExpires]);
  const demos = useMemo(
    () => errorDemosFor(allowance, challengeExpires),
    [allowance, challengeExpires],
  );
  const selectedMint = mints.find((mint) => mint.key === selectedMintKey) ?? mints[0];
  const selectedDemo = demos.find((demo) => demo.key === selectedDemoKey) ?? demos[0];

  return (
    <div className="space-y-3">
      <AllowanceSummary allowance={allowance} />
      <ScenarioChip scenarioPan={scenarioPan} stage="credentials" />

      {revealed.length > 0 && (
        <section
          aria-labelledby="created-credentials-heading"
          className="space-y-3 rounded-xl border border-accent/25 bg-surface p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold tracking-wide text-accent uppercase">
                Output
              </p>
              <h3 id="created-credentials-heading" className="mt-0.5 text-base font-medium">
                Created credentials
              </h3>
            </div>
            <span className="rounded-md bg-accent-soft px-2 py-1 text-xs text-accent">
              {revealed.length}
            </span>
          </div>
          <div className="space-y-2">
            {revealed.map((credential, index) => (
              <CredentialRevealCard
                key={credential.id}
                credential={credential}
                defaultOpen={index === 0}
              />
            ))}
          </div>
        </section>
      )}

      <section
        aria-labelledby="credential-requests-heading"
        className="overflow-hidden rounded-xl border border-ink-200 bg-surface"
      >
        <div className="border-b border-ink-200 bg-ink-50/45 px-3 py-2.5">
          <p className="text-[11px] font-semibold tracking-wide text-ink-500 uppercase">Action</p>
          <h3 id="credential-requests-heading" className="mt-0.5 text-base font-medium">
            Mint a credential
          </h3>
        </div>

        <div className="space-y-3 p-3">
          {!selectedMint ? (
            <Callout tone="warning">
              No rail can mint right now. Verify the agentic-token rail first.
            </Callout>
          ) : (
            <>
              <label className="block text-xs font-medium text-ink-700">
                Credential format
                <select
                  value={selectedMint.key}
                  onChange={(event) => setSelectedMintKey(event.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-ink-300 bg-ink-50 px-3 py-2.5 text-sm text-ink-900 focus:border-accent focus:outline-none"
                >
                  {mints.map((mint) => (
                    <option key={mint.key} value={mint.key}>
                      {mint.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-ink-600">{selectedMint.blurb}</p>
              <RequestPanel
                key={selectedMint.key}
                method="POST"
                path={`/allowances/${allowance.id}/credentials`}
                auth="proxy"
                defaultBody={selectedMint.body}
                idempotency
                idempotencyNote="A successful mint generates a fresh key. Replay the last key to test the one-time payload response."
                sendLabel="Mint credential"
                loadingLabel="Minting…"
                successToast={(result) => ({
                  title: "Credential minted",
                  id: (result as Credential).id,
                })}
                onSuccess={onMinted}
                onError={() => {
                  // Unknown provider outcomes commit spend even though the
                  // request throws. Refresh on every mint error; conclusive
                  // failures simply confirm the unchanged/released balance.
                  void refreshAllowance();
                }}
              />
            </>
          )}
        </div>
      </section>

      <details className="group overflow-hidden rounded-xl border border-ink-200 bg-surface">
        <summary className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium">
          Advanced testing &amp; metadata
          <span className="text-ink-400 transition-transform group-open:rotate-90">›</span>
        </summary>
        <div className="space-y-4 border-t border-ink-200 bg-screen/20 p-3">
          {selectedDemo && (
            <section className="space-y-2.5">
              <h4 className="text-sm font-medium">Failure demo</h4>
              <label className="block text-xs font-medium text-ink-700">
                Scenario
                <select
                  value={selectedDemo.key}
                  onChange={(event) => setSelectedDemoKey(event.target.value)}
                  className="mt-1.5 block w-full rounded-lg border border-ink-300 bg-ink-50 px-3 py-2.5 text-sm text-ink-900 focus:border-accent focus:outline-none"
                >
                  {demos.map((demo) => (
                    <option key={demo.key} value={demo.key}>
                      {demo.title}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm text-ink-600">{selectedDemo.blurb}</p>
              <RequestPanel
                key={selectedDemo.key}
                method="POST"
                path={`/allowances/${allowance.id}/credentials`}
                auth="proxy"
                defaultBody={selectedDemo.body}
                idempotency
                sendLabel="Send expected failure"
                onError={() => {
                  void refreshAllowance();
                }}
              />
            </section>
          )}

          <Callout tone="warning" title="Unknown provider outcome">
            <code>CREDENTIAL_OUTCOME_UNKNOWN</code> commits the spend. Replaying its idempotency key
            returns the same terminal error; there is no reconcile or release endpoint.
          </Callout>

          <section
            aria-labelledby="credential-records-heading"
            className="space-y-2.5 border-t border-ink-200 pt-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 id="credential-records-heading" className="text-sm font-medium">
                  Credential records
                </h4>
                <p className="text-xs text-ink-500">
                  Metadata only; spendable values are not returned.
                </p>
              </div>
              <Button
                variant="ghost"
                small
                loading={listing}
                onClick={async () => {
                  setListing(true);
                  try {
                    const result = await callAgentic<{ data: Record<string, unknown>[] }>(
                      {
                        method: "GET",
                        path: `/allowances/${allowance.id}/credentials`,
                        auth: "proxy",
                      },
                      logger,
                    );
                    setListed(result.data ?? []);
                  } catch (error) {
                    toast.error(error);
                  } finally {
                    setListing(false);
                  }
                }}
              >
                List metadata
              </Button>
            </div>
            {listed && (
              <div className="rounded-lg border border-ink-200 bg-ink-50/35 p-2.5 text-xs">
                {listed.length === 0 ? (
                  <p className="text-ink-500">No credentials minted yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {listed.map((item) => (
                      <li key={String(item.id)} className="flex flex-wrap items-center gap-2">
                        <CopyChip value={String(item.id)} />
                        <span className="font-mono text-xs text-ink-600">
                          {String(item.format)} ·{" "}
                          {String((item.amount as { value?: string })?.value)}{" "}
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
              </div>
            )}
          </section>
        </div>
      </details>
    </div>
  );
}

export function AllowanceSummary({ allowance }: { allowance: Allowance }) {
  return (
    <div className="space-y-2 rounded-lg border border-ink-200 bg-surface p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-medium tracking-wide text-ink-500 uppercase">
          Allowance
        </span>
        <CopyChip value={allowance.id} />
        <span className="ml-auto">
          <StatusPill status={allowance.status ?? "unknown"} />
        </span>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-y divide-ink-200 overflow-hidden rounded-md border border-ink-200 text-xs sm:grid-cols-4 sm:divide-y-0">
        {(
          [
            ["amount", allowance.amount],
            ["spent", allowance.amount_spent],
            ["reserved", allowance.amount_reserved],
            ["available", allowance.amount_available],
          ] as const
        ).map(([label, money]) => (
          <div key={label} className="flex items-baseline justify-between gap-2 px-2 py-1.5">
            <dt className="text-[10px] tracking-wide text-ink-500 uppercase">{label}</dt>
            <dd className="font-mono text-xs text-ink-950">
              {money?.value ?? "—"} {money?.currency ?? ""}
            </dd>
          </div>
        ))}
      </dl>

      {(allowance.rails?.length ?? 0) > 0 && (
        <div className="flex flex-wrap items-start gap-2">
          <span className="pt-1 text-[11px] font-medium tracking-wide text-ink-500 uppercase">
            Rails
          </span>
          <RailChips rails={allowance.rails} />
        </div>
      )}
    </div>
  );
}
