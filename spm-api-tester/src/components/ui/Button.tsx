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
  primary: "bg-ink-900 text-white hover:bg-ink-700 disabled:bg-ink-400",
  ghost:
    "border border-ink-300 bg-white text-ink-900 hover:border-ink-900 disabled:text-ink-400 disabled:hover:border-ink-300",
  destructive: "border border-error text-error bg-white hover:bg-error-soft disabled:opacity-50",
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
      className={`inline-flex items-center justify-center gap-2 font-medium transition-colors ${
        small ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm"
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
