// Wire types for the Basis Theory Agentic Payments (SPM) API, as consumed by
// this tester. Statuses and error `type` strings are open sets — the API adds
// values over time — so unions carry a `(string & {})` escape hatch.

export type OpenString<T extends string> = T | (string & {});

export interface Money {
  value: string;
  currency: string;
}

export type RailName = OpenString<"agentic-token" | "spt">;
export type ProviderName = OpenString<"vic" | "agentpay" | "stripe">;
export type RailStatus = OpenString<"enabled" | "pending" | "error" | "active" | "pending_verification">;

export interface Rail {
  rail: RailName;
  provider?: ProviderName;
  status: RailStatus;
  /** Present when status is "error" — sanitized failure summary. */
  error?: { type?: string; title?: string; detail?: string; [key: string]: unknown };
}

export interface PaymentMethod {
  id: string;
  status?: string;
  card?: {
    brand?: string;
    last4?: string;
    expiration_month?: number | string;
    expiration_year?: number | string;
  };
  consumer?: { email?: string };
  rails?: Rail[];
  created_at?: string;
  [key: string]: unknown;
}

export interface Allowance {
  id: string;
  payment_method_id?: string;
  status?: string;
  amount?: Money;
  amount_spent?: Money;
  amount_reserved?: Money;
  amount_available?: Money;
  merchant?: { name?: string; url?: string; country_code?: string };
  description?: string;
  metadata?: Record<string, unknown>;
  expires_at?: string;
  rails?: Rail[];
  created_at?: string;
  [key: string]: unknown;
}

export interface Credential {
  id: string;
  rail: RailName;
  provider?: ProviderName;
  amount: Money;
  expires_at: string;
  credential: {
    format: OpenString<"card" | "network-token" | "identifier" | "mpp">;
    value?: unknown;
  };
  [key: string]: unknown;
}

/* ── verification ─────────────────────────────────────────────────────── */

export interface VisaEmbed {
  iframe_url: string;
  api_key: string;
  client_app_id: string;
}

export interface OtpMethod {
  id: string;
  type: OpenString<"sms" | "email" | "otponlinebanking">;
  value: string;
}

export interface PasskeyContext {
  endpoint: string;
  identifier: string;
  payload: string;
  action: OpenString<"REGISTER" | "AUTHENTICATE">;
  platform_type?: string;
  auth_preferences?: { response_mode?: string; response_type?: string };
}

// The known next_action union. `type` is an open set on the wire — surfaces
// render a labeled fallback for values not listed here rather than throwing.
export type NextAction =
  | { type: "passkey_session"; embed: VisaEmbed }
  | { type: "select_otp_method"; methods: OtpMethod[] }
  | { type: "otp"; method: OtpMethod; code_expiration_minutes?: number; max_attempts?: number }
  | { type: "passkey"; embed: VisaEmbed; passkey_context: PasskeyContext }
  | {
      type: "redirect";
      purpose?: string;
      uri: string;
      uri_type?: string;
      expires_at?: string;
    };

export const KNOWN_NEXT_ACTION_TYPES = [
  "passkey_session",
  "select_otp_method",
  "otp",
  "passkey",
  "redirect",
] as const;

export interface VerifyResponse {
  status: OpenString<"verification_required" | "active">;
  rail: RailName;
  provider: ProviderName;
  next_action?: NextAction;
}

/* ── errors (RFC 7807) ────────────────────────────────────────────────── */

export interface ApiProblem {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  errors?: Record<string, string[]>;
  [key: string]: unknown;
}

/* ── app config served by /api/config ─────────────────────────────────── */

export interface AppConfig {
  tenantType: "test" | "production";
  displayName: string;
  hasPrivateKey: boolean;
}
