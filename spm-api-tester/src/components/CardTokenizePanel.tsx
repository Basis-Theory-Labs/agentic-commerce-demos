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
// values mirror --mono-950 / --mono-400 / --error.
const ELEMENT_STYLE = {
  base: {
    fontSize: "13px",
    color: "#0a0a0a",
    fontFamily: "Inter, system-ui, sans-serif",
    "::placeholder": { color: "#a1a1aa" },
  },
  invalid: { color: "#dc2626" },
};

export function CardTokenizePanel({ onTokenized }: { onTokenized?: (tokenId: string) => void }) {
  const { bt } = useBasisTheory();
  const { config } = useAppConfig();
  const { dispatch } = useSession();
  const { log, update } = useApiLog();
  const toast = useToast();

  const isProduction = config?.tenantType === "production";
  const [tab, setTab] = useState<"mock" | "yours">(isProduction ? "yours" : "mock");
  const [selected, setSelected] = useState<CardScenario>(CARD_SCENARIOS[0]);
  const [complete, setComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedRawFallback, setUsedRawFallback] = useState(false);
  const cardRef = useRef<ICardElement | null>(null);

  const mockValue = useMemo(
    () => ({
      number: selected.pan,
      expiration_month: MOCK_EXPIRATION.month,
      expiration_year: MOCK_EXPIRATION.year,
      cvc: MOCK_CVC,
    }),
    [selected],
  );

  const registerToken = (tokenId: string, via: "elements" | "raw") => {
    dispatch({
      type: "addToken",
      token: {
        id: tokenId,
        via,
        scenarioPan: tab === "mock" ? selected.pan : undefined,
        brand: tab === "mock" ? selected.brand : undefined,
        last4: tab === "mock" ? selected.pan.slice(-4) : undefined,
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

  const canSubmit = !!bt && (tab === "mock" || complete) && !loading;

  return (
    <div className="border border-ink-200 bg-white">
      <div role="tablist" aria-label="Card source" className="flex border-b border-ink-200">
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
            className={`px-4 py-2 text-xs font-medium ${
              tab === id
                ? "border-b-2 border-ink-900 text-ink-950"
                : "text-ink-500 hover:text-ink-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-4">
        {tab === "mock" && isProduction && (
          <Callout tone="warning" title="Production tenant">
            These PANs only trigger scenarios on test tenants. On this tenant they are treated as
            real card numbers — verification challenges go to real cardholders. Use “Your Card”
            unless you know what you are doing.
          </Callout>
        )}

        {tab === "mock" && (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              {CARD_SCENARIOS.map((scenario) => (
                <button
                  key={scenario.pan}
                  onClick={() => setSelected(scenario)}
                  aria-pressed={selected.pan === scenario.pan}
                  className={`border p-2.5 text-left text-xs ${
                    selected.pan === scenario.pan
                      ? "border-ink-900 bg-ink-50"
                      : "border-ink-200 bg-white hover:border-ink-400"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`border px-1.5 py-0.5 text-[10px] font-medium ${
                        scenario.tone === "success"
                          ? "border-success-border bg-success-soft text-success"
                          : scenario.tone === "warning"
                            ? "border-warning-border bg-warning-soft text-warning"
                            : "border-error-border bg-error-soft text-error"
                      }`}
                    >
                      {scenario.badge}
                    </span>
                    <span className="text-[10px] tracking-wide text-ink-400 uppercase">
                      {scenario.brand}
                    </span>
                  </div>
                  <div className="mt-1.5 font-mono text-[13px] text-ink-950">
                    {scenario.pan.replace(/(\d{4})/g, "$1 ").trim()}
                  </div>
                  <div className="mt-1 text-ink-600">{scenario.description}</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-ink-500">{DEFAULT_SCENARIO_NOTE}</p>
          </>
        )}

        <div>
          <label className="mb-1 block text-[11px] tracking-wide text-ink-500 uppercase">
            Card
          </label>
          <div className="border border-ink-300 bg-white px-2.5 py-1.5">
            {tab === "mock" ? (
              // Remount per selection so the v2 static `value` option applies
              // at element creation — the most reliable prefill path.
              <CardElement
                key={selected.pan}
                id="card-element-mock"
                bt={bt}
                ref={cardRef}
                value={mockValue}
                readOnly
                style={ELEMENT_STYLE}
              />
            ) : (
              <CardElement
                id="card-element"
                bt={bt}
                ref={cardRef}
                onChange={(e) => setComplete(!!e?.complete)}
                style={ELEMENT_STYLE}
              />
            )}
          </div>
        </div>

        {tab === "yours" && (
          <Callout>
            This form is a Basis Theory Elements component: the card data goes from the browser
            directly to the vault with the public key. It never touches this app’s server — for
            this path, that claim is literally true.
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
          <div role="alert" className="border border-error-border bg-error-soft p-2 text-xs text-error">
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
