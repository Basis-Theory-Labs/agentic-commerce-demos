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
    <div className="border border-ink-200 bg-white">
      <div className="flex items-center justify-between border-b border-ink-200 bg-ink-50 px-2 py-1">
        <span className="text-[10px] tracking-wide text-ink-500 uppercase">JSON body</span>
        <div className="flex gap-1">
          <ToolbarButton onClick={format} disabled={!!parseError}>
            Format
          </ToolbarButton>
          <ToolbarButton onClick={() => onChange(defaultValue)}>Reset to default</ToolbarButton>
          <ToolbarButton onClick={copy}>{copied ? "Copied" : "Copy"}</ToolbarButton>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows ?? Math.min(18, lineCount + 1)}
        spellCheck={false}
        aria-label={ariaLabel}
        aria-invalid={!!parseError}
        className="block w-full resize-y bg-white px-2.5 py-2 font-mono text-[12px] leading-relaxed text-ink-900 focus:outline-none"
      />
      {parseError && (
        <div className="border-t border-error-border bg-error-soft px-2.5 py-1.5 text-[11px] text-error">
          Invalid JSON: {parseError}
        </div>
      )}
    </div>
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
      className="border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] text-ink-700 hover:border-ink-400 disabled:opacity-40"
    >
      {children}
    </button>
  );
}
