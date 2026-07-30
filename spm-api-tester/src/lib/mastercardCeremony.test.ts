import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BRIDGE_MESSAGE_TYPE,
  bridgeOrigins,
  isBridgeMessage,
  isSafeCeremonyUrl,
  pollComplete,
} from "./mastercardCeremony";
import type { VerifyResponse } from "./types";

describe("bridgeOrigins", () => {
  it("always includes the known Basis Theory hosts", () => {
    const origins = bridgeOrigins("https://api.test.basistheory.com/agentic");
    expect(origins).toContain("https://api.basistheory.com");
    expect(origins).toContain("https://api.test.basistheory.com");
  });

  it("adds the origin of a custom (local) agentic API URL", () => {
    expect(bridgeOrigins("http://localhost:3001/api")).toContain("http://localhost:3001");
  });
});

describe("isSafeCeremonyUrl", () => {
  it("accepts http(s) and rejects script-ish schemes", () => {
    expect(isSafeCeremonyUrl("https://api.test.basistheory.com/mock/mastercard/allowance-auth")).toBe(true);
    expect(isSafeCeremonyUrl("http://localhost:3001/api/mock/mastercard/allowance-auth")).toBe(true);
    expect(isSafeCeremonyUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeCeremonyUrl("data:text/html,<script>1</script>")).toBe(false);
    expect(isSafeCeremonyUrl("//evil.example/path")).toBe(false);
  });
});

describe("isBridgeMessage — the bridge posts with targetOrigin '*'", () => {
  const popup = { name: "popup" };
  const origins = ["https://api.test.basistheory.com"];
  const goodEvent = {
    origin: "https://api.test.basistheory.com",
    source: popup,
    data: { type: BRIDGE_MESSAGE_TYPE },
  };

  it("accepts the genuine bridge message", () => {
    expect(isBridgeMessage(goodEvent, popup, origins)).toBe(true);
  });

  it("rejects messages from a non-allowlisted origin", () => {
    expect(isBridgeMessage({ ...goodEvent, origin: "https://evil.example" }, popup, origins)).toBe(
      false,
    );
  });

  it("rejects messages whose source is not the popup window", () => {
    expect(isBridgeMessage({ ...goodEvent, source: { name: "other" } }, popup, origins)).toBe(
      false,
    );
    expect(isBridgeMessage(goodEvent, null, origins)).toBe(false);
  });

  it("rejects other message types", () => {
    expect(isBridgeMessage({ ...goodEvent, data: { type: "something" } }, popup, origins)).toBe(
      false,
    );
    expect(isBridgeMessage({ ...goodEvent, data: null }, popup, origins)).toBe(false);
  });
});

describe("pollComplete — the cue is not a result", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const pending: VerifyResponse = {
    status: "verification_required",
    rail: "agentic-token",
    provider: "agentpay",
  };
  const active: VerifyResponse = { status: "active", rail: "agentic-token", provider: "agentpay" };

  it("returns immediately when complete activates on the first try", async () => {
    const send = vi.fn().mockResolvedValue(active);
    await expect(pollComplete(send)).resolves.toEqual(active);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("retries while pending, then resolves", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(active);
    const result = pollComplete(send, { delayMs: 2000 });
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(2000);
    await expect(result).resolves.toEqual(active);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("stops after the bounded number of attempts", async () => {
    const send = vi.fn().mockResolvedValue(pending);
    const onPending = vi.fn();
    const result = pollComplete(send, { attempts: 3, delayMs: 1000, onPending });
    const assertion = expect(result).rejects.toThrow(/still pending/i);
    await vi.advanceTimersByTimeAsync(5000);
    await assertion;
    expect(send).toHaveBeenCalledTimes(3);
    expect(onPending).toHaveBeenCalledTimes(3);
  });

  it("a pending response WITH a next_action is not treated as pending", async () => {
    const withAction: VerifyResponse = {
      ...pending,
      next_action: { type: "redirect", uri: "https://example.com", uri_type: "WEB_URI" },
    };
    const send = vi.fn().mockResolvedValue(withAction);
    await expect(pollComplete(send)).resolves.toEqual(withAction);
    expect(send).toHaveBeenCalledTimes(1);
  });
});
