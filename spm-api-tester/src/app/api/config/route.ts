import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Non-secret runtime configuration. The private key itself never leaves the
// server — the client only learns whether it is configured.
export function GET() {
  return NextResponse.json({
    // Test-only affordances fail closed: a missing or misspelled value must
    // never prefill mock PANs or enable ceremony bypasses on a real tenant.
    tenantType: process.env.BT_TENANT_TYPE === "test" ? "test" : "production",
    displayName: process.env.BT_DISPLAY_NAME || "Example Agent",
    hasPrivateKey: Boolean(process.env.BT_API_KEY),
  });
}
