"use client";

import { useEffect, useRef, useState } from "react";

// Mono text + copy icon + "Copied" flash. Used for every id, key, credential
// value, and trace id in the app.
export function CopyChip({
  value,
  label,
  className = "",
}: {
  value: string;
  /** Optional display text; defaults to the value itself. */
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — leave the chip as-is.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`Copy ${value}`}
      className={`inline-flex max-w-full items-center gap-1 rounded-md border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-xs text-ink-800 transition-colors hover:border-accent/50 hover:text-ink-950 ${className}`}
    >
      <span className="truncate">{copied ? "Copied" : (label ?? value)}</span>
      <svg
        className="h-3.5 w-3.5 shrink-0 text-ink-500"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
        aria-hidden
      >
        {copied ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
          />
        )}
      </svg>
      <span className="sr-only">Copy to clipboard</span>
    </button>
  );
}
