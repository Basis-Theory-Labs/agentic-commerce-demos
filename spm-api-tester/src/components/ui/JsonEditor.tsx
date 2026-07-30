"use client";

import { useCallback, useMemo, useState } from "react";

// Editable JSON request body with a toolbar: Format, Reset to default, Copy.
// State-held (never DOM-held) so user edits survive re-renders. Invalid JSON
// is flagged inline as you type — not only on send.
export function JsonEditor({
  value,
  onChange,
  defaultValue,
  rows,
  ariaLabel = "Request body",
}: {
  value: string;
  onChange: (next: string) => void;
  /** The pristine body "Reset to default" restores. */
  defaultValue: string;
  rows?: number;
  ariaLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  const parseError = useMemo(() => {
    if (!value.trim()) return null;
    try {
      JSON.parse(value);
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Invalid JSON";
    }
  }, [value]);

  const format = useCallback(() => {
    try {
      onChange(JSON.stringify(JSON.parse(value), null, 2));
    } catch {
      // Leave unparseable text alone; the inline hint already flags it.
    }
  }, [value, onChange]);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }, [value]);

  const lineCount = value.split("\n").length;

  return (
    <details className="group overflow-hidden rounded-lg border border-ink-300 bg-surface">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 bg-surface-raised px-3 py-2 text-xs transition-colors hover:bg-ink-100/70 [&::-webkit-details-marker]:hidden">
        <span className="font-medium tracking-wide text-ink-700 uppercase">JSON body</span>
        <span className={`flex items-center gap-2 ${parseError ? "text-error" : "text-ink-500"}`}>
          {parseError ? "invalid" : `${lineCount} ${lineCount === 1 ? "line" : "lines"}`}
          <span className="transition-transform group-open:rotate-90">›</span>
        </span>
      </summary>
      <div className="border-t border-ink-300">
        <div className="flex flex-wrap justify-end gap-1.5 bg-surface-raised px-2.5 py-1.5">
          <ToolbarButton onClick={format} disabled={!!parseError}>
            Format
          </ToolbarButton>
          <ToolbarButton onClick={() => onChange(defaultValue)}>Reset</ToolbarButton>
          <ToolbarButton onClick={copy}>{copied ? "Copied" : "Copy"}</ToolbarButton>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows ?? Math.min(12, lineCount + 1)}
          spellCheck={false}
          aria-label={ariaLabel}
          aria-invalid={!!parseError}
          className="block min-h-20 w-full resize-y rounded-none border-t border-ink-300 bg-screen/80 px-3 py-2.5 font-mono text-xs leading-[1.55] text-ink-900 focus:outline-none"
        />
        {parseError && (
          <div className="border-t border-error-border bg-error-soft px-2.5 py-1.5 text-xs text-error">
            Invalid JSON: {parseError}
          </div>
        )}
      </div>
    </details>
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-ink-300 bg-surface-control px-2 py-0.5 text-[11px] text-ink-700 transition-colors hover:border-accent/50 hover:text-ink-950 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
