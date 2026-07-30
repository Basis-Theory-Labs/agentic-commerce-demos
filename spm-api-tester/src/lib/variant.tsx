"use client";

// The verification flow variant: Manual (raw API, editable requests) or SDK
// (@basis-theory/agentic-verification). Persisted in localStorage so the
// choice follows the user across pages; exposed via useSyncExternalStore so
// SSR renders the default and the client subscribes to changes.

import { useSyncExternalStore } from "react";

export type FlowVariant = "manual" | "sdk";

const STORAGE_KEY = "spm-tester-flow-variant";
const CHANGE_EVENT = "spm-tester-flow-variant-change";

function readVariant(): FlowVariant {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "sdk" ? "sdk" : "manual";
  } catch {
    return "manual";
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
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Storage unavailable — the toggle still works for this page via the event.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function useFlowVariant(): { variant: FlowVariant; setVariant: (v: FlowVariant) => void } {
  const variant = useSyncExternalStore(subscribe, readVariant, () => "manual" as FlowVariant);
  return { variant, setVariant: setFlowVariant };
}

export function VariantToggle() {
  const { variant, setVariant } = useFlowVariant();
  return (
    <div
      role="radiogroup"
      aria-label="Verification flow variant"
      className="inline-flex border border-ink-300"
    >
      {(["manual", "sdk"] as const).map((option) => (
        <button
          key={option}
          role="radio"
          aria-checked={variant === option}
          onClick={() => setVariant(option)}
          className={`px-3 py-1.5 text-xs font-medium ${
            variant === option ? "bg-ink-900 text-white" : "bg-white text-ink-600 hover:text-ink-900"
          }`}
        >
          {option === "manual" ? "Manual (raw API)" : "SDK"}
        </button>
      ))}
    </div>
  );
}
