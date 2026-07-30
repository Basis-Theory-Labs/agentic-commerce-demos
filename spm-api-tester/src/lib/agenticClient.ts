// The browser-side API client. Two transports, one per key:
//
//   auth: "public" — direct fetch to the Agentic API with the PUBLIC key
//                    (create/retry payment method, verify allowance)
//   auth: "proxy"  — fetch to the Next.js route, which attaches the PRIVATE
//                    key server-side (reads, allowance management, credentials,
//                    errors)
//
// Framework-free so the RFC 7807 parsing, trace extraction, and key selection
// are unit-testable; React surfaces pass a log callback from useApiLog.

import { AGENTIC_API_URL, PUBLIC_KEY } from "@/lib/env";
import type { LogInput } from "@/lib/apiLog";
import { decodeTrace } from "@/lib/apiLog";
import type { ApiProblem } from "@/lib/types";

export type AuthMode = "public" | "proxy";

export class AgenticApiError extends Error {
  readonly problem: ApiProblem;
  readonly status: number;
  readonly traceId?: string;

  constructor(problem: ApiProblem, status: number, traceId?: string) {
    super(problem.title || problem.type || `HTTP ${status}`);
    this.name = "AgenticApiError";
    this.problem = problem;
    this.status = status;
    this.traceId = traceId;
    Object.setPrototypeOf(this, AgenticApiError.prototype);
  }
}

export interface AgenticCall {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** Path under the agentic base, e.g. `/allowances/alw_123/verify`. */
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  auth: AuthMode;
  /** Short tag for the inspector (verify action name, etc.). */
  tag?: string;
  signal?: AbortSignal;
}

export interface Logger {
  log: (entry: LogInput) => string;
  update: (id: string, patch: Partial<LogInput>) => void;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function buildCurl(opts: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}): string {
  const parts = [`curl -X ${opts.method} ${shellQuote(opts.url)}`];
  for (const [name, value] of Object.entries(opts.headers)) {
    // Never emit a real key. Keep this one placeholder expandable so the
    // copied command works after `BT_API_KEY=...` is set in the shell.
    if (name.toLowerCase() === "bt-api-key") {
      parts.push(`  -H "BT-API-KEY: $BT_API_KEY"`);
    } else {
      parts.push(`  -H ${shellQuote(`${name}: ${value}`)}`);
    }
  }
  if (opts.body !== undefined) {
    parts.push(`  -d ${shellQuote(JSON.stringify(opts.body, null, 2))}`);
  }
  return parts.join(" \\\n");
}

function redactCredentialLogResponse(method: string, path: string, body: unknown): unknown {
  if (
    method !== "POST" ||
    !/^\/allowances\/[^/]+\/credentials\/?$/.test(path) ||
    !body ||
    typeof body !== "object"
  ) {
    return body;
  }
  const response = body as Record<string, unknown>;
  const credential = response.credential;
  if (!credential || typeof credential !== "object" || !("value" in credential)) return body;
  return {
    ...response,
    credential: {
      ...(credential as Record<string, unknown>),
      value: "[redacted — revealed once in the UI]",
    },
  };
}

export function parseProblem(json: unknown, status: number): ApiProblem {
  if (json && typeof json === "object") return json as ApiProblem;
  return { type: "UNKNOWN", title: `HTTP ${status}`, status };
}

/**
 * Perform one Agentic API call, logging the real wire exchange to the
 * inspector. Throws {@link AgenticApiError} on non-2xx with the parsed
 * RFC 7807 body and `bt-trace-id`.
 */
export async function callAgentic<T = unknown>(opts: AgenticCall, logger?: Logger): Promise<T> {
  const direct = opts.auth === "public";
  const url = direct ? `${AGENTIC_API_URL}${opts.path}` : `/api/agentic${opts.path}`;

  // Content-Type only when a body exists: Fastify runs the JSON parser
  // whenever the header is present, so a bodiless DELETE with
  // `Content-Type: application/json` fails on an empty body.
  const wireHeaders: Record<string, string> = {
    ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(direct ? { "BT-API-KEY": PUBLIC_KEY } : {}),
    ...(opts.idempotencyKey ? { "BT-IDEMPOTENCY-KEY": opts.idempotencyKey } : {}),
  };

  // The inspector row describes the REAL upstream exchange. For proxied calls
  // the upstream URL arrives in the X-BT-Trace header after the fact; start
  // from the logical path and hydrate on settle.
  const entryId = logger?.log({
    source: direct ? "browser" : "server",
    label: `${opts.method} ${opts.path}`,
    method: opts.method,
    url,
    tag: opts.tag,
    request: opts.body,
    pending: true,
    curl: buildCurl({
      method: opts.method,
      url: direct ? url : `${AGENTIC_API_URL}${opts.path}`,
      headers: { ...(direct ? wireHeaders : { ...wireHeaders, "BT-API-KEY": "" }) },
      body: opts.body,
    }),
  });

  let response: Response;
  const started = Date.now();
  try {
    response = await fetch(url, {
      method: opts.method,
      headers: wireHeaders,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: opts.signal,
      cache: "no-store",
    });
  } catch (error) {
    if (entryId) {
      logger?.update(entryId, {
        pending: false,
        ok: false,
        response: { error: error instanceof Error ? error.message : "fetch failed" },
        duration_ms: Date.now() - started,
      });
    }
    throw error;
  }

  const duration = Date.now() - started;
  const traceId = response.headers.get("bt-trace-id") || undefined;
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }

  if (entryId) {
    const trace = decodeTrace(response.headers.get("X-BT-Trace"));
    const loggedResponse = redactCredentialLogResponse(
      opts.method,
      opts.path,
      trace?.response_body ?? json,
    );
    logger?.update(entryId, {
      pending: false,
      status: trace?.status ?? response.status,
      ok: response.ok,
      response: loggedResponse,
      request: trace?.request_body ?? opts.body,
      url: trace?.url ?? url,
      duration_ms: trace?.duration_ms ?? duration,
      traceId,
      // Rebuild the curl from the REAL upstream URL once the trace reveals
      // it (the server may target a different base than the browser).
      ...(trace
        ? {
            curl: buildCurl({
              method: opts.method,
              url: trace.url,
              headers: {
                ...wireHeaders,
                ...(direct ? {} : { "BT-API-KEY": "" }),
              },
              body: opts.body,
            }),
          }
        : {}),
    });
  }

  if (!response.ok) {
    throw new AgenticApiError(parseProblem(json, response.status), response.status, traceId);
  }
  return json as T;
}
