"use client";

import { formatDate, formatTime, type FlightOption } from "@/lib/flights";
import type { Enrollment } from "@/lib/types";
import BrandLogo from "@/components/BrandLogo";

interface Props {
  flight: FlightOption;
  enrollment: Enrollment;
  confirmationCode: string;
  origin: { code: string; city: string };
  destination: { code: string; city: string };
}

function countdownLabel(departAt: string): string {
  const diffMs = new Date(departAt).getTime() - Date.now();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export default function BookingReceipt({
  flight,
  enrollment,
  confirmationCode,
  origin,
  destination,
}: Props) {
  const merchantHost = new URL(flight.bookingUrl).host;

  return (
    <div className="bg-white border border-ink-200 p-5 space-y-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display font-semibold text-base text-ink-900">
          Upcoming Trip
        </h3>
        <span className="text-[10px] uppercase tracking-wider bg-ink-100 text-ink-700 px-2 py-1 font-medium">
          {countdownLabel(flight.departAt)}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1px_auto] gap-5 sm:gap-6">
        <div className="space-y-3">
          <div className="flex items-center gap-3 font-display text-3xl font-semibold text-ink-900 tracking-tight leading-none">
            <span>{origin.code}</span>
            <svg
              className="w-5 h-5 text-ink-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={1.8}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
            <span>{destination.code}</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-ink-500">
            <span>{origin.city}</span>
            <span className="w-3 h-px bg-ink-300" />
            <span>{destination.city}</span>
          </div>
          <div className="pt-2">
            <div className="text-sm text-ink-900">
              {formatDate(flight.departAt)} · {formatTime(flight.departAt)}
            </div>
            <div className="text-xs text-ink-500">
              Flight {flight.flightNumber} · {flight.airline}
            </div>
          </div>
        </div>

        <div className="hidden sm:block bg-ink-200" />

        <div className="space-y-4 sm:min-w-[180px]">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-500 mb-1">
              Total
            </div>
            <div className="font-display text-2xl font-semibold text-ink-900">
              ${flight.price}{" "}
              <span className="text-sm text-ink-500 font-normal">USD</span>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-500 mb-1">
              Paid with
            </div>
            <div className="flex items-center gap-2">
              <BrandLogo brand={enrollment.card.brand} height={20} />
              <span className="font-mono text-sm text-ink-900">
                •••• {enrollment.card.last4}
              </span>
            </div>
            <div className="text-xs text-ink-500 mt-1">on {merchantHost}</div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-wider text-ink-500 mb-1">
              Confirmation
            </div>
            <code className="font-mono text-xs text-ink-900">
              {confirmationCode}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
