// Client-visible environment. NEXT_PUBLIC_* values are inlined at build time,
// so each must be referenced as a full literal.

export const PUBLIC_KEY = process.env.NEXT_PUBLIC_BT_API_KEY || "";

export const AGENTIC_API_URL = (
  process.env.NEXT_PUBLIC_BT_AGENTIC_API_URL || "https://api.test.basistheory.com/agentic"
).replace(/\/+$/, "");

export const VAULT_API_URL = (
  process.env.NEXT_PUBLIC_BT_VAULT_API_URL || "https://api.test.basistheory.com"
).replace(/\/+$/, "");

// The SDK is the product integration and therefore the tester's default.
// Manual raw-API verification is an opt-in teaching/debug surface.
export const MANUAL_VERIFICATION_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_MANUAL_VERIFICATION === "true";

// 'production' (default) uses the embed block served by the API for the Visa
// surfaces; 'sandbox' substitutes the override credentials below. No network
// credentials live in source — sandbox values come from env.
export const VISA_ENVIRONMENT =
  process.env.NEXT_PUBLIC_BT_VISA_ENVIRONMENT === "sandbox" ? "sandbox" : "production";

export const VISA_SANDBOX_EMBED = {
  iframe_url: process.env.NEXT_PUBLIC_BT_VISA_SANDBOX_IFRAME_URL || "",
  api_key: process.env.NEXT_PUBLIC_BT_VISA_SANDBOX_API_KEY || "",
  client_app_id: process.env.NEXT_PUBLIC_BT_VISA_SANDBOX_CLIENT_APP_ID || "",
};

export const HAS_PUBLIC_KEY = PUBLIC_KEY.length > 0;
