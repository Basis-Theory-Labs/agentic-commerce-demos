import { NextResponse } from "next/server";

const BT_ENVIRONMENT = process.env.BT_ENVIRONMENT || "test";

function getBaseUrl(): string {
  switch (BT_ENVIRONMENT) {
    case "production":
      return "https://api.basistheory.com/agentic";
    case "test":
    default:
      return "https://api.test.basistheory.com/agentic";
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
  init: { method?: string; body?: unknown } = {},
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
      parsed = {
        error: `Upstream returned non-JSON (${response.status})`,
        body: text,
      };
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

export function withTrace(
  result: ProxyResult,
  successStatus?: number,
): NextResponse {
  const headers = new Headers();
  headers.set(
    "X-BT-Trace",
    Buffer.from(JSON.stringify(result.trace)).toString("base64"),
  );

  const status = result.ok ? (successStatus ?? result.status) : result.status;
  return NextResponse.json(result.data, { status, headers });
}
