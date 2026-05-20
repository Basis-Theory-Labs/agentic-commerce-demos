"use client";

import { useEffect, useState } from "react";
import type { Credentials } from "@/lib/types";
import type { FlightOption } from "@/lib/flights";

interface Props {
  flight: FlightOption;
  credentials: Credentials;
  onComplete: (transactionRef: string) => void;
}

type Stage = "filling" | "submitting" | "approved";

const TYPE_INTERVAL_MS = 80;
const SUBMIT_DELAY_MS = 700;
const APPROVE_DELAY_MS = 3000;
const COMPLETE_DELAY_MS = 1500;

export default function AirlineCheckout({ flight, credentials, onComplete }: Props) {
  const [stage, setStage] = useState<Stage>("filling");
  const [typed, setTyped] = useState({ number: "", expiry: "", cvc: "" });

  useEffect(() => {
    const number = credentials.card.number;
    const expiry = `${String(credentials.card.expiration_month).padStart(2, "0")}/${String(credentials.card.expiration_year).slice(-2)}`;
    const cvc = credentials.card.cvc;

    let i = 0;
    const interval = setInterval(() => {
      i++;
      setTyped({
        number: number.slice(0, i),
        expiry: i > number.length ? expiry.slice(0, i - number.length) : "",
        cvc:
          i > number.length + expiry.length
            ? cvc.slice(0, i - number.length - expiry.length)
            : "",
      });
      if (i >= number.length + expiry.length + cvc.length) {
        clearInterval(interval);
        setTimeout(() => setStage("submitting"), SUBMIT_DELAY_MS);
      }
    }, TYPE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [credentials]);

  useEffect(() => {
    if (stage !== "submitting") return;
    const t = setTimeout(() => setStage("approved"), APPROVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [stage]);

  useEffect(() => {
    if (stage !== "approved") return;
    const ref = `${flight.airlineCode}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const t = setTimeout(() => onComplete(ref), COMPLETE_DELAY_MS);
    return () => clearTimeout(t);
  }, [stage, flight.airlineCode, onComplete]);

  const host = new URL(flight.bookingUrl).host;

  return (
    <div className="bg-ink-900 rounded-xl overflow-hidden border border-ink-900">
      <div className="px-3 py-2 bg-ink-700 text-xs font-mono flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-ink-500" />
        <span className="w-2.5 h-2.5 rounded-full bg-ink-500" />
        <span className="w-2.5 h-2.5 rounded-full bg-ink-500" />
        <span className="ml-2 text-ink-300">{host}/checkout</span>
      </div>
      <div className="p-5 space-y-4 bg-white text-ink-900">
        <div>
          <div className="text-xs text-ink-500 uppercase tracking-wide">Booking</div>
          <div className="font-medium">
            {flight.airline} {flight.flightNumber} · ${flight.price}.00
          </div>
        </div>

        <div className="space-y-3">
          <Field label="Card number" value={typed.number || "—"} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Expiry" value={typed.expiry || "—"} />
            <Field label="CVC" value={typed.cvc || "—"} />
          </div>
        </div>

        <button
          disabled
          className="w-full py-2.5 rounded-lg text-sm font-medium bg-ink-900 text-white"
        >
          {stage === "filling" && "Agent is filling card details…"}
          {stage === "submitting" && "Authorizing payment…"}
          {stage === "approved" && `✓ Booking confirmed for $${flight.price}.00`}
        </button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-ink-500 mb-1">
        {label}
      </div>
      <div className="font-mono text-sm border border-ink-200 rounded-lg px-3 py-2 bg-ink-50 text-ink-900">
        {value}
        <span className="inline-block w-1.5 h-3.5 bg-ink-900 ml-0.5 align-middle animate-pulse" />
      </div>
    </div>
  );
}
