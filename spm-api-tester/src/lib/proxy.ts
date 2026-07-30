import { NextRequest, NextResponse } from "next/server";

// Server-side proxy for the operations that require the PRIVATE key
// (allowance create/patch/cancel, rails retry, credential mint/list/get,
// /errors). Browser-safe operations (tokenize, create payment method,
// verify) never come through here — they hit the API directly with the
// public key.
//
// Every proxied exchange is summarized into a base64 `X-BT-Trace` response
// header so the client-side inspector can show the real upstream call. This
// is a demo affordance — do not ship it in a production integration.

const AGENTIC_BASE =
  process.env.BT_AGENTIC_API_URL || "https://api.test.basistheory.com/agentic";

export interface ServerTrace {
  method: string;
  url: string;
  request_body: unknown;
  status: number;
  response_body: unknown;
  duration_ms: number;
}

function encodeTrace(trace: ServerTrace): string {
  // btoa can't take arbitrary UTF-8; go through Buffer.
  return Buffer.from(JSON.stringify(trace), "utf-8").toString("base64");
}

export async function proxyAgentic(request: NextRequest, path: string[]) {
  const apiKey = process.env.BT_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        type: "CONFIGURATION_ERROR",
        title: "BT_API_KEY is not configured",
        detail: "Set BT_API_KEY in .env.local and restart the dev server.",
        status: 500,
      },
      { status: 500 },
    );
  }

  const url = `${AGENTIC_BASE.replace(/\/+$/, "")}/${path.join("/")}${request.nextUrl.search}`;
  const rawBody =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.text();

  const started = Date.now();
  const upstream = await fetch(url, {
    method: request.method,
    headers: {
      "BT-API-KEY": apiKey,
      "Content-Type": request.headers.get("content-type") || "application/json",
      ...(request.headers.get("idempotency-key")
        ? { "Idempotency-Key": request.headers.get("idempotency-key")! }
        : {}),
    },
    body: rawBody,
    cache: "no-store",
  });
  const duration = Date.now() - started;

  const responseText = await upstream.text();
  let responseJson: unknown = null;
  try {
    responseJson = responseText ? JSON.parse(responseText) : null;
  } catch {
    responseJson = responseText;
  }
  let requestJson: unknown = null;
  try {
    requestJson = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    requestJson = rawBody;
  }

  const headers: Record<string, string> = {
    "Content-Type": upstream.headers.get("content-type") || "application/json",
    "X-BT-Trace": encodeTrace({
      method: request.method,
      url,
      request_body: requestJson,
      status: upstream.status,
      response_body: responseJson,
      duration_ms: duration,
    }),
  };
  const traceId = upstream.headers.get("bt-trace-id");
  if (traceId) headers["bt-trace-id"] = traceId;

  return new NextResponse(responseText, { status: upstream.status, headers });
}
