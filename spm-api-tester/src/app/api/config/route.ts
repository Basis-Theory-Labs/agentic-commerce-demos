import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Non-secret runtime configuration. The private key itself never leaves the
// server — the client only learns whether it is configured.
export function GET() {
  return NextResponse.json({
    tenantType: process.env.BT_TENANT_TYPE === "production" ? "production" : "test",
    displayName: process.env.BT_DISPLAY_NAME || "Example Agent",
    hasPrivateKey: Boolean(process.env.BT_API_KEY),
  });
}
