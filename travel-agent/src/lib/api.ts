// Server-side helper used by all Next.js API routes.
//
// 1. Proxies HTTP calls to the Basis Theory API using the private key.
// 2. Attaches a structured "X-BT-Trace" header to each response so the
//    client-side "Behind the calls" panel can show the upstream call detail
//    (URL, method, request body, status, response body). This is purely for
//    demo visibility — production apps would not expose this.

import { NextResponse } from "next/server";

const BT_ENVIRONMENT = process.env.BT_ENVIRONMENT || "test";
const DEFAULT_LOCAL_API_URL = "http://localhost:3001";

// Resolves the Basis Theory API base URL for the current environment.
// `local` is for pointing the demo at a Basis Theory API running on your
// own machine (defaults to http://localhost:3001, overridable via
// BT_LOCAL_API_URL).
function getBaseUrl(): string {
  switch (BT_ENVIRONMENT) {
    case "production":
      return "https://api.basistheory.com";
    case "local":
      return process.env.BT_LOCAL_API_URL || DEFAULT_LOCAL_API_URL;
    case "test":
    default:
      return "https://api.test.basistheory.com";
  }
}

const SAFE_ID = /^[a-zA-Z0-9_-]{1,128}$/;

export function validateId(id: string, name: string): string | null {
  return SAFE_ID.test(id) ? null : `Invalid ${name}`;
}

export interface UpstreamTrace {
  method: string;
  url: string;
  request_body?: unknown;
  status: number;
  response_body?: unknown;
  duration_ms: number;
}

interface ProxyResult {
  data: unknown;
  trace: UpstreamTrace;
  status: number;
  ok: boolean;
}

export async function btProxy(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<ProxyResult> {
  const apiKey = process.env.BT_API_KEY;
  if (!apiKey) {
    throw new Error("BT_API_KEY environment variable is not set");
  }

  const method = init.method ?? "GET";
  const url = `${getBaseUrl()}${path}`;
  const requestBody = init.body;

  const start = Date.now();
  const response = await fetch(url, {
    method,
    headers: {
      "BT-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: requestBody === undefined ? undefined : JSON.stringify(requestBody),
  });
  const duration_ms = Date.now() - start;

  let parsed: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: `Upstream returned non-JSON (${response.status})`, body: text };
    }
  }

  return {
    data: parsed,
    status: response.status,
    ok: response.ok,
    trace: {
      method,
      url,
      request_body: requestBody,
      status: response.status,
      response_body: parsed,
      duration_ms,
    },
  };
}

// Wraps a proxy result into a Next response with the trace header.
// The header is base64-encoded JSON so it survives transport.
export function withTrace(result: ProxyResult, successStatus?: number): NextResponse {
  const headers = new Headers();
  headers.set("X-BT-Trace", Buffer.from(JSON.stringify(result.trace)).toString("base64"));

  const status = result.ok ? (successStatus ?? result.status) : result.status;
  return NextResponse.json(result.data, { status, headers });
}
