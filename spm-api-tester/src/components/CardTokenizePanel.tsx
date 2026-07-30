"use client";

// Card collection with Basis Theory Elements. Two tabs, ONE tokenize path:
//
//   "Your Card"  — an empty CardElement. Card data goes from the browser
//                  straight to the vault; it genuinely never touches this
//                  app's server.
//   "Mock Cards" — the scenario picker prefills the SAME CardElement via the
//                  v2 static `value` option (remounted per selection). If
//                  Elements can't tokenize the prefill in this browser, the
//                  app falls back to a raw browser POST /tokens with the
//                  public key — and says so.
//
// NOTE: programmatic card values are a v2-only Elements capability — the
// `value`/`setValue` surface is removed in 3.x (reveal is not being ported).
// A future v3 upgrade forces the mock path back to raw POST /tokens.

import { useMemo, useRef, useState } from "react";
import { CardElement, useBasisTheory } from "@basis-theory/react-elements";
import type { ICardElement } from "@basis-theory/react-elements";
import { CARD_SCENARIOS, DEFAULT_SCENARIO_NOTE, type CardScenario } from "@/lib/scenarios";
import { useApiLog } from "@/lib/apiLog";
import { useSession } from "@/lib/session";
import { useToast } from "@/lib/toast";
import { useAppConfig } from "@/lib/config";
import { PUBLIC_KEY, VAULT_API_URL } from "@/lib/env";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";

const MOCK_EXPIRATION = { month: 12, year: 2030 };
const MOCK_CVC = "123";

// Hex literals, not CSS custom properties: the CardElement renders inside a
// cross-origin Elements iframe that cannot read this page's variables. The
// values mirror the customer-portal foreground / muted / danger colors.
const ELEMENT_BASE_STYLE = {
  fontSize: "16px",
  lineHeight: "24px",
  color: "#e4e4e7",
  backgroundColor: "#17171a",
  fontFamily: "Inter, system-ui, sans-serif",
  padding: "11px 12px",
  "::placeholder": { color: "#717179" },
  ":read-only": {
    color: "#e4e4e7",
    backgroundColor: "#17171a",
  },
  ":disabled": {
    color: "#a1a1aa",
    backgroundColor: "#17171a",
  },
};

const ELEMENT_STYLE = {
  container: {
    backgroundColor: "#17171a",
  },
  base: {
    ...ELEMENT_BASE_STYLE,
  },
  empty: {
    ...ELEMENT_BASE_STYLE,
  },
  complete: {
    ...ELEMENT_BASE_STYLE,
  },
  invalid: {
    ...ELEMENT_BASE_STYLE,
    color: "#fda4af",
    ":read-only": {
      color: "#fda4af",
      backgroundColor: "#17171a",
    },
  },
};

