"use client";

// Hand-rolled toast layer. Success toasts confirm resource creation (with a
// copyable id); error toasts render the RFC 7807 problem — status, title,
// detail, instance, per-field errors, error `type`, provider correlation,
// and the `bt-trace-id` for support.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ApiProblem } from "@/lib/types";
import { AgenticApiError } from "@/lib/agenticClient";
import { CopyChip } from "@/components/ui/CopyChip";

export interface ToastData {
  id: number;
  kind: "success" | "error" | "info";
  title: string;
  detail?: string;
  /** Copyable value (resource id on success, trace id on error). */
  copy?: { label: string; value: string };
  problem?: ApiProblem;
  traceId?: string;
}

interface ToastContextValue {
  success: (title: string, copy?: { label: string; value: string }) => void;
  info: (title: string, detail?: string) => void;
  error: (error: unknown, fallbackTitle?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const schedule = useCallback(
    (id: number) => {
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
      );
    },
    [dismiss],
  );

  const pause = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const push = useCallback(
    (toast: Omit<ToastData, "id">) => {
      counter.current += 1;
      const id = counter.current;
      setToasts((prev) => [...prev, { ...toast, id }]);
      schedule(id);
    },
    [schedule],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (title, copy) => push({ kind: "success", title, copy }),
      info: (title, detail) => push({ kind: "info", title, detail }),
      error: (error, fallbackTitle = "Request failed") => {
        if (error instanceof AgenticApiError) {
          push({
            kind: "error",
            title: error.problem.title || fallbackTitle,
            detail: error.problem.detail,
            problem: error.problem,
            traceId: error.traceId,
          });
        } else {
          push({
            kind: "error",
            title: fallbackTitle,
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      },
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed top-14 right-3 left-3 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:w-full sm:max-w-md">
        {/* Two live regions so successes stay polite and errors interrupt. */}
        <div aria-live="polite" className="sr-only">
          {toasts
            .filter((t) => t.kind !== "error")
            .map((t) => t.title)
            .join(". ")}
        </div>
        <div aria-live="assertive" className="sr-only">
          {toasts
            .filter((t) => t.kind === "error")
            .map((t) => `${t.title}. ${t.detail ?? ""}`)
            .join(". ")}
        </div>
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            toast={toast}
            onDismiss={() => dismiss(toast.id)}
            onPause={() => pause(toast.id)}
            onResume={() => schedule(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({
  toast,
  onDismiss,
  onPause,
  onResume,
}: {
  toast: ToastData;
  onDismiss: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const tone =
    toast.kind === "error"
      ? "border-error-border bg-error-soft text-error"
      : toast.kind === "success"
        ? "border-success-border bg-success-soft text-success"
        : "border-info-border bg-info-soft text-info";
  const fieldErrors = toast.problem?.errors;
  const providerCorrelation = toast.problem?.debug?.provider_correlation;

  return (
    // Deliberately NOT a live region — announcements come from the dedicated
    // sr-only regions above, so screen readers hear each toast exactly once
    // while its buttons stay focusable. Auto-dismiss pauses on hover AND on
    // keyboard focus within.
    <div
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={onResume}
      className={`pointer-events-auto w-full rounded-[4px] border ${tone} p-2.5 shadow-2xl backdrop-blur-xl`}
    >
      <div className="flex min-h-9 items-start gap-3">
        <ToastIcon kind={toast.kind} />
        <div className="min-w-0 flex-1">
          <div className="text-xs leading-[1.4] font-medium">{toast.title}</div>
          {toast.detail && (
            <div className="mt-0.5 text-xs leading-[1.4] text-ink-700">{toast.detail}</div>
          )}
          {toast.problem?.instance && (
            <div className="mt-1 font-mono text-[11px] break-all text-ink-600">
              {toast.problem.instance}
            </div>
          )}
          {fieldErrors && Object.keys(fieldErrors).length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {Object.entries(fieldErrors).map(([field, messages]) => (
                <li key={field} className="text-xs text-error">
                  <span className="font-mono">{field}</span>: {messages.join("; ")}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {toast.problem?.status !== undefined && (
              <span className="border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[11px] text-ink-700">
                HTTP {toast.problem.status}
              </span>
            )}
            {toast.problem?.type && (
              <span className="border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[11px] text-ink-700">
                {toast.problem.type}
              </span>
            )}
            {providerCorrelation && (
              <span className="flex items-center gap-1 text-[11px] text-ink-500">
                provider correlation: <CopyChip value={providerCorrelation} />
              </span>
            )}
            {toast.copy && <CopyChip value={toast.copy.value} label={toast.copy.label} />}
            {toast.traceId && (
              <span className="flex items-center gap-1 text-[11px] text-ink-500">
                trace (for support): <CopyChip value={toast.traceId} />
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="shrink-0 rounded-sm p-0.5 text-current opacity-60 transition-opacity hover:opacity-100"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function ToastIcon({ kind }: { kind: ToastData["kind"] }) {
  return (
    <svg
      aria-hidden
      className="mt-0.5 h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
    >
      {kind === "success" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m8 12 2.5 2.5L16 9" />
        </>
      ) : kind === "error" ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 9 6 6m0-6-6 6" />
        </>
      ) : (
        <>
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M12 10.5v5" />
          <circle cx="12" cy="7.5" r=".75" fill="currentColor" stroke="none" />
        </>
      )}
    </svg>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
