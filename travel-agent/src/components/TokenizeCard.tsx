"use client";

import { useRef, useState } from "react";
import { CardElement, useBasisTheory } from "@basis-theory/react-elements";
import type { ICardElement } from "@basis-theory/react-elements";
import { useApiLog } from "@/lib/apiLog";

export interface TokenizedCard {
  tokenId: string;
  email: string;
}

interface Props {
  onTokenized: (card: TokenizedCard) => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Collects an email + card details, then creates a token via Basis Theory
// Elements. The card number never enters this component's DOM — Elements
// handles all input + tokenization inside sandboxed iframes.
export default function TokenizeCard({ onTokenized }: Props) {
  const { bt } = useBasisTheory();
  const cardRef = useRef<ICardElement | null>(null);

  const [email, setEmail] = useState("");
  const [cardComplete, setCardComplete] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { log } = useApiLog();

  const emailValid = EMAIL_RE.test(email.trim());
  const canSubmit = !!bt && emailValid && cardComplete && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bt || !cardRef.current) {
      setError("Elements is still initializing");
      return;
    }
    if (!emailValid) {
      setError("Enter a valid email address");
      return;
    }
    setLoading(true);
    setError(null);

    const start = Date.now();
    try {
      const token = await bt.tokens.create({
        type: "card",
        data: cardRef.current,
      });
      if (!token?.id) throw new Error("Tokenization returned no id");

      log({
        source: "elements",
        label: "bt.tokens.create({ type: 'card' })",
        status: 201,
        ok: true,
        response: { id: token.id, type: token.type, fingerprint: token.fingerprint },
        duration_ms: Date.now() - start,
        step: "tokenize",
      });

      onTokenized({ tokenId: token.id, email: email.trim() });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to tokenize card";
      log({
        source: "elements",
        label: "bt.tokens.create({ type: 'card' })",
        ok: false,
        response: { error: message },
        duration_ms: Date.now() - start,
        step: "tokenize",
      });
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-ink-200 p-3 space-y-2.5">
      <form onSubmit={handleSubmit} className="space-y-2.5">
        <div>
          <label
            htmlFor="consumer-email"
            className="block text-[11px] uppercase tracking-wide text-ink-500 mb-1"
          >
            Email
          </label>
          <input
            id="consumer-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full border border-ink-300 px-2.5 py-1.5 text-sm focus:outline-none focus:border-ink-900 bg-white"
            required
          />
        </div>

        <div>
          <label className="block text-[11px] uppercase tracking-wide text-ink-500 mb-1">
            Card
          </label>
          <div className="border border-ink-300 px-2.5 py-1.5 bg-white">
            <CardElement
              id="card-element"
              bt={bt}
              ref={cardRef}
              onChange={(e) => setCardComplete(!!e?.complete)}
              style={{
                base: {
                  fontSize: "13px",
                  color: "#0a0a0a",
                  fontFamily: "Inter, system-ui, sans-serif",
                  "::placeholder": { color: "#a1a1aa" },
                },
                invalid: { color: "#dc2626" },
              }}
            />
          </div>
        </div>

        {error && (
          <div className="text-xs text-error bg-red-50 border border-red-200 p-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-ink-900 hover:bg-ink-700 disabled:opacity-50 text-white text-sm font-medium py-2"
        >
          {loading ? "Saving…" : "Save Card"}
        </button>
      </form>
    </div>
  );
}
