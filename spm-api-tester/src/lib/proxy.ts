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

/**
 * Credential mint responses carry the one-time spendable value. The reveal
 * card is the ONLY surface that shows it — the inspector trace gets metadata
 * with the value redacted, so DevTools/HAR captures never carry a live PAN
 * or cryptogram a second way.
 */
function redactCredentialValue(body: unknown): unknown {
  if (!body || typeof body !== "object") return body;
  const obj = body as Record<string, unknown>;
  const credential = obj.credential as Record<string, unknown> | undefined;
  if (credential && typeof credential === "object" && "value" in credential) {
    return {
      ...obj,
      credential: { ...credential, value: "[redacted — revealed once in the UI]" },
    };
  }
  return body;
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

  if (path.some((segment) => !/^[A-Za-z0-9._~-]+$/.test(segment) || /^\.+$/.test(segment))) {
    return NextResponse.json(
      { type: "VALIDATION_ERROR", title: "Invalid path segment", status: 400 },
      { status: 400 },
    );
  }

  const url = `${AGENTIC_BASE.replace(/\/+$/, "")}/${path.join("/")}${request.nextUrl.search}`;
  const text =
    request.method === "GET" || request.method === "HEAD" ? "" : await request.text();
  // Bodiless requests (DELETE in particular) must not carry a Content-Type:
  // Fastify runs the JSON parser whenever the header is present and 500s on
  // an empty body.
  const rawBody = text.length > 0 ? text : undefined;

  const started = Date.now();
  const upstream = await fetch(url, {
    method: request.method,
    headers: {
      "BT-API-KEY": apiKey,
      ...(rawBody !== undefined
        ? { "Content-Type": request.headers.get("content-type") || "application/json" }
        : {}),
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
      response_body: redactCredentialValue(responseJson),
      duration_ms: duration,
    }),
  };
  const traceId = upstream.headers.get("bt-trace-id");
  if (traceId) headers["bt-trace-id"] = traceId;

  return new NextResponse(responseText, { status: upstream.status, headers });
}
