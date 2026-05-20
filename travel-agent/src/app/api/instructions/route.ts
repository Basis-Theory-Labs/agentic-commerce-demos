import { btProxy, validateId, withTrace } from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId");
  if (!agentId) {
    return NextResponse.json({ error: "agentId is required" }, { status: 400 });
  }
  const idError = validateId(agentId, "agentId");
  if (idError) return NextResponse.json({ error: idError }, { status: 400 });

  const body = await request.json();
  const result = await btProxy(`/agents/${agentId}/instructions`, {
    method: "POST",
    body,
  });
  return withTrace(result, 201);
}