export function CardTokenizePanel({ onTokenized }: { onTokenized?: (tokenId: string) => void }) {
  const { bt } = useBasisTheory();
  const { config } = useAppConfig();
  const { dispatch } = useSession();
  const { log, update } = useApiLog();
  const toast = useToast();

  // Only an explicit test-tenant declaration enables mock defaults. Missing
  // config fails closed to production behavior.
  const isTest = config?.tenantType === "test";
  const isProduction = !isTest;
  const [tab, setTab] = useState<"mock" | "yours">(isTest ? "mock" : "yours");
  const [selected, setSelected] = useState<CardScenario | null>(isTest ? CARD_SCENARIOS[0] : null);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedRawFallback, setUsedRawFallback] = useState(false);
  const cardRef = useRef<ICardElement | null>(null);

  const mockValue = useMemo(
    () =>
      selected
        ? {
            number: selected.pan,
            expiration_month: MOCK_EXPIRATION.month,
            expiration_year: MOCK_EXPIRATION.year,
            cvc: MOCK_CVC,
          }
        : null,
    [selected],
  );

  const registerToken = (tokenId: string, via: "elements" | "raw") => {
    const scenario = tab === "mock" ? selected : null;
    dispatch({
      type: "addToken",
      token: {
        id: tokenId,
        via,
        scenarioPan: scenario?.pan,
        brand: scenario?.brand,
        last4: scenario?.pan.slice(-4),
        createdAt: Date.now(),
      },
    });
    toast.success("Card token created", { label: tokenId, value: tokenId });
    onTokenized?.(tokenId);
  };

  const tokenizeWithElements = async () => {
    if (!bt || !cardRef.current) throw new Error("Elements is still initializing");
    const started = Date.now();
    try {
      const token = await bt.tokens.create({ type: "card", data: cardRef.current });
      if (!token?.id) throw new Error("Tokenization returned no id");
      log({
        source: "elements",
        label: "bt.tokens.create({ type: 'card' })",
        status: 201,
        ok: true,
        response: { id: token.id, type: token.type },
        duration_ms: Date.now() - started,
      });
      return token.id;
    } catch (err) {
      log({
        source: "elements",
        label: "bt.tokens.create({ type: 'card' })",
        ok: false,
        response: { error: err instanceof Error ? err.message : "tokenize failed" },
        duration_ms: Date.now() - started,
      });
      throw err;
    }
  };

  const tokenizeRaw = async () => {
    if (!selected || !mockValue) throw new Error("Choose a mock scenario first");
    const body = { type: "card", data: mockValue };
    const url = `${VAULT_API_URL}/tokens`;
    const started = Date.now();
    const entryId = log({
      source: "browser",
      label: "POST /tokens",
      method: "POST",
      url,
      request: { type: "card", data: { ...mockValue, number: `${selected.pan.slice(0, 6)}…` } },
      pending: true,
    });
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "BT-API-KEY": PUBLIC_KEY },
      body: JSON.stringify(body),
    });
    const json = await response.json().catch(() => null);
    // Never log the full PAN or the token's card data payload.
    update(entryId, {
      pending: false,
      ok: response.ok,
      status: response.status,
      response: response.ok ? { id: json?.id, type: "card" } : { status: response.status },
      duration_ms: Date.now() - started,
    });
    if (!response.ok) {
      throw new Error(json?.title || json?.detail || `Tokenize failed (HTTP ${response.status})`);
    }
    return json.id as string;
  };

  const submit = async () => {
    setError(null);
    if (tab === "mock" && (!selected || !mockValue)) {
      setError("Choose a mock scenario before tokenizing.");
      return;
    }
    setLoading(true);
    setUsedRawFallback(false);
    try {
      if (tab === "yours") {
        registerToken(await tokenizeWithElements(), "elements");
      } else {
        try {
          const id = await tokenizeWithElements();
          registerToken(id, "elements");
        } catch {
          // Elements could not tokenize the programmatic prefill in this
          // browser — mock PANs fall back to the raw vault API, honestly.
          const id = await tokenizeRaw();
          setUsedRawFallback(true);
          registerToken(id, "raw");
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to tokenize card");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!bt && (tab === "mock" ? !!selected : complete) && !loading;

  return (
    <div className="surface-shadow overflow-hidden rounded-xl border border-ink-200 bg-surface">
      <div
        role="tablist"
        aria-label="Card source"
        className="flex gap-1 border-b border-ink-200 bg-ink-50 px-3 pt-2"
      >
        {(
          [
            ["mock", "Mock Cards"],
            ["yours", "Your Card"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setComplete(false);
            }}
            className={`rounded-b-none px-4 py-3 text-sm font-semibold transition-colors ${
              tab === id
                ? "border-b-2 border-accent bg-surface text-accent"
                : "text-ink-500 hover:bg-surface/60 hover:text-ink-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {tab === "mock" && isProduction && (
          <Callout tone="warning" title="Production tenant">
            These PANs only trigger scenarios on test tenants. On this tenant they are treated as
            real card numbers — verification challenges go to real cardholders. Use “Your Card”
            unless you know what you are doing.
          </Callout>
        )}

        {tab === "mock" && (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              {CARD_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.pan}
                  onClick={() => setSelected(scenario)}
                  aria-pressed={selected?.pan === scenario.pan}
                  className={`rounded-xl border p-3.5 text-left text-sm transition-colors ${
                    selected?.pan === scenario.pan
                      ? "border-accent/60 bg-accent-soft"
                      : "border-ink-200 bg-ink-50/50 hover:border-ink-300 hover:bg-ink-50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                        scenario.tone === "success"
                          ? "border-success-border bg-success-soft text-success"
                          : scenario.tone === "warning"
                            ? "border-warning-border bg-warning-soft text-warning"
                            : "border-error-border bg-error-soft text-error"
                      }`}
                    >
                      {scenario.badge}
                    </span>
                    <span className="text-[11px] tracking-wide text-ink-400 uppercase">
                      {scenario.brand}
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-sm font-semibold text-ink-950">
                    {scenario.pan.replace(/(\d{4})/g, "$1 ").trim()}
                  </div>
                  <div className="mt-1.5 leading-relaxed text-ink-600">{scenario.description}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-500">{DEFAULT_SCENARIO_NOTE}</p>
          </>
        )}

        <div>
          <label className="mb-1.5 block text-xs font-medium tracking-wide text-ink-500 uppercase">
            Card
          </label>
          <div className="flex min-h-14 items-center overflow-hidden rounded-xl border border-ink-300 bg-surface-raised p-1 transition-colors focus-within:border-accent [&>*]:w-full">
            {!bt ? (
              <p className="px-3 py-2 text-sm text-ink-500">Loading secure card field…</p>
            ) : tab === "mock" && selected && mockValue ? (
              // Remount per selection so the v2 static `value` option applies
              // at element creation — the most reliable prefill path.
              <CardElement
                key={selected.pan}
                id="card-element-mock"
                bt={bt}
                ref={cardRef}
                value={mockValue}
                readOnly
                iconPosition="none"
                style={ELEMENT_STYLE}
              />
            ) : tab === "yours" ? (
              <CardElement
                id="card-element"
                bt={bt}
                ref={cardRef}
                onChange={(e) => setComplete(!!e?.complete)}
                iconPosition="none"
                style={ELEMENT_STYLE}
              />
            ) : (
              <p className="py-1 text-xs text-ink-500">
                Choose a scenario above to load its test card.
              </p>
            )}
          </div>
        </div>

        {tab === "yours" && (
          <Callout>
            This form is a Basis Theory Elements component: the card data goes from the browser
            directly to the vault with the public key. It never touches this app’s server — for this
            path, that claim is literally true.
          </Callout>
        )}

        {usedRawFallback && (
          <Callout tone="warning">
            Elements could not tokenize the programmatic prefill in this browser, so this mock PAN
            was tokenized with a raw browser <code>POST /tokens</code> instead (public key, still
            browser → vault). Real cards always use Elements.
          </Callout>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-lg border border-error-border bg-error-soft p-3 text-xs text-error"
          >
            {error}
          </div>
        )}

        <Button onClick={submit} disabled={!canSubmit} loading={loading} loadingLabel="Tokenizing…">
          Tokenize Card
        </Button>
      </div>
    </div>
  );
}
