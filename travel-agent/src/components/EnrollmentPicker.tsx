"use client";

import { useEffect, useRef, useState } from "react";
import { useLoggedFetch } from "@/lib/apiLog";
import BrandLogo from "@/components/BrandLogo";
import type { Enrollment } from "@/lib/types";

interface Props {
  onPick: (enrollment: Enrollment) => void;
  onUseNewCard: () => void;
}

const WALLET_NAME = "SkyAgent";
const MAX_CARDS = 3;

export default function EnrollmentPicker({ onPick, onUseNewCard }: Props) {
  const loggedFetch = useLoggedFetch();
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fetched = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    (async () => {
      try {
        const res = await loggedFetch("/api/enrollments", {
          label: "GET /api/enrollments",
          step: "list-enrollments",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to list enrollments");
        setEnrollments(data.data || []);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to list enrollments"
        );
      }
    })();
  }, [loggedFetch]);

  if (error) {
    return (
      <div className="text-xs text-error bg-red-50 border border-red-200 rounded-lg p-3">
        {error}
      </div>
    );
  }

  if (enrollments === null) {
    return <div className="text-sm text-ink-500">Loading saved cards…</div>;
  }

  const usable = enrollments
    .filter(
      (e) =>
        e.wallet_name === WALLET_NAME &&
        (e.status === "active" || e.status === "pending_verification")
    )
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )
    .slice(0, MAX_CARDS);

  if (usable.length === 0) {
    return (
      <div className="bg-white border border-ink-200 p-4 space-y-3">
        <p className="text-sm text-ink-500">No cards found in the wallet.</p>
        <button
          onClick={onUseNewCard}
          className="w-full bg-ink-900 hover:bg-ink-700 text-white text-sm font-medium py-2"
        >
          Add new card
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {usable.map((enrollment) => {
        const isActive = enrollment.status === "active";
        return (
          <button
            key={enrollment.id}
            onClick={() => onPick(enrollment)}
            className="w-full text-left bg-white border border-ink-200 hover:border-ink-900 p-3 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <BrandLogo brand={enrollment.card.brand} height={22} />
              <div>
                <div className="font-mono text-sm text-ink-900">
                  •••• {enrollment.card.last4}
                </div>
                <div className="text-xs text-ink-500">
                  Exp {String(enrollment.card.expiration_month).padStart(2, "0")}/
                  {enrollment.card.expiration_year}
                </div>
              </div>
            </div>
            <span
              className={`text-[10px] uppercase tracking-wider font-medium px-2 py-1 border ${
                isActive
                  ? "bg-green-100 border-green-200 text-green-800"
                  : "bg-yellow-100 border-yellow-200 text-yellow-800"
              }`}
            >
              {isActive ? "Active" : "Verification required"}
            </span>
          </button>
        );
      })}
      <button
        onClick={onUseNewCard}
        className="text-sm text-ink-900 hover:text-ink-700 font-medium pt-1 underline underline-offset-2"
      >
        Add new card
      </button>
    </div>
  );
}
