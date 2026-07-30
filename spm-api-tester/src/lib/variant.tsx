"use client";

// SDK verification is the default product path. The Manual raw-API teaching
// path is exposed only when NEXT_PUBLIC_ENABLE_MANUAL_VERIFICATION=true.
// An enabled choice persists across pages.

import { useSyncExternalStore } from "react";
import { MANUAL_VERIFICATION_ENABLED } from "@/lib/env";

export type FlowVariant = "manual" | "sdk";

const STORAGE_KEY = "spm-tester-flow-variant";
const CHANGE_EVENT = "spm-tester-flow-variant-change";

function readVariant(): FlowVariant {
  if (!MANUAL_VERIFICATION_ENABLED) return "sdk";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "manual" ? "manual" : "sdk";
  } catch {
    return "sdk";
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function setFlowVariant(next: FlowVariant): void {
  const allowed = next === "manual" && !MANUAL_VERIFICATION_ENABLED ? "sdk" : next;
  try {
    localStorage.setItem(STORAGE_KEY, allowed);
  } catch {
    // Storage unavailable — readVariant() keeps returning SDK.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useFlowVariant(): { variant: FlowVariant; setVariant: (v: FlowVariant) => void } {
  const variant = useSyncExternalStore(subscribe, readVariant, () => "sdk" as FlowVariant);
  return { variant, setVariant: setFlowVariant };
}

export function VariantToggle() {
  const { variant, setVariant } = useFlowVariant();
  if (!MANUAL_VERIFICATION_ENABLED) {
    return (
      <span className="inline-flex rounded-md border border-accent/30 bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
        SDK
      </span>
    );
  }
  return (
    <div
      role="group"
      aria-label="Verification flow variant"
      className="inline-flex rounded-lg border border-ink-300 bg-surface p-0.5"
    >
      {(["sdk", "manual"] as const).map((option) => (
        <button
          key={option}
          aria-pressed={variant === option}
          onClick={() => setVariant(option)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
            variant === option
              ? "bg-accent text-accent-foreground"
              : "text-ink-600 hover:bg-ink-50 hover:text-ink-900"
          }`}
        >
          {option === "manual" ? "Manual (raw API)" : "SDK"}
        </button>
      ))}
    </div>
  );
}
