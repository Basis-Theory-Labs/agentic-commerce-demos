import { describe, expect, it } from "vitest";
import {
  findAllowance,
  findPaymentMethod,
  scenarioForAllowance,
  sessionReducer,
  type SessionState,
} from "./session";

const empty: SessionState = { tokens: [], paymentMethods: [], allowances: [], credentials: [] };

function seeded(): SessionState {
  let state = empty;
  state = sessionReducer(state, {
    type: "addToken",
    token: { id: "tok_1", via: "raw", scenarioPan: "4242424242424242", createdAt: 1 },
  });
  state = sessionReducer(state, {
    type: "upsertPaymentMethod",
    entry: {
      resource: { id: "pm_1", rails: [{ rail: "agentic-token", provider: "vic", status: "enabled" }] },
      tokenId: "tok_1",
      scenarioPan: "4242424242424242",
    },
  });
  state = sessionReducer(state, {
    type: "upsertAllowance",
    entry: { resource: { id: "alw_1", payment_method_id: "pm_1" } },
  });
  return state;
}

describe("sessionReducer", () => {
  it("deduplicates tokens by id", () => {
    let state = seeded();
    state = sessionReducer(state, {
      type: "addToken",
      token: { id: "tok_1", via: "imported", createdAt: 2 },
    });
    expect(state.tokens).toHaveLength(1);
    expect(state.tokens[0].via).toBe("raw");
  });

  it("upserts payment methods in place", () => {
    let state = seeded();
    state = sessionReducer(state, {
      type: "upsertPaymentMethod",
      entry: { resource: { id: "pm_1", rails: [{ rail: "spt", provider: "stripe", status: "enabled" }] } },
    });
    expect(state.paymentMethods).toHaveLength(1);
    expect(state.paymentMethods[0].resource.rails?.[0].rail).toBe("spt");
    // Session metadata (scenario, source token) survives the upsert.
    expect(state.paymentMethods[0].scenarioPan).toBe("4242424242424242");
  });

  it("removePaymentMethod cascades to its allowances, mirroring the API", () => {
    let state = seeded();
    state = sessionReducer(state, {
      type: "upsertAllowance",
      entry: { resource: { id: "alw_other", payment_method_id: "pm_other" } },
    });
    state = sessionReducer(state, { type: "removePaymentMethod", id: "pm_1" });
    expect(findPaymentMethod(state, "pm_1")).toBeUndefined();
    expect(findAllowance(state, "alw_1")).toBeUndefined();
    expect(findAllowance(state, "alw_other")).toBeDefined();
  });

  it("deduplicates credentials by id", () => {
    let state = seeded();
    const entry = {
      allowanceId: "alw_1",
      resource: {
        id: "cred_1",
        rail: "spt",
        amount: { value: "5.00", currency: "USD" },
        expires_at: "2027-01-01T00:00:00Z",
        credential: { format: "identifier" },
      },
    };
    state = sessionReducer(state, { type: "addCredential", entry });
    state = sessionReducer(state, { type: "addCredential", entry });
    expect(state.credentials).toHaveLength(1);
  });

  it("reset clears everything", () => {
    const state = sessionReducer(seeded(), { type: "reset" });
    expect(state).toEqual(empty);
  });
});

describe("derived gates", () => {
  it("scenarioForAllowance walks allowance → payment method → scenario", () => {
    const state = seeded();
    expect(scenarioForAllowance(state, "alw_1")).toBe("4242424242424242");
    expect(scenarioForAllowance(state, "alw_missing")).toBeUndefined();
    expect(scenarioForAllowance(state, null)).toBeUndefined();
  });

  it("finders tolerate null/undefined ids", () => {
    const state = seeded();
    expect(findPaymentMethod(state, null)).toBeUndefined();
    expect(findAllowance(state, undefined)).toBeUndefined();
  });
});
