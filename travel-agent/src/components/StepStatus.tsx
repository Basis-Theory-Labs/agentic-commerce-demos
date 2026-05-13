"use client";

import type { ReactNode } from "react";

export type StepState = "idle" | "running" | "done" | "error";

interface Props {
  label: string;
  state: StepState;
  detail?: ReactNode;
}

export default function StepStatus({ label, state, detail }: Props) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 w-5 h-5 shrink-0 grid place-items-center">
        {state === "running" && (
          <span className="w-4 h-4 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
        )}
        {state === "done" && (
          <svg className="w-5 h-5 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
        {state === "error" && (
          <svg className="w-5 h-5 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        )}
        {state === "idle" && (
          <span className="w-2.5 h-2.5 rounded-full bg-ink-300" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={`text-sm ${
            state === "done"
              ? "text-ink-900"
              : state === "error"
                ? "text-error"
                : state === "running"
                  ? "text-ink-900 font-medium"
                  : "text-ink-500"
          }`}
        >
          {label}
        </div>
        {detail && <div className="text-xs text-ink-500 mt-0.5">{detail}</div>}
      </div>
    </div>
  );
}
