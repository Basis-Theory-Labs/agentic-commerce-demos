"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export type CallSource = "browser" | "server" | "sdk" | "elements";

export interface CallEntry {
  id: string;
  source: CallSource;
  label: string;
  method?: string;
  url?: string;
  status?: number;
  ok?: boolean;
  request?: unknown;
  response?: unknown;
  duration_ms?: number;
  timestamp: number;
  step?: string;
}

interface ApiLogContextValue {
  entries: CallEntry[];
  log: (entry: Omit<CallEntry, "id" | "timestamp">) => void;
  clear: () => void;
}

const ApiLogContext = createContext<ApiLogContextValue | null>(null);

export function ApiLogProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<CallEntry[]>([]);
  const counter = useRef(0);

  const log = useCallback((entry: Omit<CallEntry, "id" | "timestamp">) => {
    counter.current += 1;
    const id = `call-${counter.current}`;
    const timestamp = Date.now();
    setEntries((prev) => [...prev, { ...entry, id, timestamp }]);
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  const value = useMemo(() => ({ entries, log, clear }), [entries, log, clear]);
  return (
    <ApiLogContext.Provider value={value}>{children}</ApiLogContext.Provider>
  );
}

export function useApiLog(): ApiLogContextValue {
  const ctx = useContext(ApiLogContext);
  if (!ctx) throw new Error("useApiLog must be used inside <ApiLogProvider>");
  return ctx;
}

function decodeTrace(header: string | null): {
  method: string;
  url: string;
  request_body?: unknown;
  status: number;
  response_body?: unknown;
  duration_ms: number;
} | null {
  if (!header) return null;
  try {
    const json = atob(header);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function useLoggedFetch() {
  const { log } = useApiLog();

  return useCallback(
    async (
      input: string,
      init: RequestInit & { step?: string; label?: string } = {},
    ): Promise<Response> => {
      const { step, label, ...rest } = init;
      const method = rest.method ?? "GET";
      const start = Date.now();

      let response: Response;
      try {
        response = await fetch(input, rest);
      } catch (err) {
        log({
          source: "browser",
          label: label ?? `${method} ${input}`,
          method,
          url: input,
          ok: false,
          response: {
            error: err instanceof Error ? err.message : "fetch failed",
          },
          duration_ms: Date.now() - start,
          step,
        });
        throw err;
      }

      const trace = decodeTrace(response.headers.get("X-BT-Trace"));
      if (trace) {
        log({
          source: "server",
          label: `${trace.method} ${new URL(trace.url).pathname}`,
          method: trace.method,
          url: trace.url,
          status: trace.status,
          ok: trace.status >= 200 && trace.status < 300,
          request: trace.request_body,
          response: trace.response_body,
          duration_ms: trace.duration_ms,
          step,
        });
      }

      return response;
    },
    [log],
  );
}
