"use client";

// The session resource registry: every token, payment method, allowance, and
// credential created or imported this session, in one typed store. All step
// gating derives from it. Persisted to sessionStorage so a reload keeps the
// session; "Reset session" clears it.
//
// Credential VALUES are deliberately NOT stored here — the API returns them
// exactly once and this registry persists to sessionStorage. Only metadata is
// kept; reveal cards hold values in component memory.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import type { Allowance, Credential, PaymentMethod } from "@/lib/types";

export interface TokenEntry {
  id: string;
  /** Mock-scenario PAN, when the token came from the mock picker. */
  scenarioPan?: string;
  brand?: string;
  last4?: string;
  via: "elements" | "raw" | "imported";
  createdAt: number;
}

export interface PaymentMethodEntry {
  resource: PaymentMethod;
  /** Token used to create it (when created in this session). */
  tokenId?: string;
  scenarioPan?: string;
  imported?: boolean;
}

export interface AllowanceEntry {
  resource: Allowance;
  scenarioPan?: string;
  imported?: boolean;
}

export interface CredentialEntry {
  /** Metadata only — never the one-time credential value. */
  resource: Omit<Credential, "credential"> & { credential: { format: string } };
  allowanceId: string;
}

export interface SessionState {
  tokens: TokenEntry[];
  paymentMethods: PaymentMethodEntry[];
  allowances: AllowanceEntry[];
  credentials: CredentialEntry[];
}

const EMPTY: SessionState = {
  tokens: [],
  paymentMethods: [],
  allowances: [],
  credentials: [],
};

export type SessionAction =
  | { type: "hydrate"; state: SessionState }
  | { type: "addToken"; token: TokenEntry }
  | { type: "upsertPaymentMethod"; entry: PaymentMethodEntry }
  | { type: "removePaymentMethod"; id: string }
  | { type: "upsertAllowance"; entry: AllowanceEntry }
  | { type: "addCredential"; entry: CredentialEntry }
  | { type: "reset" };

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "addToken":
      if (state.tokens.some((t) => t.id === action.token.id)) return state;
      return { ...state, tokens: [action.token, ...state.tokens] };
    case "upsertPaymentMethod": {
      const id = action.entry.resource.id;
      const existing = state.paymentMethods.find((p) => p.resource.id === id);
      const paymentMethods = existing
        ? state.paymentMethods.map((p) =>
            p.resource.id === id ? { ...p, ...action.entry, resource: action.entry.resource } : p,
          )
        : [action.entry, ...state.paymentMethods];
      return { ...state, paymentMethods };
    }
    case "removePaymentMethod":
      return {
        ...state,
        paymentMethods: state.paymentMethods.filter((p) => p.resource.id !== action.id),
        // Deleting a payment method cascades to its allowances server-side;
        // mirror that locally.
        allowances: state.allowances.filter(
          (a) => a.resource.payment_method_id !== action.id,
        ),
      };
    case "upsertAllowance": {
      const id = action.entry.resource.id;
      const existing = state.allowances.find((a) => a.resource.id === id);
      const allowances = existing
        ? state.allowances.map((a) =>
            a.resource.id === id ? { ...a, ...action.entry, resource: action.entry.resource } : a,
          )
        : [action.entry, ...state.allowances];
      return { ...state, allowances };
    }
    case "addCredential":
      if (state.credentials.some((c) => c.resource.id === action.entry.resource.id)) return state;
      return { ...state, credentials: [action.entry, ...state.credentials] };
    case "reset":
      return EMPTY;
    default:
      return state;
  }
}

/* ── derived gates ────────────────────────────────────────────────────── */

export function findPaymentMethod(state: SessionState, id?: string | null) {
  return id ? state.paymentMethods.find((p) => p.resource.id === id) : undefined;
}

export function findAllowance(state: SessionState, id?: string | null) {
  return id ? state.allowances.find((a) => a.resource.id === id) : undefined;
}

export function scenarioForAllowance(state: SessionState, id?: string | null): string | undefined {
  const alw = findAllowance(state, id);
  if (alw?.scenarioPan) return alw.scenarioPan;
  const pm = findPaymentMethod(state, alw?.resource.payment_method_id);
  return pm?.scenarioPan;
}

/* ── provider ─────────────────────────────────────────────────────────── */

const STORAGE_KEY = "spm-tester-session-v1";

interface SessionContextValue {
  state: SessionState;
  dispatch: React.Dispatch<SessionAction>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function load(): SessionState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as SessionState;
    return {
      tokens: parsed.tokens ?? [],
      paymentMethods: parsed.paymentMethods ?? [],
      allowances: parsed.allowances ?? [],
      credentials: parsed.credentials ?? [],
    };
  } catch {
    return EMPTY;
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, EMPTY);
  const hydrated = useRef(false);

  // StrictMode double-invokes effects in dev — guard the bootstrap.
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    dispatch({ type: "hydrate", state: load() });
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable (private mode) — the session just won't survive reloads.
    }
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

export function useResetSession() {
  const { dispatch } = useSession();
  return useCallback(() => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    dispatch({ type: "reset" });
  }, [dispatch]);
}
