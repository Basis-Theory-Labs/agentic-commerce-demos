"use client";

import { forwardRef } from "react";

type Variant = "primary" | "ghost" | "destructive";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  small?: boolean;
  /** Swap the label for a spinner + progress text and disable while true. */
  loading?: boolean;
  loadingLabel?: string;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:bg-accent-hover disabled:bg-ink-100 disabled:text-ink-500",
  ghost:
    "border border-ink-300 bg-surface text-ink-900 hover:border-accent/50 hover:bg-ink-50 disabled:text-ink-400 disabled:hover:border-ink-300",
  destructive:
    "border border-error-border bg-error-soft text-error hover:border-error disabled:opacity-50",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    small = false,
    loading = false,
    loadingLabel = "Working…",
    disabled,
    children,
    className = "",
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors ${
        small ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm"
      } ${VARIANT_CLASSES[variant]} disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin border-2 border-current border-t-transparent"
          style={{ borderRadius: "50%" }}
        />
      )}
      {loading ? loadingLabel : children}
    </button>
  );
});
