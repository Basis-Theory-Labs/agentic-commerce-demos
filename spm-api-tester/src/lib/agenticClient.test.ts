import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgenticApiError, buildCurl, callAgentic, parseProblem, type Logger } from "./agenticClient";
import { AGENTIC_API_URL } from "./env";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function collectingLogger() {
  const entries: Record<string, Record<string, unknown>> = {};
  let counter = 0;
  const logger: Logger = {
    log: (entry) => {
      counter += 1;
      const id = `e${counter}`;
      entries[id] = { ...entry };
      return id;
    },
    update: (id, patch) => {
      entries[id] = { ...entries[id], ...patch };
    },
  };
  return { logger, entries };
}

describe("buildCurl", () => {
  it("redacts the API key", () => {
    const curl = buildCurl({
      method: "POST",
      url: "https://api.test.basistheory.com/agentic/allowances",
      headers: { "BT-API-KEY": "key_test_us_pub_secret123", "Content-Type": "application/json" },
      body: { a: 1 },
    });
    expect(curl).toContain("$BT_API_KEY");
    expect(curl).not.toContain("secret123");
    expect(curl).toContain("curl -X POST");
  });
});

describe("parseProblem", () => {
  it("passes through RFC 7807 objects", () => {
    const problem = parseProblem({ type: "INVALID_OTP", title: "Bad code", status: 400 }, 400);
    expect(problem.type).toBe("INVALID_OTP");
  });

  it("synthesizes a problem from non-JSON bodies", () => {
    const problem = parseProblem("gateway timeout", 504);
    expect(problem.title).toBe("HTTP 504");
    expect(problem.status).toBe(504);
  });
});

describe("callAgentic", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("public auth goes direct with the BT-API-KEY header", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "pm_1" }));
    await callAgentic({ method: "POST", path: "/payment-methods", body: { a: 1 }, auth: "public" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${AGENTIC_API_URL}/payment-methods`);
    expect((init.headers as Record<string, string>)["BT-API-KEY"]).toBeDefined();
  });

  it("proxy auth goes through /api/agentic with NO key header", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "alw_1" }));
    await callAgentic({ method: "POST", path: "/allowances", body: { a: 1 }, auth: "proxy" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/agentic/allowances");
    expect((init.headers as Record<string, string>)["BT-API-KEY"]).toBeUndefined();
  });

  it("forwards the Idempotency-Key header when given", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "cred_1" }));
    await callAgentic({
      method: "POST",
      path: "/allowances/alw_1/credentials",
      body: {},
      auth: "proxy",
      idempotencyKey: "key-123",
    });
    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe("key-123");
  });

  it("throws AgenticApiError with the parsed RFC 7807 body and trace id", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          type: "VALIDATION_ERROR",
          title: "Request validation failed",
          status: 400,
          errors: { "amount.currency": ["Invalid currency"] },
        },
        { status: 400, headers: { "bt-trace-id": "trace-abc", "Content-Type": "application/json" } },
      ),
    );
    const error = await callAgentic({ method: "POST", path: "/allowances", body: {}, auth: "proxy" }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(AgenticApiError);
    expect(error.problem.type).toBe("VALIDATION_ERROR");
    expect(error.problem.errors["amount.currency"]).toEqual(["Invalid currency"]);
    expect(error.traceId).toBe("trace-abc");
    expect(error.status).toBe(400);
  });

  it("hydrates the log entry from the X-BT-Trace header on proxied calls", async () => {
    const trace = {
      method: "POST",
      url: "https://api.test.basistheory.com/agentic/allowances",
      request_body: { upstream: true },
      status: 201,
      response_body: { id: "alw_9" },
      duration_ms: 42,
    };
    fetchMock.mockResolvedValue(
      jsonResponse(
        { id: "alw_9" },
        {
          status: 201,
          headers: {
            "Content-Type": "application/json",
            "X-BT-Trace": btoa(JSON.stringify(trace)),
          },
        },
      ),
    );
    const { logger, entries } = collectingLogger();
    await callAgentic({ method: "POST", path: "/allowances", body: { local: true }, auth: "proxy" }, logger);
    const entry = Object.values(entries)[0];
    expect(entry.url).toBe(trace.url);
    expect(entry.duration_ms).toBe(42);
    expect(entry.request).toEqual({ upstream: true });
    expect(entry.pending).toBe(false);
  });

  it("marks the log entry failed when fetch itself rejects", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const { logger, entries } = collectingLogger();
    await expect(
      callAgentic({ method: "GET", path: "/allowances/alw_1", auth: "public" }, logger),
    ).rejects.toThrow("network down");
    const entry = Object.values(entries)[0];
    expect(entry.ok).toBe(false);
    expect(entry.pending).toBe(false);
  });
});
