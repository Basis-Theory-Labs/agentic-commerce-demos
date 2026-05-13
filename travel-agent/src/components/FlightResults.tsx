"use client";

import { FlightOption, formatDate, formatDuration, formatTime } from "@/lib/flights";

interface Props {
  flights: FlightOption[];
  onSelect: (flight: FlightOption) => void;
  selectedId?: string;
}

export default function FlightResults({ flights, onSelect, selectedId }: Props) {
  const cheapest = Math.min(...flights.map((f) => f.price));

  return (
    <div className="space-y-2">
      {flights.map((flight) => {
        const isSelected = flight.id === selectedId;
        const isCheapest = flight.price === cheapest;
        return (
          <button
            key={flight.id}
            onClick={() => onSelect(flight)}
            disabled={!!selectedId && !isSelected}
            className={`w-full text-left bg-white border rounded-xl p-4 transition-all ${
              isSelected
                ? "border-sky-500 ring-2 ring-sky-500/30"
                : selectedId
                  ? "border-ink-100 opacity-60"
                  : "border-ink-100 hover:border-sky-500 hover:shadow-md"
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-ink-50 text-ink-700 grid place-items-center font-mono text-xs font-bold shrink-0">
                  {flight.airlineCode}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-ink-900 truncate">
                    {flight.airline}
                  </div>
                  <div className="text-xs text-ink-500">
                    {flight.flightNumber} · {formatDate(flight.departAt)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="font-mono text-sm text-ink-900">
                    {formatTime(flight.departAt)} → {formatTime(flight.arriveAt)}
                  </div>
                  <div className="text-xs text-ink-500">
                    {formatDuration(flight.durationMinutes)}{" "}
                    · {flight.stops === 0 ? "Direct" : `${flight.stops} stop`}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-bold text-lg text-ink-900">
                    ${flight.price}
                  </div>
                  {isCheapest && (
                    <div className="text-[10px] uppercase tracking-wider text-green-700 font-semibold">
                      Best price
                    </div>
                  )}
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
