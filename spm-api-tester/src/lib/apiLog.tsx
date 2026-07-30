"use client";

// Client-side API activity log backing the inspector. Every wire call the app
// makes — direct browser fetches, proxied server calls (hydrated from the
// X-BT-Trace header), Elements tokenization, and SDK activity — lands here.

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export type CallSource = "browser" | "server" | "elements" | "sdk";

export interface CallEntry {
  id: string;
  source: CallSource;
  label: string;
  method?: string;
  url?: string;
  /** Verify action or other short tag rendered next to the path. */
  tag?: string;
  status?: number;
  ok?: boolean;
  pending?: boolean;
  request?: unknown;
  response?: unknown;
  duration_ms?: number;
  /** `bt-trace-id` response header, when the API returned one. */
  traceId?: string;
  /** Ready-to-paste curl equivalent with the key redacted. */
  curl?: string;
  timestamp: number;
}

export type LogInput = Omit<CallEntry, "id" | "timestamp">;

interface ApiLogContextValue {
  entries: CallEntry[];
  /** Append an entry; returns its id for later patching. */
  log: (entry: LogInput) => string;
  /** Patch an existing entry (settle a pending call). */
  update: (id: string, patch: Partial<CallEntry>) => void;
  clear: () => void;
}

const ApiLogContext = createContext<ApiLogContextValue | null>(null);

export function ApiLogProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<CallEntry[]>([]);
  const counter = useRef(0);

  const log = useCallback((entry: LogInput) => {
    counter.current += 1;
    const id = `call-${counter.current}`;
    setEntries((prev) => [...prev, { ...entry, id, timestamp: Date.now() }]);
    return id;
  }, []);

  const update = useCallback((id: string, patch: Partial<CallEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const value = useMemo(() => ({ entries, log, update, clear }), [entries, log, update, clear]);
  return <ApiLogContext.Provider value={value}>{children}</ApiLogContext.Provider>;
}

export function useApiLog(): ApiLogContextValue {
  const ctx = useContext(ApiLogContext);
  if (!ctx) throw new Error("useApiLog must be used inside <ApiLogProvider>");
  return ctx;
}

export interface UpstreamTrace {
  method: string;
  url: string;
  request_body?: unknown;
  status: number;
  response_body?: unknown;
  duration_ms: number;
}

export function decodeTrace(header: string | null): UpstreamTrace | null {
  if (!header) return null;
  try {
    return JSON.parse(atob(header)) as UpstreamTrace;
  } catch {
    return null;
  }
}
